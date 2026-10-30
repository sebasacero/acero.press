-- El mapa en vivo de Micra (como Uber al ponerse «en línea»): el barista que
-- tocó «Salí a vender» ve a los otros baristas en la calle, dónde quieren
-- café ahora y dónde suelen estar los puestos. El equipo ve lo mismo.
--
-- «Busco café» (micra_seek): cuando un cliente usa «Cerca de mí» o escoge
-- una bebida con la ubicación ya dada, el celular manda SOLO la celda de la
-- cuadrícula (0,004°, unos 440 m de lado) y la bebida. Privacidad:
--   · la base vuelve a ajustar el punto al centro de su celda: aunque llegue
--     un punto exacto, nunca se guarda;
--   · sin nombre; el celular manda una llave aleatoria propia (no la de los
--     apartados) y se guarda solo su hash sha256 con el día como sal, que
--     sirve para el freno y no une días;
--   · una señal por celular cada 15 min; 40 por celda en la ventana; 300 en
--     total cada 10 min (frena a quien invente llaves);
--   · cada señal dura 60 min: las funciones borran las vencidas al escribir y
--     al leer (no hace falta pg_cron);
--   · la tabla no se lee desde fuera (RLS sin políticas, sin grants).
-- Lectura (micra_live_map): solo baristas enlazados y el equipo. Zonas por
-- celda con 2 señales o más, nunca puntos; los apartados que esperan a otros
-- cuentan en la celda de ese barista y los propios van aparte.
-- Densidad del estudio: puestos con GPS por celda (2 o más), sin nombres,
-- notas ni fotos.
set lock_timeout = '5s';

create table if not exists public.micra_demand (
  id          bigint generated always as identity primary key,
  -- El centro de la celda (0,004°), nunca el punto del celular
  cell_lat    numeric(6,4) not null check (cell_lat between 3.7 and 4.85),
  cell_lng    numeric(7,4) not null check (cell_lng between -74.5 and -73.95),
  drink       text not null default 'all' check (drink in ('all', 'tinto', 'perico', 'aromatica')),
  -- sha256(llave del celular | día de Bogotá): para el freno, no para saber quién
  device_hash text not null check (char_length(device_hash) = 64),
  created_at  timestamptz not null default now()
);
create index if not exists micra_demand_time_idx on public.micra_demand (created_at);
create index if not exists micra_demand_device_idx on public.micra_demand (device_hash, created_at desc);
create index if not exists micra_demand_cell_idx on public.micra_demand (cell_lat, cell_lng, created_at desc);

alter table public.micra_demand enable row level security;
revoke all on public.micra_demand from anon, authenticated;

-- El centro de la celda de 0,004° que contiene el punto (el mismo cálculo que cellOf en liveMap.js)
create or replace function public.micra_cell(p numeric)
returns numeric
language sql
immutable
as $$ select round(floor(p / 0.004) * 0.004 + 0.002, 4); $$;

-- ── Cliente: «busco café» ───────────────────────────────────────────────
create or replace function public.micra_seek(p_ref text, p_cell_lat numeric, p_cell_lng numeric, p_drink text default 'all')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_lat numeric;
  v_lng numeric;
  v_drink text := case when p_drink in ('tinto', 'perico', 'aromatica') then p_drink else 'all' end;
begin
  if coalesce(char_length(p_ref), 0) not between 8 and 64 then
    raise exception 'Llave del celular inválida.' using errcode = '22023';
  end if;
  if p_cell_lat is null or p_cell_lng is null or not (p_cell_lat between 3.7 and 4.85 and p_cell_lng between -74.5 and -73.95) then
    -- Fuera de Bogotá: no se guarda nada, sin error para el cliente
    return jsonb_build_object('accepted', false, 'reason', 'fuera');
  end if;
  v_lat := public.micra_cell(p_cell_lat);
  v_lng := public.micra_cell(p_cell_lng);
  v_hash := encode(sha256(convert_to(p_ref || '|' || public.micra_today()::text, 'UTF8')), 'hex');

  delete from public.micra_demand where created_at < now() - interval '60 minutes';

  if exists (select 1 from public.micra_demand where device_hash = v_hash and created_at > now() - interval '15 minutes') then
    return jsonb_build_object('accepted', false, 'reason', 'reciente');
  end if;
  if (select count(*) from public.micra_demand where created_at > now() - interval '10 minutes') >= 300
     or (select count(*) from public.micra_demand where cell_lat = v_lat and cell_lng = v_lng) >= 40 then
    return jsonb_build_object('accepted', false, 'reason', 'lleno');
  end if;

  insert into public.micra_demand (cell_lat, cell_lng, drink, device_hash) values (v_lat, v_lng, v_drink, v_hash);
  return jsonb_build_object('accepted', true);
end;
$$;
revoke all on function public.micra_seek(text, numeric, numeric, text) from public;
grant execute on function public.micra_seek(text, numeric, numeric, text) to anon, authenticated;

-- ── Barista enlazado y equipo: el mapa en vivo ──────────────────────────
-- p_minutes: la ventana de señales (15 a 60, 45 por defecto).
create or replace function public.micra_live_map(p_minutes int default 45)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := public.my_tintero_id();
  v_team boolean := public.is_admin();
  v_min int := least(greatest(coalesce(p_minutes, 45), 15), 60);
  v_since timestamptz := now() - make_interval(mins => least(greatest(coalesce(p_minutes, 45), 15), 60));
  d date := public.micra_today();
begin
  if v_me is null and not v_team then
    raise exception 'El mapa en vivo es para baristas enlazados.' using errcode = '42501';
  end if;
  delete from public.micra_demand where created_at < now() - interval '60 minutes';

  return jsonb_build_object(
    'minutes', v_min,
    'cell_deg', 0.004,
    'min_count', 2,
    -- Baristas en la calle ahora: lo mismo que ve el público (nombre de pila, referencia,
    -- punto redondeado a ~110 m). El equipo ve también a los que no salen en público.
    'baristas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', split_part(t.name, ' ', 1), 'referencia', coalesce(t.referencia, t.zone),
        'lat', round(coalesce(t.out_lat, t.lat), 3), 'lng', round(coalesce(t.out_lng, t.lng), 3),
        'live_until', t.out_until, 'me', t.id = v_me) order by t.out_until desc), '[]'::jsonb)
      from public.tinteros t
      where t.out_until > now() and t.stage <> 'salio' and (t.ad_consent or v_team or t.id = v_me)
        and coalesce(t.out_lat, t.lat) is not null),
    -- Quieren café: señales de la ventana + apartados que esperan a otros, por celda, 2 o más
    'demand', (select coalesce(jsonb_agg(jsonb_build_object(
        'lat', z.cell_lat, 'lng', z.cell_lng, 'n', z.pings + z.holds, 'pings', z.pings, 'holds', z.holds,
        'drinks', jsonb_build_object('tinto', z.tinto, 'perico', z.perico, 'aromatica', z.aromatica, 'all', z.anything))
        order by z.pings + z.holds desc), '[]'::jsonb)
      from (
        select cell_lat, cell_lng,
               count(*) filter (where kind = 'ping')::int pings, count(*) filter (where kind = 'hold')::int holds,
               count(*) filter (where drink = 'tinto')::int tinto, count(*) filter (where drink = 'perico')::int perico,
               count(*) filter (where drink = 'aromatica')::int aromatica, count(*) filter (where drink = 'all')::int anything
        from (
          select 'ping' kind, m.cell_lat, m.cell_lng, m.drink from public.micra_demand m where m.created_at >= v_since
          union all
          select 'hold', public.micra_cell(coalesce(t.out_lat, t.lat)), public.micra_cell(coalesce(t.out_lng, t.lng)), 'all'
          from public.micra_holds h join public.tinteros t on t.id = h.tintero_id
          where h.for_day = d and h.status = 'waiting' and h.tintero_id is distinct from v_me
            and coalesce(t.out_lat, t.lat) is not null
        ) s
        group by cell_lat, cell_lng
        having count(*) >= 2
      ) z),
    -- Suelen vender: puestos del estudio con GPS por celda, 2 o más; solo cuántos
    'study', (select coalesce(jsonb_agg(jsonb_build_object('lat', c.cell_lat, 'lng', c.cell_lng, 'n', c.n) order by c.n desc), '[]'::jsonb)
      from (
        select public.micra_cell(t.lat) cell_lat, public.micra_cell(t.lng) cell_lng, count(*)::int n
        from public.tinteros t
        where t.lat is not null and t.stage <> 'salio'
        group by 1, 2
        having count(*) >= 2
      ) c),
    -- Lo que espera a este barista (ya lo ve en su lista; aquí solo la cuenta)
    'waiting_cups', case when v_me is null then 0 else (
      select coalesce(sum(h.cups), 0)::int from public.micra_holds h
      where h.tintero_id = v_me and h.for_day = d and h.status = 'waiting') end
  );
end;
$$;
revoke all on function public.micra_live_map(int) from public, anon;
grant execute on function public.micra_live_map(int) to authenticated;

-- La app Micra (/micra): quien compra café en la calle y el barista que lo
-- vende, en la misma parada. No es domicilio: el barista sigue su ruta y el
-- cliente lo espera donde ya pasa.
--
--   Cliente (sin cuenta): ve los baristas que aceptaron salir en público,
--     a qué hora pasan, qué venden y a cuánto, y aparta tazas para recogerlas
--     en la parada (micra_hold). Le paga al barista, como siempre. Su celular
--     se identifica con un client_ref aleatorio que guarda el navegador.
--   Barista (cuenta enlazada en /ruta): avisa que salió, ve quién lo espera,
--     cuenta lo que vende (+1), lleva la libreta de fiados y pone sus precios.
--     Su libreta es suya: no toca orders ni inventory de ACERO.
--   Equipo (is_admin): el resumen del día de todos y puede actuar como
--     cualquier barista (para probar con la ficha «Prueba» o ayudar en la calle).
--
-- Todo pasa por funciones; las tablas no se leen ni escriben desde fuera.
-- Los precios salen de la ficha del barista (tinteros.*_price), nunca del
-- navegador; el navegador manda producto y cantidad.
set lock_timeout = '5s';

-- ── «Salí»: el barista avisa que está en la calle ───────────────────────
-- El punto es el del celular al tocar «Salí», redondeado a ~110 m (una
-- cuadra): nunca su posición exacta ni en vivo.
alter table public.tinteros
  add column if not exists out_until timestamptz,
  add column if not exists out_lat numeric(6,3),
  add column if not exists out_lng numeric(7,3);
alter table public.tinteros drop constraint if exists tinteros_out_check;
alter table public.tinteros add constraint tinteros_out_check check (
  num_nonnulls(out_lat, out_lng) in (0, 2)
  and (out_lat is null or (out_lat between 3.7 and 4.85 and out_lng between -74.5 and -73.95))
);

-- ── Apartados: «Apártame 2 tintos» ──────────────────────────────────────
create table if not exists public.micra_holds (
  id          uuid primary key default gen_random_uuid(),
  tintero_id  uuid not null references public.tinteros(id) on delete cascade,
  client_ref  text not null check (char_length(client_ref) between 8 and 64),
  name        text not null check (char_length(name) between 1 and 40),
  -- [{product, qty, unit_price}] con el precio de la ficha al apartar
  items       jsonb not null check (jsonb_typeof(items) = 'array' and pg_column_size(items) < 2048),
  cups        smallint not null check (cups between 1 and 6),
  total       numeric not null check (total >= 0),
  -- El día de Bogotá: un apartado vale para hoy
  for_day     date not null,
  status      text not null default 'waiting' check (status in ('waiting', 'served', 'missed', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Un apartado por celular, barista y día: volver a apartar lo cambia
  unique (tintero_id, client_ref, for_day)
);
create index if not exists micra_holds_day_idx on public.micra_holds (tintero_id, for_day);

-- ── La libreta del barista: lo que vende, tocando +1 ────────────────────
create table if not exists public.tintero_sales (
  id          uuid primary key default gen_random_uuid(),
  tintero_id  uuid not null references public.tinteros(id) on delete cascade,
  -- El celular pone el suyo: un +1 reintentado sin señal no cuenta dos veces
  client_ref  text not null unique check (char_length(client_ref) between 8 and 64),
  product     text not null check (product in ('tinto', 'perico', 'aromatica')),
  qty         smallint not null check (qty between 1 and 20),
  unit_price  numeric not null check (unit_price between 0 and 50000),
  total       numeric not null check (total >= 0),
  -- Fiado: a quién (como lo llama el barista); paid_at cuando le pagó
  fiado_name  text check (fiado_name is null or char_length(fiado_name) between 1 and 40),
  paid_at     timestamptz,
  hold_id     uuid references public.micra_holds(id) on delete set null,
  sold_at     timestamptz not null default now(),
  voided_at   timestamptz
);
create index if not exists tintero_sales_day_idx on public.tintero_sales (tintero_id, sold_at desc);
create index if not exists tintero_sales_fiado_idx on public.tintero_sales (tintero_id) where fiado_name is not null and paid_at is null and voided_at is null;

alter table public.micra_holds enable row level security;
alter table public.tintero_sales enable row level security;
revoke all on public.micra_holds from anon, authenticated;
revoke all on public.tintero_sales from anon, authenticated;
-- El equipo los lee directo (panel, BI); el resto solo por funciones
grant select on public.micra_holds, public.tintero_sales to authenticated;
drop policy if exists "solo el equipo lee apartados" on public.micra_holds;
create policy "solo el equipo lee apartados" on public.micra_holds for select using (public.is_admin());
drop policy if exists "solo el equipo lee ventas de baristas" on public.tintero_sales;
create policy "solo el equipo lee ventas de baristas" on public.tintero_sales for select using (public.is_admin());

-- ── Ayudas ──────────────────────────────────────────────────────────────
create or replace function public.micra_today()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Bogota')::date; $$;

-- Precio de un producto en la ficha (null: el barista no lo vende o no tiene precio)
create or replace function public.micra_price(t public.tinteros, p_product text)
returns numeric
language sql
stable
as $$
  select case p_product
    when 'tinto' then t.tinto_price
    when 'perico' then t.perico_price
    when 'aromatica' then t.aromatica_price
  end;
$$;

-- El barista sobre el que actúa la sesión: el suyo, o (solo el equipo) el que pide
create or replace function public.micra_actor(p_tintero_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare v uuid;
begin
  if p_tintero_id is not null and p_tintero_id is distinct from public.my_tintero_id() then
    if not public.is_admin() then
      raise exception 'Solo el equipo actúa por otro barista.' using errcode = '42501';
    end if;
    select id into v from public.tinteros where id = p_tintero_id;
    if v is null then raise exception 'No existe ese barista.' using errcode = 'P0002'; end if;
    return v;
  end if;
  v := public.my_tintero_id();
  if v is null then
    raise exception 'Enlaza tu cuenta de barista primero.' using errcode = '42501';
  end if;
  return v;
end;
$$;
revoke all on function public.micra_actor(uuid) from public, anon;

-- Lo que el público ve de un barista. Solo con permiso de salir en público
-- (ad_consent) y sin teléfono, notas, ingresos ni apellido.
create or replace function public.micra_public_card(t public.tinteros)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', split_part(t.name, ' ', 1),
    'photo_url', case when t.photo_consent then t.photo_url end,
    'localidad', t.localidad,
    'referencia', coalesce(t.referencia, t.zone),
    'carrera', t.carrera, 'calle', t.calle,
    'lat', round(coalesce(case when t.out_until > now() then t.out_lat end, t.lat), 3),
    'lng', round(coalesce(case when t.out_until > now() then t.out_lng end, t.lng), 3),
    'hora_inicio', t.hora_inicio, 'hora_fin', t.hora_fin,
    'formato', t.formato, 'recorrido', t.recorrido,
    'products', coalesce(to_jsonb(t.products), '[]'::jsonb),
    'prices', jsonb_strip_nulls(jsonb_build_object('tinto', t.tinto_price, 'perico', t.perico_price, 'aromatica', t.aromatica_price)),
    'payments', coalesce(to_jsonb(array(select p from unnest(t.payments_seen) p where p <> 'fiado')), '[]'::jsonb),
    'live_until', case when t.out_until > now() then t.out_until end,
    -- Sin cuenta enlazada nadie recibe el apartado: la app no lo ofrece
    'takes_holds', t.user_id is not null and t.stage in ('piloto', 'activo', 'prospecto'),
    'waiting', (select count(*) from public.micra_holds h where h.tintero_id = t.id and h.for_day = public.micra_today() and h.status = 'waiting')
  );
$$;
revoke all on function public.micra_public_card(public.tinteros) from public, anon;

-- ── Cliente ─────────────────────────────────────────────────────────────
create or replace function public.micra_baristas()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.micra_public_card(t) order by (t.out_until > now()) desc nulls last, t.name), '[]'::jsonb)
  from public.tinteros t
  where t.ad_consent and t.stage <> 'salio';
$$;
revoke all on function public.micra_baristas() from public;
grant execute on function public.micra_baristas() to anon, authenticated;

-- Apartar (o cambiar el apartado de hoy). p_items: [{product, qty}]
create or replace function public.micra_hold(p_tintero_id uuid, p_client_ref text, p_name text, p_items jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t public.tinteros;
  v_items jsonb := '[]'::jsonb;
  v_cups int := 0;
  v_total numeric := 0;
  v_price numeric;
  v_row public.micra_holds;
  it record;
begin
  select * into t from public.tinteros
  where id = p_tintero_id and ad_consent and stage <> 'salio' and user_id is not null;
  if t.id is null then
    raise exception 'Este barista todavía no recibe apartados en Micra.' using errcode = 'P0002';
  end if;
  if coalesce(char_length(btrim(p_name)), 0) not between 1 and 40 then
    raise exception 'Escribe tu nombre (el barista te llama por él).' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Elige qué quieres apartar.' using errcode = '22023';
  end if;
  for it in
    select x->>'product' as product, sum((x->>'qty')::int) as qty
    from jsonb_array_elements(p_items) x
    group by 1
  loop
    if it.qty is null or it.qty < 1 then continue; end if;
    v_price := public.micra_price(t, it.product);
    if v_price is null then
      raise exception 'Este barista no tiene precio para «%».', it.product using errcode = '22023';
    end if;
    v_items := v_items || jsonb_build_object('product', it.product, 'qty', it.qty, 'unit_price', v_price);
    v_cups := v_cups + it.qty;
    v_total := v_total + v_price * it.qty;
  end loop;
  if v_cups not between 1 and 6 then
    raise exception 'Se apartan de 1 a 6 tazas.' using errcode = '22023';
  end if;
  -- Freno a los apartados falsos: un barista no recibe más de 60 al día
  if (select count(*) from public.micra_holds where tintero_id = t.id and for_day = public.micra_today() and client_ref <> p_client_ref) >= 60 then
    raise exception 'Hoy % ya tiene muchos apartados. Búscalo en la calle.', split_part(t.name, ' ', 1) using errcode = '54000';
  end if;

  insert into public.micra_holds (tintero_id, client_ref, name, items, cups, total, for_day)
  values (t.id, p_client_ref, btrim(p_name), v_items, v_cups, v_total, public.micra_today())
  on conflict (tintero_id, client_ref, for_day) do update
    set name = excluded.name, items = excluded.items, cups = excluded.cups, total = excluded.total,
        status = 'waiting', updated_at = now()
    where public.micra_holds.status in ('waiting', 'cancelled')
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Ese apartado ya se entregó hoy.' using errcode = '22023';
  end if;
  return jsonb_build_object('id', v_row.id, 'tintero_id', v_row.tintero_id, 'items', v_row.items, 'cups', v_row.cups,
    'total', v_row.total, 'status', v_row.status, 'for_day', v_row.for_day);
end;
$$;
revoke all on function public.micra_hold(uuid, text, text, jsonb) from public;
grant execute on function public.micra_hold(uuid, text, text, jsonb) to anon, authenticated;

-- Los apartados de hoy de este celular (el client_ref es su llave)
create or replace function public.micra_my_holds(p_client_ref text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'tintero_id', h.tintero_id, 'name', h.name, 'items', h.items,
    'cups', h.cups, 'total', h.total, 'status', h.status, 'for_day', h.for_day) order by h.created_at), '[]'::jsonb)
  from public.micra_holds h
  where h.client_ref = p_client_ref and char_length(p_client_ref) >= 8 and h.for_day = public.micra_today();
$$;
revoke all on function public.micra_my_holds(text) from public;
grant execute on function public.micra_my_holds(text) to anon, authenticated;

create or replace function public.micra_hold_cancel(p_client_ref text, p_hold_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  with c as (
    update public.micra_holds set status = 'cancelled', updated_at = now()
    where id = p_hold_id and client_ref = p_client_ref and status = 'waiting'
    returning 1
  ) select exists (select 1 from c);
$$;
revoke all on function public.micra_hold_cancel(text, uuid) from public;
grant execute on function public.micra_hold_cancel(text, uuid) to anon, authenticated;

-- ── Barista ─────────────────────────────────────────────────────────────
-- Todo su día en una llamada: ficha, quién lo espera, lo vendido, fiados y la semana
create or replace function public.micra_barista_day(p_tintero_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  t public.tinteros;
  d date := public.micra_today();
begin
  select * into t from public.tinteros where id = v;
  return jsonb_build_object(
    'id', t.id, 'name', t.name, 'zone', coalesce(t.referencia, t.zone), 'localidad', t.localidad,
    'public', t.ad_consent, 'linked', t.user_id is not null,
    'products', coalesce(to_jsonb(t.products), '[]'::jsonb),
    'prices', jsonb_build_object('tinto', t.tinto_price, 'perico', t.perico_price, 'aromatica', t.aromatica_price),
    'live_until', case when t.out_until > now() then t.out_until end,
    'holds', (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'items', h.items, 'cups', h.cups,
                'total', h.total, 'status', h.status, 'at', h.created_at) order by h.status <> 'waiting', h.created_at), '[]'::jsonb)
              from public.micra_holds h where h.tintero_id = v and h.for_day = d and h.status <> 'cancelled'),
    'sales', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'product', s.product, 'qty', s.qty, 'total', s.total,
                'fiado_name', s.fiado_name, 'at', s.sold_at) order by s.sold_at desc), '[]'::jsonb)
              from public.tintero_sales s
              where s.tintero_id = v and s.voided_at is null and (s.sold_at at time zone 'America/Bogota')::date = d),
    'fiados', (select coalesce(jsonb_agg(jsonb_build_object('name', f.fiado_name, 'total', f.total, 'cups', f.cups, 'since', f.since) order by f.since), '[]'::jsonb)
               from (select fiado_name, sum(total) total, sum(qty) cups, min(sold_at) since
                     from public.tintero_sales
                     where tintero_id = v and fiado_name is not null and paid_at is null and voided_at is null
                     group by fiado_name) f),
    'week', (select coalesce(jsonb_agg(jsonb_build_object('day', g.day::date, 'cups', coalesce(w.cups, 0), 'total', coalesce(w.total, 0)) order by g.day), '[]'::jsonb)
             from generate_series(d - 6, d, interval '1 day') g(day)
             left join (select (sold_at at time zone 'America/Bogota')::date dd, sum(qty) cups, sum(total) total
                        from public.tintero_sales where tintero_id = v and voided_at is null and sold_at > now() - interval '8 days'
                        group by 1) w on w.dd = g.day::date)
  );
end;
$$;
revoke all on function public.micra_barista_day(uuid) from public, anon;
grant execute on function public.micra_barista_day(uuid) to authenticated;

-- Salí (p_minutes > 0, máximo 6 h) o ya volví (0). El punto llega redondeado.
create or replace function public.micra_barista_out(p_minutes int, p_lat numeric default null, p_lng numeric default null, p_tintero_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  v_until timestamptz := case when coalesce(p_minutes, 0) > 0 then now() + make_interval(mins => least(p_minutes, 360)) end;
  v_ok boolean := p_lat between 3.7 and 4.85 and p_lng between -74.5 and -73.95;
begin
  update public.tinteros set
    out_until = v_until,
    out_lat = case when v_until is null then null when v_ok then round(p_lat, 3) end,
    out_lng = case when v_until is null then null when v_ok then round(p_lng, 3) end
  where id = v;
  return jsonb_build_object('live_until', v_until);
end;
$$;
revoke all on function public.micra_barista_out(int, numeric, numeric, uuid) from public, anon;
grant execute on function public.micra_barista_out(int, numeric, numeric, uuid) to authenticated;

-- Sus precios: el barista pone los suyos (y con eso se cobra el apartado)
create or replace function public.micra_barista_prices(p_tinto numeric, p_perico numeric, p_aromatica numeric, p_tintero_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v uuid := public.micra_actor(p_tintero_id);
begin
  if p_tinto not between 0 and 50000 or p_perico not between 0 and 50000 or p_aromatica not between 0 and 50000 then
    raise exception 'Los precios van de $0 a $50.000.' using errcode = '22023';
  end if;
  update public.tinteros set tinto_price = p_tinto, perico_price = p_perico, aromatica_price = p_aromatica,
    products = (select array(select distinct x from unnest(coalesce(products, '{}') ||
      array_remove(array[case when p_tinto is not null then 'tinto' end, case when p_perico is not null then 'perico' end,
                         case when p_aromatica is not null then 'aromatica' end], null)) x))
  where id = v;
  return jsonb_build_object('tinto', p_tinto, 'perico', p_perico, 'aromatica', p_aromatica);
end;
$$;
revoke all on function public.micra_barista_prices(numeric, numeric, numeric, uuid) from public, anon;
grant execute on function public.micra_barista_prices(numeric, numeric, numeric, uuid) to authenticated;

-- +1: una venta (o un fiado). El precio sale de la ficha. Reintentar con el
-- mismo client_ref devuelve la misma venta.
create or replace function public.micra_barista_sale(p_client_ref text, p_product text, p_qty int default 1, p_fiado_name text default null, p_tintero_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  t public.tinteros;
  v_price numeric;
  s public.tintero_sales;
begin
  select * into s from public.tintero_sales where client_ref = p_client_ref;
  if s.id is not null then
    if s.tintero_id <> v then raise exception 'Esa venta no es tuya.' using errcode = '42501'; end if;
    return jsonb_build_object('id', s.id, 'product', s.product, 'qty', s.qty, 'total', s.total, 'replay', true);
  end if;
  select * into t from public.tinteros where id = v;
  v_price := public.micra_price(t, p_product);
  if v_price is null then
    raise exception 'Pon el precio de «%» antes de contarlo.', p_product using errcode = '22023';
  end if;
  insert into public.tintero_sales (tintero_id, client_ref, product, qty, unit_price, total, fiado_name)
  values (v, p_client_ref, p_product, p_qty, v_price, v_price * p_qty, nullif(btrim(p_fiado_name), ''))
  on conflict (client_ref) do nothing
  returning * into s;
  -- Llegaron dos a la vez con el mismo client_ref: el otro ya la guardó
  if s.id is null then
    select * into s from public.tintero_sales where client_ref = p_client_ref and tintero_id = v;
    return jsonb_build_object('id', s.id, 'product', s.product, 'qty', s.qty, 'total', s.total, 'replay', true);
  end if;
  return jsonb_build_object('id', s.id, 'product', s.product, 'qty', s.qty, 'total', s.total, 'replay', false);
end;
$$;
revoke all on function public.micra_barista_sale(text, text, int, text, uuid) from public, anon;
grant execute on function public.micra_barista_sale(text, text, int, text, uuid) to authenticated;

-- Deshacer una venta de hoy (el +1 de más). Una sola vez.
create or replace function public.micra_barista_undo(p_sale_id uuid, p_tintero_id uuid default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v uuid := public.micra_actor(p_tintero_id); n int;
begin
  update public.tintero_sales set voided_at = now()
  where id = p_sale_id and tintero_id = v and voided_at is null
    and (sold_at at time zone 'America/Bogota')::date = public.micra_today();
  get diagnostics n = row_count;
  -- Si era la entrega de un apartado, el apartado vuelve a esperar
  if n > 0 then
    update public.micra_holds h set status = 'waiting', updated_at = now()
    where h.id = (select hold_id from public.tintero_sales where id = p_sale_id) and h.status = 'served'
      and not exists (select 1 from public.tintero_sales s where s.hold_id = h.id and s.voided_at is null);
  end if;
  return n > 0;
end;
$$;
revoke all on function public.micra_barista_undo(uuid, uuid) from public, anon;
grant execute on function public.micra_barista_undo(uuid, uuid) to authenticated;

-- Entregar un apartado: sus tazas entran a la libreta (a los precios con que
-- se apartó) y el apartado queda entregado, todo en una transacción. O «no vino».
create or replace function public.micra_hold_close(p_hold_id uuid, p_served boolean, p_tintero_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  h public.micra_holds;
  it jsonb;
begin
  select * into h from public.micra_holds where id = p_hold_id and tintero_id = v for update;
  if h.id is null then raise exception 'No existe ese apartado.' using errcode = 'P0002'; end if;
  if h.status <> 'waiting' then
    return jsonb_build_object('id', h.id, 'status', h.status, 'replay', true);
  end if;
  if p_served then
    for it in select * from jsonb_array_elements(h.items) loop
      insert into public.tintero_sales (tintero_id, client_ref, product, qty, unit_price, total, hold_id)
      values (v, 'hold-' || h.id || '-' || (it->>'product'), it->>'product', (it->>'qty')::int,
              (it->>'unit_price')::numeric, (it->>'unit_price')::numeric * (it->>'qty')::int, h.id)
      on conflict (client_ref) do update set voided_at = null, sold_at = now();
    end loop;
  end if;
  update public.micra_holds set status = case when p_served then 'served' else 'missed' end, updated_at = now()
  where id = h.id returning * into h;
  return jsonb_build_object('id', h.id, 'status', h.status, 'replay', false);
end;
$$;
revoke all on function public.micra_hold_close(uuid, boolean, uuid) from public, anon;
grant execute on function public.micra_hold_close(uuid, boolean, uuid) to authenticated;

-- Le pagaron un fiado: todo lo que esa persona debía queda pagado
create or replace function public.micra_fiado_paid(p_name text, p_tintero_id uuid default null)
returns numeric
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v uuid := public.micra_actor(p_tintero_id); v_total numeric;
begin
  with p as (
    update public.tintero_sales set paid_at = now()
    where tintero_id = v and fiado_name = p_name and paid_at is null and voided_at is null
    returning total
  ) select coalesce(sum(total), 0) into v_total from p;
  return v_total;
end;
$$;
revoke all on function public.micra_fiado_paid(text, uuid) from public, anon;
grant execute on function public.micra_fiado_paid(text, uuid) to authenticated;

-- ── Equipo ──────────────────────────────────────────────────────────────
create or replace function public.micra_owner_day()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare d date := public.micra_today();
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo ve el resumen.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'day', d,
    'baristas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'stage', t.stage, 'localidad', t.localidad, 'referencia', coalesce(t.referencia, t.zone),
        'public', t.ad_consent, 'linked', t.user_id is not null, 'invite_code', case when t.invite_expires_at > now() then t.invite_code end,
        'live_until', case when t.out_until > now() then t.out_until end,
        'has_prices', t.tinto_price is not null,
        'cups', coalesce(s.cups, 0), 'total', coalesce(s.total, 0), 'fiado', coalesce(s.fiado, 0),
        'waiting', coalesce(h.waiting, 0), 'served', coalesce(h.served, 0)
      ) order by (t.out_until > now()) desc nulls last, coalesce(s.cups, 0) desc, t.name), '[]'::jsonb)
      from public.tinteros t
      left join (select tintero_id, sum(qty) cups, sum(total) total, sum(total) filter (where fiado_name is not null) fiado
                 from public.tintero_sales where voided_at is null and (sold_at at time zone 'America/Bogota')::date = d group by 1) s on s.tintero_id = t.id
      left join (select tintero_id, count(*) filter (where status = 'waiting') waiting, count(*) filter (where status = 'served') served
                 from public.micra_holds where for_day = d group by 1) h on h.tintero_id = t.id
      where t.stage <> 'salio'),
    'week', (select coalesce(jsonb_agg(jsonb_build_object('day', g.day::date, 'cups', coalesce(w.cups, 0), 'total', coalesce(w.total, 0), 'holds', coalesce(x.n, 0)) order by g.day), '[]'::jsonb)
             from generate_series(d - 6, d, interval '1 day') g(day)
             left join (select (sold_at at time zone 'America/Bogota')::date dd, sum(qty) cups, sum(total) total
                        from public.tintero_sales where voided_at is null and sold_at > now() - interval '8 days' group by 1) w on w.dd = g.day::date
             left join (select for_day, count(*) n from public.micra_holds where for_day > d - 7 and status <> 'cancelled' group by 1) x on x.for_day = g.day::date)
  );
end;
$$;
revoke all on function public.micra_owner_day() from public, anon;
grant execute on function public.micra_owner_day() to authenticated;

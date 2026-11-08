-- Freno por red para lo que se puede pedir sin cuenta (prueba de 100+ usuarios, 8 nov 2026).
-- «Busco café», apartar, votar en la Competencia y contar vistas/toques de anuncios
-- se identifican con una llave que manda el propio celular: con llaves inventadas,
-- un solo script llenaba el tope de toda Bogotá (300 señales cada 10 min), dejaba a
-- un barista «lleno» con 60 apartados falsos o compraba el podio del reto.
--
-- Ahora cada una de esas funciones cuenta también por red: la IP del pedido (la que
-- pone el proxy de Supabase en x-forwarded-for / cf-connecting-ip), guardada solo como
-- sha256(IP | día de Bogotá) y borrada a las 26 h. Los topes son holgados porque en
-- Colombia muchos celulares salen por la misma IP del operador (CGNAT) y una oficina
-- comparte la suya. Sin cabeceras (Postgres local, pruebas) no frena nada.
set lock_timeout = '5s';

create table if not exists public.micra_net_hits (
  id        bigint generated always as identity primary key,
  action    text not null check (char_length(action) between 1 and 80),
  net_hash  text not null check (char_length(net_hash) = 64),
  at        timestamptz not null default now()
);
create index if not exists micra_net_hits_lookup_idx on public.micra_net_hits (action, net_hash, at desc);
create index if not exists micra_net_hits_at_idx on public.micra_net_hits (at);
alter table public.micra_net_hits enable row level security;
revoke all on public.micra_net_hits from anon, authenticated;

-- La red del pedido, como hash del día; null si no vino por la API (sin cabeceras)
create or replace function public.micra_net_hash()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  h json;
  ip text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if h is null then return null; end if;
  ip := coalesce(nullif(btrim(h->>'cf-connecting-ip'), ''), nullif(btrim(split_part(h->>'x-forwarded-for', ',', 1)), ''));
  if ip is null then return null; end if;
  return encode(sha256(convert_to(ip || '|' || public.micra_today()::text, 'UTF8')), 'hex');
end;
$$;
revoke all on function public.micra_net_hash() from public, anon, authenticated;

-- ¿Puede esta red hacer `p_action` otra vez? Cuenta y anota en una sola llamada.
-- p_window va de 1 minuto a 24 horas.
create or replace function public.micra_net_allow(p_action text, p_max int, p_window interval)
returns boolean
language plpgsql
volatile
set search_path = public
as $$
declare
  v_hash text := public.micra_net_hash();
begin
  if v_hash is null then return true; end if;
  -- Lo viejo se va aquí mismo (sin pg_cron), como en micra_demand
  delete from public.micra_net_hits where at < now() - interval '26 hours';
  if (select count(*) from public.micra_net_hits
      where action = p_action and net_hash = v_hash and at > now() - p_window) >= p_max then
    return false;
  end if;
  insert into public.micra_net_hits (action, net_hash) values (p_action, v_hash);
  return true;
end;
$$;
revoke all on function public.micra_net_allow(text, int, interval) from public, anon, authenticated;

-- ── «Busco café»: 30 señales cada 10 min por red; el tope de la ciudad sube a 1.500 ──
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
  if (select count(*) from public.micra_demand where created_at > now() - interval '10 minutes') >= 1500
     or (select count(*) from public.micra_demand where cell_lat = v_lat and cell_lng = v_lng) >= 40 then
    return jsonb_build_object('accepted', false, 'reason', 'lleno');
  end if;
  -- Por red al final: solo cuenta lo que de verdad se iba a guardar
  if not public.micra_net_allow('seek', 30, interval '10 minutes') then
    return jsonb_build_object('accepted', false, 'reason', 'red');
  end if;

  insert into public.micra_demand (cell_lat, cell_lng, drink, device_hash) values (v_lat, v_lng, v_drink, v_hash);
  return jsonb_build_object('accepted', true);
end;
$$;
revoke all on function public.micra_seek(text, numeric, numeric, text) from public;
grant execute on function public.micra_seek(text, numeric, numeric, text) to anon, authenticated;

-- ── Apartar: 20 apartados nuevos por hora por red ─────────────────────
create or replace function public.micra_hold(p_tintero_id uuid, p_client_ref text, p_name text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t public.tinteros;
  v_items jsonb := '[]'::jsonb;
  v_cups int := 0;
  v_total numeric := 0;
  v_price numeric;
  v_row public.micra_holds;
  v_until date;
  it record;
begin
  select * into t from public.tinteros
  where id = p_tintero_id and ad_consent and stage <> 'salio' and user_id is not null;
  if t.id is null then
    raise exception 'Este barista todavía no recibe apartados en Micra.' using errcode = 'P0002';
  end if;
  v_until := public.micra_client_paused_until(p_client_ref);
  if v_until is not null then
    raise exception 'No llegaste a tus dos últimos apartados. Vuelves a apartar el %; mientras, búscalo en la calle.',
      to_char(v_until, 'DD/MM') using errcode = '42501';
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

  -- Freno por red: 20 apartados nuevos por hora desde una misma red (cambiar el propio no cuenta)
  if not exists (select 1 from public.micra_holds where tintero_id = t.id and client_ref = p_client_ref and for_day = public.micra_today())
     and not public.micra_net_allow('hold', 20, interval '1 hour') then
    raise exception 'Hay muchos apartados desde esta red. Espera unos minutos o busca al barista en la calle.' using errcode = '54000';
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
$function$;

-- ── Competencia: 8 votos por entrada al día y 120 cada 10 min por red ──
create or replace function public.micra_vote(p_post_id uuid, p_ref text, p_score integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p public.micra_posts;
  c public.micra_challenges;
  me uuid := public.my_tintero_id();
  h text;
begin
  if p_score is null or p_score not between 1 and 5 then
    raise exception 'La nota va de 1 a 5.' using errcode = '22023';
  end if;
  if p_ref is null or char_length(p_ref) not between 8 and 80 then
    raise exception 'Falta la llave del celular.' using errcode = '22023';
  end if;
  select * into p from public.micra_posts where id = p_post_id and status = 'approved' and challenge_id is not null;
  if p.id is null then
    raise exception 'Esa entrada no está en el reto.' using errcode = 'P0002';
  end if;
  select * into c from public.micra_challenges where id = p.challenge_id;
  if public.micra_today() > c.ends_on then
    raise exception 'Ese reto ya cerró.' using errcode = '22023';
  end if;
  if me is not null and me = p.tintero_id then
    raise exception 'Tu propia entrada no se califica.' using errcode = '42501';
  end if;
  -- sha256(llave del celular | reto): un voto por entrada, sin saber quién
  h := encode(sha256(convert_to(p_ref || '|' || c.id::text, 'UTF8')), 'hex');
  -- Freno: 30 votos por minuto desde un mismo celular
  if (select count(*) from public.micra_votes where voter_hash = h and updated_at > now() - interval '1 minute') >= 30 then
    raise exception 'Muy rápido: espera un momento.' using errcode = '54000';
  end if;
  -- Freno por red (solo votos nuevos, cambiar la nota no cuenta): 8 votos por entrada al día
  -- y 120 cada 10 min desde una misma red, para que no se compre el podio con llaves inventadas
  if not exists (select 1 from public.micra_votes where post_id = p.id and voter_hash = h) then
    if not public.micra_net_allow('vote:' || p.id::text, 8, interval '24 hours')
       or not public.micra_net_allow('vote', 120, interval '10 minutes') then
      raise exception 'Hay muchos votos desde esta red. Vuelve a intentarlo más tarde.' using errcode = '54000';
    end if;
  end if;
  insert into public.micra_votes (post_id, voter_hash, score) values (p.id, h, p_score)
  on conflict (post_id, voter_hash) do update set score = excluded.score, updated_at = now();
  return jsonb_build_object(
    'post_id', p.id, 'my_score', p_score,
    'votes', (select count(*) from public.micra_votes where post_id = p.id),
    'avg', (select round(avg(score)::numeric, 2) from public.micra_votes where post_id = p.id)
  );
end;
$function$;

-- ── Anuncios: 200 vistas o toques por hora por red ─────────────────────
create or replace function public.micra_ad_event(p_ad_id uuid, p_kind text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d date := public.micra_today();
begin
  if p_kind not in ('view', 'tap') then
    raise exception 'Solo vistas o toques.' using errcode = '22023';
  end if;
  -- Solo cuenta lo que está al aire hoy
  if not exists (select 1 from public.micra_ads where id = p_ad_id and active and d between starts_on and ends_on) then
    return;
  end if;
  -- Freno por red: 200 vistas o toques por hora; lo demás no se cuenta (sin error)
  if not public.micra_net_allow('ad', 200, interval '1 hour') then
    return;
  end if;
  insert into public.micra_ad_stats as s (ad_id, day, views, taps)
  values (p_ad_id, d, (p_kind = 'view')::int, (p_kind = 'tap')::int)
  on conflict (ad_id, day) do update
    set views = s.views + excluded.views, taps = s.taps + excluded.taps;
end;
$function$;

revoke all on function public.micra_hold(uuid, text, text, jsonb) from public;
grant execute on function public.micra_hold(uuid, text, text, jsonb) to anon, authenticated;
revoke all on function public.micra_vote(uuid, text, int) from public;
grant execute on function public.micra_vote(uuid, text, int) to anon, authenticated;
revoke all on function public.micra_ad_event(uuid, text) from public;
grant execute on function public.micra_ad_event(uuid, text) to anon, authenticated;

-- Rutas de los tinteros (Plan Micra): el recorrido que ya hacen, medido con
-- el GPS de su celular mientras ellos lo dejan encendido.
--
--   tinteros.user_id: la cuenta (Google) con la que el tintero entra a /ruta.
--     Se enlaza con un código de invitación que genera el equipo (7 días).
--   tinteros.tracking_consent_at: cuándo aceptó compartir su ubicación. Sin
--     esa fecha no se abre ningún recorrido (Ley 1581 de 2012: autorización
--     previa, expresa e informada). Retirarla cierra el recorrido abierto.
--   tintero_routes: un recorrido (empezar → terminar). Al terminar, la app
--     guarda el resumen: distancia, paradas detectadas y el trazo simplificado.
--   tintero_route_points: cada punto GPS (lat, lng, precisión). Es el dato
--     crudo: el resumen se puede recalcular desde aquí.
--
-- Escrituras SOLO por funciones: el tintero escribe en su propio recorrido y
-- nada más; el equipo lo lee todo. Las rutas nunca salen al mapa público
-- (micra_street_map no las toca) ni a otro tintero.
set lock_timeout = '5s';

-- ── Cuenta y permiso del tintero ───────────────────────────────────────
alter table public.tinteros add column if not exists user_id uuid;
alter table public.tinteros add column if not exists invite_code text;
alter table public.tinteros add column if not exists invite_expires_at timestamptz;
alter table public.tinteros add column if not exists tracking_consent_at timestamptz;
create unique index if not exists tinteros_user_id_key on public.tinteros (user_id) where user_id is not null;
create unique index if not exists tinteros_invite_code_key on public.tinteros (invite_code) where invite_code is not null;
alter table public.tinteros drop constraint if exists tinteros_user_id_fkey;
alter table public.tinteros add constraint tinteros_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.tinteros drop constraint if exists tinteros_invite_code_check;
alter table public.tinteros add constraint tinteros_invite_code_check check (invite_code is null or invite_code ~ '^[A-Z2-9]{6}$');

-- ── Recorridos y puntos ────────────────────────────────────────────────
create table if not exists public.tintero_routes (
  id          uuid primary key default gen_random_uuid(),
  tintero_id  uuid not null references public.tinteros(id) on delete cascade,
  -- El celular pone el suyo: un reintento de «Empezar» no abre dos recorridos
  client_ref  text not null unique check (char_length(client_ref) between 8 and 64),
  started_at  timestamptz not null,
  ended_at    timestamptz check (ended_at is null or ended_at >= started_at),
  points_n    integer not null default 0 check (points_n >= 0),
  distance_m  integer check (distance_m is null or distance_m between 0 and 100000),
  -- [{lat, lng, carrera, calle, from, to, minutes}]
  stops       jsonb check (stops is null or (jsonb_typeof(stops) = 'array' and pg_column_size(stops) < 32768)),
  -- [[lng, lat], …] simplificado (≤ 400 puntos), lo que dibuja el mapa del panel
  path        jsonb check (path is null or (jsonb_typeof(path) = 'array' and pg_column_size(path) < 65536)),
  created_at  timestamptz not null default now()
);
-- Un solo recorrido abierto por tintero
create unique index if not exists tintero_routes_open_key on public.tintero_routes (tintero_id) where ended_at is null;
create index if not exists tintero_routes_started_idx on public.tintero_routes (started_at desc);

create table if not exists public.tintero_route_points (
  route_id    uuid not null references public.tintero_routes(id) on delete cascade,
  recorded_at timestamptz not null,
  -- Bogotá y alrededores, con margen: un punto fuera es un error del GPS
  lat         double precision not null check (lat between 4.3 and 5.0),
  lng         double precision not null check (lng between -74.4 and -73.8),
  accuracy_m  real check (accuracy_m is null or accuracy_m between 0 and 1000),
  primary key (route_id, recorded_at)
);

alter table public.tintero_routes enable row level security;
alter table public.tintero_route_points enable row level security;
revoke all on public.tintero_routes from anon;
revoke all on public.tintero_route_points from anon;

-- El tintero de la sesión (o null). Security definer: tinteros es solo del equipo.
create or replace function public.my_tintero_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.tinteros where user_id = auth.uid() and auth.uid() is not null and stage <> 'salio';
$$;
revoke all on function public.my_tintero_id() from public, anon;
grant execute on function public.my_tintero_id() to authenticated;

drop policy if exists "el equipo y el tintero ven sus recorridos" on public.tintero_routes;
create policy "el equipo y el tintero ven sus recorridos" on public.tintero_routes
  for select using (public.is_admin() or tintero_id = public.my_tintero_id());
drop policy if exists "solo admin edita recorridos" on public.tintero_routes;
create policy "solo admin edita recorridos" on public.tintero_routes
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "el equipo y el tintero ven sus puntos" on public.tintero_route_points;
create policy "el equipo y el tintero ven sus puntos" on public.tintero_route_points
  for select using (public.is_admin() or route_id in (select id from public.tintero_routes where tintero_id = public.my_tintero_id()));
drop policy if exists "solo admin edita puntos" on public.tintero_route_points;
create policy "solo admin edita puntos" on public.tintero_route_points
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Equipo: código de invitación ───────────────────────────────────────
-- Seis caracteres sin 0/O ni 1/I/L, para dictarlo en la calle. Generar uno
-- nuevo reemplaza al anterior; no desenlaza una cuenta ya enlazada.
create or replace function public.tintero_invite(p_tintero_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_try int := 0;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo invita tinteros.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tinteros where id = p_tintero_id) then
    raise exception 'No existe ese tintero.' using errcode = 'P0002';
  end if;
  loop
    v_try := v_try + 1;
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      into v_code from generate_series(1, 6);
    begin
      update public.tinteros set invite_code = v_code, invite_expires_at = now() + interval '7 days'
      where id = p_tintero_id;
      exit;
    exception when unique_violation then
      if v_try >= 5 then raise; end if;
    end;
  end loop;
  return jsonb_build_object('code', v_code, 'expires_at', now() + interval '7 days');
end;
$$;
revoke all on function public.tintero_invite(uuid) from public, anon;
grant execute on function public.tintero_invite(uuid) to authenticated;

-- ── Tintero: quién soy, enlazar la cuenta, permiso ─────────────────────
create or replace function public.tintero_me()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'zone', t.zone,
    'consent_at', t.tracking_consent_at,
    'open_route', (
      select jsonb_build_object('id', r.id, 'client_ref', r.client_ref, 'started_at', r.started_at, 'points_n', r.points_n)
      from public.tintero_routes r where r.tintero_id = t.id and r.ended_at is null
    )
  )
  from public.tinteros t
  where t.id = public.my_tintero_id();
$$;
revoke all on function public.tintero_me() from public, anon;
grant execute on function public.tintero_me() to authenticated;

create or replace function public.tintero_claim(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Entra con tu cuenta primero.' using errcode = '42501';
  end if;
  -- Ya enlazado: el código no hace falta
  if public.my_tintero_id() is not null then
    return public.tintero_me();
  end if;
  select id into v_id from public.tinteros
  where invite_code = v_code and invite_expires_at > now() and stage <> 'salio' and user_id is null
  for update;
  if v_id is null then
    raise exception 'Ese código no sirve o ya venció. Pídele uno nuevo al equipo de Micra.' using errcode = '22023';
  end if;
  update public.tinteros set user_id = auth.uid(), invite_code = null, invite_expires_at = null where id = v_id;
  return public.tintero_me();
end;
$$;
revoke all on function public.tintero_claim(text) from public, anon;
grant execute on function public.tintero_claim(text) to authenticated;

-- Aceptar (true) o retirar (false) el permiso de ubicación. Retirarlo cierra
-- el recorrido abierto; los recorridos guardados se borran con tintero_route_delete.
create or replace function public.tintero_consent(p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.my_tintero_id();
begin
  if v_id is null then
    raise exception 'Esta cuenta no está enlazada a un tintero.' using errcode = '42501';
  end if;
  if p_accept then
    update public.tinteros set tracking_consent_at = coalesce(tracking_consent_at, now()) where id = v_id;
  else
    update public.tintero_routes set ended_at = greatest(started_at, now()) where tintero_id = v_id and ended_at is null;
    update public.tinteros set tracking_consent_at = null where id = v_id;
  end if;
  return public.tintero_me();
end;
$$;
revoke all on function public.tintero_consent(boolean) from public, anon;
grant execute on function public.tintero_consent(boolean) to authenticated;

-- ── Tintero: el recorrido ──────────────────────────────────────────────
-- Empezar: con el mismo client_ref devuelve el mismo; con uno abierto, lo retoma.
create or replace function public.tintero_route_start(p_client_ref text, p_started_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.my_tintero_id();
  v_row public.tintero_routes;
  v_at timestamptz := coalesce(p_started_at, now());
begin
  if v_id is null then
    raise exception 'Esta cuenta no está enlazada a un tintero.' using errcode = '42501';
  end if;
  if (select tracking_consent_at from public.tinteros where id = v_id) is null then
    raise exception 'Primero acepta compartir tu ubicación.' using errcode = '42501';
  end if;
  if p_client_ref is null or char_length(p_client_ref) not between 8 and 64 then
    raise exception 'client_ref inválido.' using errcode = '22023';
  end if;
  -- La hora del celular puede estar corrida: se acepta si es de las últimas 12 h
  if v_at < now() - interval '12 hours' or v_at > now() + interval '5 minutes' then
    v_at := now();
  end if;
  select * into v_row from public.tintero_routes where client_ref = p_client_ref;
  if found and v_row.tintero_id <> v_id then
    raise exception 'client_ref inválido.' using errcode = '22023';
  end if;
  if not found then
    select * into v_row from public.tintero_routes where tintero_id = v_id and ended_at is null;
  end if;
  if not found then
    insert into public.tintero_routes (tintero_id, client_ref, started_at)
    values (v_id, p_client_ref, least(v_at, now()))
    on conflict do nothing
    returning * into v_row;
    if v_row.id is null then
      -- Otra llamada ganó la carrera (mismo client_ref o un recorrido abierto)
      select * into v_row from public.tintero_routes where tintero_id = v_id and (client_ref = p_client_ref or ended_at is null)
      order by ended_at nulls first limit 1;
    end if;
  end if;
  return jsonb_build_object('id', v_row.id, 'client_ref', v_row.client_ref, 'started_at', v_row.started_at,
                            'ended_at', v_row.ended_at, 'points_n', v_row.points_n);
end;
$$;
revoke all on function public.tintero_route_start(text, timestamptz) from public, anon;
grant execute on function public.tintero_route_start(text, timestamptz) to authenticated;

-- Puntos en lotes (hasta 500). Lo que no cuadra (fuera de Bogotá, precisión
-- peor de 200 m, hora fuera del recorrido) se descarta sin fallar el lote;
-- un punto repetido (reintento) no se duplica.
create or replace function public.tintero_route_add_points(p_route_id uuid, p_points jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route public.tintero_routes;
  v_in int;
  v_new int;
begin
  select * into v_route from public.tintero_routes where id = p_route_id and tintero_id = public.my_tintero_id() for update;
  if not found then
    raise exception 'Ese recorrido no es tuyo.' using errcode = '42501';
  end if;
  if (select tracking_consent_at from public.tinteros where id = v_route.tintero_id) is null then
    raise exception 'Retiraste el permiso de ubicación.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_points) is distinct from 'array' then
    raise exception 'Los puntos van en una lista.' using errcode = '22023';
  end if;
  v_in := jsonb_array_length(p_points);
  if v_in > 500 then
    raise exception 'Demasiados puntos en un envío (máximo 500).' using errcode = '22023';
  end if;
  with raw as (
    select (e->>'t')::timestamptz as t, (e->>'lat')::double precision as lat, (e->>'lng')::double precision as lng,
           nullif(e->>'acc', '')::real as acc
    from jsonb_array_elements(p_points) e
    where jsonb_typeof(e) = 'object'
      and (e->>'t') is not null and (e->>'lat') ~ '^-?[0-9.]+$' and (e->>'lng') ~ '^-?[0-9.]+$'
  ), ok as (
    select * from raw
    where lat between 4.3 and 5.0 and lng between -74.4 and -73.8
      and (acc is null or acc between 0 and 200)
      and t >= v_route.started_at - interval '1 minute'
      and t <= coalesce(v_route.ended_at, now()) + interval '5 minutes'
  ), ins as (
    insert into public.tintero_route_points (route_id, recorded_at, lat, lng, accuracy_m)
    select distinct on (t) p_route_id, t, lat, lng, acc from ok order by t
    on conflict do nothing
    returning 1
  )
  select count(*) into v_new from ins;
  update public.tintero_routes set points_n = points_n + v_new where id = p_route_id
  returning * into v_route;
  return jsonb_build_object('accepted', v_new, 'sent', v_in, 'points_n', v_route.points_n);
end;
$$;
revoke all on function public.tintero_route_add_points(uuid, jsonb) from public, anon;
grant execute on function public.tintero_route_add_points(uuid, jsonb) to authenticated;

-- Terminar: guarda el resumen que calculó la app (distancia, paradas, trazo).
-- Terminar dos veces devuelve el mismo recorrido sin cambiarlo.
create or replace function public.tintero_route_end(p_route_id uuid, p_ended_at timestamptz default null, p_summary jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route public.tintero_routes;
  v_dist numeric;
  v_stops jsonb;
  v_path jsonb;
begin
  select * into v_route from public.tintero_routes where id = p_route_id and tintero_id = public.my_tintero_id() for update;
  if not found then
    raise exception 'Ese recorrido no es tuyo.' using errcode = '42501';
  end if;
  if v_route.ended_at is null or v_route.distance_m is null then
    if p_summary is not null and jsonb_typeof(p_summary) = 'object' then
      v_dist := case when jsonb_typeof(p_summary->'distance_m') = 'number' then (p_summary->>'distance_m')::numeric end;
      v_stops := case when jsonb_typeof(p_summary->'stops') = 'array' and jsonb_array_length(p_summary->'stops') <= 100 then p_summary->'stops' end;
      v_path := case when jsonb_typeof(p_summary->'path') = 'array' and jsonb_array_length(p_summary->'path') <= 400 then p_summary->'path' end;
    end if;
    update public.tintero_routes set
      ended_at = coalesce(ended_at, greatest(started_at, least(coalesce(p_ended_at, now()), now()))),
      distance_m = case when v_dist between 0 and 100000 then round(v_dist)::int else distance_m end,
      stops = coalesce(v_stops, stops),
      path = coalesce(v_path, path)
    where id = p_route_id
    returning * into v_route;
  end if;
  return jsonb_build_object('id', v_route.id, 'started_at', v_route.started_at, 'ended_at', v_route.ended_at,
                            'points_n', v_route.points_n, 'distance_m', v_route.distance_m,
                            'stops', coalesce(jsonb_array_length(v_route.stops), 0));
end;
$$;
revoke all on function public.tintero_route_end(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.tintero_route_end(uuid, timestamptz, jsonb) to authenticated;

-- Borrar un recorrido propio con todos sus puntos (derecho de supresión)
create or replace function public.tintero_route_delete(p_route_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tintero_routes where id = p_route_id and tintero_id = public.my_tintero_id();
  return found;
end;
$$;
revoke all on function public.tintero_route_delete(uuid) from public, anon;
grant execute on function public.tintero_route_delete(uuid) to authenticated;

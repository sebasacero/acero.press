-- Recorridos que levanta el equipo en el estudio de calle, además de los que
-- graba el tintero con Mi ruta. Dos maneras, sin que el tintero instale nada:
--   · 'relato'     : el tintero cuenta por dónde pasa y el equipo lo marca en el mapa
--   · 'acompanado' : el equipo camina con él y su celular graba el trazo
-- Lo de Mi ruta queda como 'gps'. El mapa de calor de Recorridos (app Micra,
-- Estudio) cuenta cuántos carritos distintos pasan por cada sector.

set lock_timeout = '5s';

alter table public.tintero_routes
  add column if not exists source text not null default 'gps',
  add column if not exists recorded_by uuid references auth.users(id) on delete set null;

alter table public.tintero_routes drop constraint if exists tintero_routes_source_check;
alter table public.tintero_routes add constraint tintero_routes_source_check
  check (source in ('gps', 'relato', 'acompanado'));

-- Un recorrido del equipo: entra completo (ya terminado) en una sola llamada.
-- El mismo client_ref reintentado devuelve el que ya estaba (sin duplicar).
create or replace function public.tintero_route_team(
  p_tintero_id uuid,
  p_client_ref text,
  p_source     text,
  p_path       jsonb,
  p_started_at timestamptz default null,
  p_ended_at   timestamptz default null,
  p_distance_m integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id   uuid;
  v_n    integer;
  v_from timestamptz := coalesce(p_started_at, now());
  v_to   timestamptz := coalesce(p_ended_at, v_from);
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo registra recorridos del estudio.' using errcode = '42501';
  end if;
  if p_source not in ('relato', 'acompanado') then
    raise exception 'Origen del recorrido no válido: %', p_source using errcode = '22023';
  end if;
  if p_path is null or jsonb_typeof(p_path) <> 'array' then
    raise exception 'El recorrido no trae puntos.' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_path);
  if v_n < 2 or v_n > 400 then
    raise exception 'Un recorrido lleva entre 2 y 400 puntos (trae %).', v_n using errcode = '22023';
  end if;
  -- Cada punto es [lng, lat] dentro de Bogotá y alrededores (la misma caja de los puntos de Mi ruta)
  if exists (
    select 1 from jsonb_array_elements(p_path) p
    where jsonb_typeof(p) <> 'array'
       or jsonb_array_length(p) <> 2
       or (p->>1)::double precision not between 4.3 and 5.0
       or (p->>0)::double precision not between -74.4 and -73.8
  ) then
    raise exception 'Hay puntos del recorrido fuera de Bogotá.' using errcode = '22023';
  end if;

  select id into v_id from public.tintero_routes where client_ref = p_client_ref;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'replay', true);
  end if;

  insert into public.tintero_routes (tintero_id, client_ref, started_at, ended_at, points_n, distance_m, path, source, recorded_by)
  values (p_tintero_id, p_client_ref, v_from, greatest(v_to, v_from), v_n, p_distance_m, p_path, p_source, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'replay', false);
end;
$$;

revoke all on function public.tintero_route_team(uuid, text, text, jsonb, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.tintero_route_team(uuid, text, text, jsonb, timestamptz, timestamptz, integer) to authenticated;

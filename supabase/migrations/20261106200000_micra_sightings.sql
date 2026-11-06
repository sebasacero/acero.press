-- Avistamientos del estudio de calle (6 nov 2026, pedido del usuario): en Equipo ›
-- Estudio, un botón de GPS para marcar al pasar a alguien tomando tinto en la calle
-- (la demanda que se ve). El puesto que se ve al pasar va como ficha rápida (tabla
-- tinteros, por la API); aquí solo queda «alguien tomando tinto».
--  · Solo el equipo (is_admin) marca y lee. Sin nombre, foto ni nada de la persona:
--    el punto redondeado a 0,0005° (~55 m), la hora y cuántas personas.
--  · client_ref: el mismo toque reintentado sin señal no se cuenta dos veces.
-- Idempotente.
set lock_timeout = '5s';

create table if not exists public.micra_sightings (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'tomando' check (kind in ('tomando')),
  people smallint not null default 1 check (people between 1 and 20),
  lat numeric(8, 5) not null,
  lng numeric(8, 5) not null,
  accuracy_m integer,
  client_ref text not null unique check (length(client_ref) between 6 and 64),
  created_by uuid default auth.uid(),
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.micra_sightings enable row level security;
-- Sin políticas: solo por las funciones de abajo
revoke all on public.micra_sightings from anon, authenticated;
create index if not exists micra_sightings_seen_idx on public.micra_sightings (seen_at desc);

create or replace function public.micra_sighting_add(
  p_lat double precision, p_lng double precision, p_accuracy integer default null,
  p_client_ref text default null, p_people integer default 1, p_seen_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.micra_sightings;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo.' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat not between 4.3 and 5.0 or p_lng not between -74.4 and -73.9 then
    raise exception 'Ese punto no está en Bogotá.' using errcode = '22023';
  end if;
  insert into public.micra_sightings (people, lat, lng, accuracy_m, client_ref, seen_at)
  values (
    greatest(1, least(20, coalesce(p_people, 1))),
    round((p_lat / 0.0005)::numeric) * 0.0005,
    round((p_lng / 0.0005)::numeric) * 0.0005,
    case when p_accuracy between 0 and 5000 then p_accuracy end,
    coalesce(nullif(p_client_ref, ''), gen_random_uuid()::text),
    -- Lo que esperó en el celular sin señal guarda su hora, pero no del futuro ni de hace más de 2 días
    case when p_seen_at between now() - interval '2 days' and now() + interval '5 minutes' then p_seen_at else now() end
  )
  on conflict (client_ref) do update set client_ref = excluded.client_ref
  returning * into r;
  return jsonb_build_object('id', r.id, 'lat', r.lat, 'lng', r.lng, 'at', r.seen_at);
end;
$$;
revoke all on function public.micra_sighting_add(double precision, double precision, integer, text, integer, timestamptz) from public, anon;
grant execute on function public.micra_sighting_add(double precision, double precision, integer, text, integer, timestamptz) to authenticated;

create or replace function public.micra_sightings(p_days int default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('lat', s.lat, 'lng', s.lng, 'at', s.seen_at, 'people', s.people) order by s.seen_at desc)
      from public.micra_sightings s
     where s.seen_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.micra_sightings(int) from public, anon;
grant execute on function public.micra_sightings(int) to authenticated;

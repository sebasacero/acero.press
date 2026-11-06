-- La foto de la venta (6 nov 2026, pedido del usuario): el barista toca la cámara
-- de su barra, le toma la foto al cliente con su vasito y la manda como cualquier
-- publicación (revisión del equipo → Hoy y «Tus publicaciones»). Además guarda dónde
-- se vendió, para ver en Estudio el mapa de dónde se toman estas fotos.
--  · El punto se redondea a 0,0005° (~55 m): sirve para el mapa por cuadra y no
--    marca el portón de nadie. Solo dentro de Bogotá y sus alrededores.
--  · Se pone una vez, solo el dueño de la publicación (o el equipo actuando por él)
--    y en los 15 minutos después de publicarla.
--  · micra_post_points: solo el equipo; puntos y fecha, sin nombre, texto ni foto.
-- Idempotente.
set lock_timeout = '5s';

alter table public.micra_posts add column if not exists lat numeric(8, 5);
alter table public.micra_posts add column if not exists lng numeric(8, 5);
alter table public.micra_posts add column if not exists sale boolean not null default false;
create index if not exists micra_posts_place_idx on public.micra_posts (created_at desc) where lat is not null;

create or replace function public.micra_post_place(p_id uuid, p_lat double precision, p_lng double precision, p_tintero_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  r public.micra_posts;
begin
  if p_lat is null or p_lng is null or p_lat not between 4.3 and 5.0 or p_lng not between -74.4 and -73.9 then
    raise exception 'Ese punto no está en Bogotá.' using errcode = '22023';
  end if;
  update public.micra_posts
     set lat = round((p_lat / 0.0005)::numeric) * 0.0005,
         lng = round((p_lng / 0.0005)::numeric) * 0.0005,
         sale = true
   where id = p_id and tintero_id = v and lat is null and created_at > now() - interval '15 minutes'
  returning * into r;
  if r.id is null then
    raise exception 'Esa publicación no se puede ubicar.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', r.id, 'lat', r.lat, 'lng', r.lng);
end;
$$;
revoke all on function public.micra_post_place(uuid, double precision, double precision, uuid) from public, anon;
grant execute on function public.micra_post_place(uuid, double precision, double precision, uuid) to authenticated;

create or replace function public.micra_post_points(p_days int default 90)
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
    select jsonb_agg(jsonb_build_object('lat', p.lat, 'lng', p.lng, 'at', p.created_at, 'status', p.status) order by p.created_at desc)
      from public.micra_posts p
     where p.lat is not null and p.status <> 'removed'
       and p.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 365))
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.micra_post_points(int) from public, anon;
grant execute on function public.micra_post_points(int) to authenticated;

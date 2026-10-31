-- Publicaciones de los baristas en Hoy (31 oct 2026): el barista sube una foto o
-- un video desde la app con su texto; queda en revisión y el equipo la aprueba
-- antes de que salga en el muro, que ven clientes y baristas.
--  · Tabla micra_posts sin políticas: todo pasa por las funciones de abajo.
--  · Bucket privado micra-posts: cada barista sube solo a su carpeta (<su id>/…);
--    cualquiera puede leer solo lo aprobado (con URL firmada); el barista ve lo
--    suyo y el equipo todo.
--  · En el muro solo salen baristas públicos (ad_consent), con su nombre de pila.
-- Idempotente.
set lock_timeout = '5s';

create table if not exists public.micra_posts (
  id          uuid primary key default gen_random_uuid(),
  tintero_id  uuid not null references public.tinteros(id) on delete cascade,
  kind        text not null check (kind in ('foto', 'video')),
  media_path  text not null unique,
  caption     text check (caption is null or char_length(caption) <= 280),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'removed')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index if not exists micra_posts_feed_idx on public.micra_posts (reviewed_at desc) where status = 'approved';
create index if not exists micra_posts_tintero_idx on public.micra_posts (tintero_id, created_at desc);
create index if not exists micra_posts_pending_idx on public.micra_posts (created_at) where status = 'pending';
alter table public.micra_posts enable row level security;
revoke all on table public.micra_posts from anon, authenticated;

-- ── El bucket: privado, hasta 25 MB, solo fotos y videos ────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('micra-posts', 'micra-posts', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ¿Este archivo es de una publicación aprobada? (la tabla no se lee desde fuera)
create or replace function public.micra_post_public(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.micra_posts where media_path = p_path and status = 'approved');
$$;
revoke all on function public.micra_post_public(text) from public;
grant execute on function public.micra_post_public(text) to anon, authenticated;

drop policy if exists "cualquiera ve publicaciones aprobadas" on storage.objects;
create policy "cualquiera ve publicaciones aprobadas" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'micra-posts' and public.micra_post_public(name));

drop policy if exists "el barista y el equipo ven sus publicaciones" on storage.objects;
create policy "el barista y el equipo ven sus publicaciones" on storage.objects
  for select to authenticated
  using (bucket_id = 'micra-posts' and (public.is_admin() or (storage.foldername(name))[1] = public.my_tintero_id()::text));

drop policy if exists "el barista sube a su carpeta" on storage.objects;
create policy "el barista sube a su carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'micra-posts' and (public.is_admin() or (storage.foldername(name))[1] = public.my_tintero_id()::text));

drop policy if exists "el barista y el equipo borran sus publicaciones" on storage.objects;
create policy "el barista y el equipo borran sus publicaciones" on storage.objects
  for delete to authenticated
  using (bucket_id = 'micra-posts' and (public.is_admin() or (storage.foldername(name))[1] = public.my_tintero_id()::text));

-- ── Publicar: queda en revisión ─────────────────────────────────────────
create or replace function public.micra_post_add(p_kind text, p_path text, p_caption text default null, p_tintero_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  cap text := nullif(btrim(regexp_replace(coalesce(p_caption, ''), '\s+', ' ', 'g')), '');
  r public.micra_posts;
begin
  if p_kind not in ('foto', 'video') then
    raise exception 'Solo fotos o videos.' using errcode = '22023';
  end if;
  -- Solo su carpeta y un nombre de archivo sencillo
  if p_path !~ ('^' || v::text || '/[A-Za-z0-9_-]{6,64}\.(jpg|jpeg|png|webp|mp4|mov|webm)$') then
    raise exception 'Ese archivo no es tuyo.' using errcode = '42501';
  end if;
  if char_length(coalesce(cap, '')) > 280 then
    raise exception 'El texto va hasta 280 letras.' using errcode = '22023';
  end if;
  -- Hasta 10 al día por barista
  if (select count(*) from public.micra_posts where tintero_id = v and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Ya enviaste 10 publicaciones hoy. Mañana puedes enviar más.' using errcode = '54000';
  end if;
  insert into public.micra_posts (tintero_id, kind, media_path, caption)
  values (v, p_kind, p_path, cap)
  returning * into r;
  return jsonb_build_object('id', r.id, 'kind', r.kind, 'media_path', r.media_path, 'caption', r.caption, 'status', r.status, 'created_at', r.created_at);
end;
$$;
revoke all on function public.micra_post_add(text, text, text, uuid) from public, anon;
grant execute on function public.micra_post_add(text, text, text, uuid) to authenticated;

-- ── El muro: lo aprobado de los baristas públicos ───────────────────────
create or replace function public.micra_posts_feed(p_limit int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(s.j order by s.at desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', p.id, 'tintero_id', p.tintero_id, 'name', split_part(btrim(t.name), ' ', 1),
      'referencia', coalesce(t.referencia, t.zone), 'kind', p.kind, 'media_path', p.media_path,
      'caption', p.caption, 'created_at', p.created_at
    ) as j, coalesce(p.reviewed_at, p.created_at) as at
    from public.micra_posts p
    join public.tinteros t on t.id = p.tintero_id
    where p.status = 'approved' and t.ad_consent is true
    order by coalesce(p.reviewed_at, p.created_at) desc
    limit least(greatest(coalesce(p_limit, 30), 1), 60)
  ) s;
$$;
revoke all on function public.micra_posts_feed(int) from public;
grant execute on function public.micra_posts_feed(int) to anon, authenticated;

-- ── Las del barista, con su estado ──────────────────────────────────────
create or replace function public.micra_posts_mine(p_tintero_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'kind', p.kind, 'media_path', p.media_path, 'caption', p.caption,
    'status', p.status, 'created_at', p.created_at
  ) order by p.created_at desc), '[]'::jsonb)
  from (
    select * from public.micra_posts
    where tintero_id = public.micra_actor(p_tintero_id) and status <> 'removed'
    order by created_at desc limit 20
  ) p;
$$;
revoke all on function public.micra_posts_mine(uuid) from public, anon;
grant execute on function public.micra_posts_mine(uuid) to authenticated;

-- ── El equipo revisa ────────────────────────────────────────────────────
create or replace function public.micra_posts_pending()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo revisa las publicaciones.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'tintero_id', p.tintero_id, 'name', t.name, 'public', t.ad_consent is true,
      'kind', p.kind, 'media_path', p.media_path, 'caption', p.caption, 'created_at', p.created_at
    ) order by p.created_at), '[]'::jsonb)
    from public.micra_posts p
    join public.tinteros t on t.id = p.tintero_id
    where p.status = 'pending'
  );
end;
$$;
revoke all on function public.micra_posts_pending() from public, anon;
grant execute on function public.micra_posts_pending() to authenticated;

create or replace function public.micra_post_review(p_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.micra_posts;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo revisa las publicaciones.' using errcode = '42501';
  end if;
  update public.micra_posts
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_id and status = 'pending'
  returning * into r;
  if r.id is null then
    raise exception 'Esa publicación ya se revisó o no existe.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', r.id, 'status', r.status);
end;
$$;
revoke all on function public.micra_post_review(uuid, boolean) from public, anon;
grant execute on function public.micra_post_review(uuid, boolean) to authenticated;

-- ── Quitarla: el barista la suya, el equipo cualquiera ──────────────────
create or replace function public.micra_post_remove(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.micra_posts;
begin
  update public.micra_posts set status = 'removed'
   where id = p_id and status <> 'removed'
     and (public.is_admin() or tintero_id = public.my_tintero_id())
  returning * into r;
  if r.id is null then
    raise exception 'No puedes quitar esa publicación.' using errcode = '42501';
  end if;
  return jsonb_build_object('id', r.id, 'status', r.status, 'media_path', r.media_path);
end;
$$;
revoke all on function public.micra_post_remove(uuid) from public, anon;
grant execute on function public.micra_post_remove(uuid) to authenticated;

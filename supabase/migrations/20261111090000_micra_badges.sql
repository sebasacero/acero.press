-- La insignia del termo, el primer requisito de todo barista (pedido del usuario, 10 nov 2026):
-- ve las lecciones del termo en Aprende, se graba sirviendo un tinto y el equipo lo verifica.
-- El video va al bucket privado `micra-posts`, en la carpeta del barista (mismas políticas de
-- 20261031160000_micra_barista_posts.sql); esta tabla guarda la solicitud y su revisión.
-- Idempotente. Sin políticas: todo pasa por las funciones de abajo.

set lock_timeout = '5s';

create table if not exists public.micra_badge_requests (
  id uuid primary key default gen_random_uuid(),
  tintero_id uuid not null references public.tinteros(id) on delete cascade,
  badge text not null check (badge in ('termo')),
  media_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index if not exists micra_badge_requests_tintero on public.micra_badge_requests (tintero_id, badge, created_at desc);
create index if not exists micra_badge_requests_pending on public.micra_badge_requests (created_at) where status = 'pending';
alter table public.micra_badge_requests enable row level security;
revoke all on table public.micra_badge_requests from anon, authenticated;

-- ── El barista manda su video ─────────────────────────────────────────────
create or replace function public.micra_badge_request(p_badge text, p_path text, p_tintero_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  r public.micra_badge_requests;
begin
  if p_badge is distinct from 'termo' then
    raise exception 'Esa insignia no existe.' using errcode = '22023';
  end if;
  -- Solo su carpeta y un video
  if p_path !~ ('^' || v::text || '/[A-Za-z0-9_-]{6,64}\.(mp4|mov|webm)$') then
    raise exception 'Ese video no es tuyo.' using errcode = '42501';
  end if;
  if exists (select 1 from public.micra_badge_requests where tintero_id = v and badge = p_badge and status in ('pending', 'approved')) then
    raise exception 'Tu video ya está con el equipo o la insignia ya es tuya.' using errcode = '23505';
  end if;
  -- Hasta 3 intentos al día
  if (select count(*) from public.micra_badge_requests where tintero_id = v and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Ya mandaste 3 videos hoy. Mañana puedes volver a intentarlo.' using errcode = '54000';
  end if;
  insert into public.micra_badge_requests (tintero_id, badge, media_path)
  values (v, p_badge, p_path)
  returning * into r;
  return jsonb_build_object('id', r.id, 'badge', r.badge, 'status', r.status, 'created_at', r.created_at);
end;
$$;
revoke all on function public.micra_badge_request(text, text, uuid) from public, anon;
grant execute on function public.micra_badge_request(text, text, uuid) to authenticated;

-- ── Cómo va cada insignia del barista (la última solicitud de cada una) ──
create or replace function public.micra_badges_mine(p_tintero_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v uuid := public.micra_actor(p_tintero_id);
begin
  return (
    select coalesce(jsonb_object_agg(badge, jsonb_build_object('status', status, 'note', note, 'at', coalesce(reviewed_at, created_at))), '{}'::jsonb)
    from (
      select distinct on (badge) badge, status, note, created_at, reviewed_at
      from public.micra_badge_requests
      where tintero_id = v
      -- Una aprobada gana sobre un intento posterior
      order by badge, (status = 'approved') desc, created_at desc
    ) x
  );
end;
$$;
revoke all on function public.micra_badges_mine(uuid) from public, anon;
grant execute on function public.micra_badges_mine(uuid) to authenticated;

-- ── El equipo: lo que espera revisión ─────────────────────────────────────
create or replace function public.micra_badges_pending()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo verifica las insignias.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'tintero_id', b.tintero_id, 'name', t.name, 'badge', b.badge,
      'media_path', b.media_path, 'created_at', b.created_at
    ) order by b.created_at), '[]'::jsonb)
    from public.micra_badge_requests b
    join public.tinteros t on t.id = b.tintero_id
    where b.status = 'pending'
  );
end;
$$;
revoke all on function public.micra_badges_pending() from public, anon;
grant execute on function public.micra_badges_pending() to authenticated;

create or replace function public.micra_badge_review(p_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.micra_badge_requests;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo verifica las insignias.' using errcode = '42501';
  end if;
  update public.micra_badge_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         note = nullif(left(btrim(coalesce(p_note, '')), 200), ''),
         reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_id and status = 'pending'
  returning * into r;
  if r.id is null then
    raise exception 'Ese video ya se revisó o no existe.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', r.id, 'status', r.status);
end;
$$;
revoke all on function public.micra_badge_review(uuid, boolean, text) from public, anon;
grant execute on function public.micra_badge_review(uuid, boolean, text) to authenticated;

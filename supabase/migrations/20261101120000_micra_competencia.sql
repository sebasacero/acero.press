-- Competencia: el reto de la semana (1 nov 2026). El equipo abre un reto
-- (p. ej. «Arte latte: tu mejor corazón»), los baristas entran con una foto
-- (una publicación más: pasa por la revisión del equipo y sale en Hoy con
-- «Reto»), y clientes y baristas la califican de 1 a 5 granos. Podio con 3
-- votos o más, retos pasados con su ganador y los trofeos de cada barista.
--  · Un voto por celular por entrada: se guarda sha256(llave | reto), nunca
--    la llave; se puede cambiar. El barista no califica su propia entrada.
--  · Una entrada por barista por reto (se puede volver a entrar si la rechazan).
-- Idempotente.
set lock_timeout = '5s';

create table if not exists public.micra_challenges (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 2 and 80),
  brief       text check (brief is null or char_length(brief) <= 280),
  kind        text not null default 'arte_latte' check (kind in ('arte_latte', 'foto')),
  prize       text check (prize is null or char_length(prize) <= 120),
  starts_on   date not null,
  ends_on     date not null,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists micra_challenges_dates_idx on public.micra_challenges (starts_on, ends_on);
alter table public.micra_challenges enable row level security;
revoke all on table public.micra_challenges from anon, authenticated;

alter table public.micra_posts add column if not exists challenge_id uuid references public.micra_challenges(id) on delete set null;
create unique index if not exists micra_posts_entry_idx on public.micra_posts (tintero_id, challenge_id)
  where challenge_id is not null and status in ('pending', 'approved');

create table if not exists public.micra_votes (
  post_id     uuid not null references public.micra_posts(id) on delete cascade,
  voter_hash  text not null,
  score       int not null check (score between 1 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (post_id, voter_hash)
);
create index if not exists micra_votes_hash_idx on public.micra_votes (voter_hash, created_at desc);
alter table public.micra_votes enable row level security;
revoke all on table public.micra_votes from anon, authenticated;

-- ── El reto abierto hoy (el más reciente si hay varios) ─────────────────
create or replace function public.micra_challenge_now()
returns public.micra_challenges
language sql
stable
security definer
set search_path = public
as $$
  select * from public.micra_challenges
  where public.micra_today() between starts_on and ends_on
  order by starts_on desc, created_at desc limit 1;
$$;
revoke all on function public.micra_challenge_now() from public, anon, authenticated;

-- ── El ganador de un reto: mejor promedio con 3 votos o más (empate: más votos) ──
create or replace function public.micra_challenge_winner(p_challenge_id uuid)
returns table (post_id uuid, tintero_id uuid, avg numeric, n int)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.tintero_id, s.avg, s.n
  from public.micra_posts p
  join lateral (select count(*)::int n, round(avg(v.score)::numeric, 2) avg from public.micra_votes v where v.post_id = p.id) s on true
  where p.challenge_id = p_challenge_id and p.status = 'approved' and s.n >= 3
  order by s.avg desc, s.n desc, p.created_at
  limit 1;
$$;
revoke all on function public.micra_challenge_winner(uuid) from public, anon, authenticated;

-- ── Entrar al reto: la publicación lleva el reto (misma función, un parámetro más) ──
drop function if exists public.micra_post_add(text, text, text, uuid);
create or replace function public.micra_post_add(p_kind text, p_path text, p_caption text default null, p_tintero_id uuid default null, p_challenge_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  cap text := nullif(btrim(regexp_replace(coalesce(p_caption, ''), '\s+', ' ', 'g')), '');
  c public.micra_challenges;
  r public.micra_posts;
begin
  if p_kind not in ('foto', 'video') then
    raise exception 'Solo fotos o videos.' using errcode = '22023';
  end if;
  if p_path !~ ('^' || v::text || '/[A-Za-z0-9_-]{6,64}\.(jpg|jpeg|png|webp|mp4|mov|webm)$') then
    raise exception 'Ese archivo no es tuyo.' using errcode = '42501';
  end if;
  if char_length(coalesce(cap, '')) > 280 then
    raise exception 'El texto va hasta 280 letras.' using errcode = '22023';
  end if;
  if (select count(*) from public.micra_posts where tintero_id = v and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Ya enviaste 10 publicaciones hoy. Mañana puedes enviar más.' using errcode = '54000';
  end if;
  if p_challenge_id is not null then
    c := public.micra_challenge_now();
    if c.id is null or c.id <> p_challenge_id then
      raise exception 'Ese reto ya no está abierto.' using errcode = 'P0002';
    end if;
    if p_kind <> 'foto' then
      raise exception 'Al reto se entra con una foto.' using errcode = '22023';
    end if;
    if exists (select 1 from public.micra_posts where tintero_id = v and challenge_id = c.id and status in ('pending', 'approved')) then
      raise exception 'Ya tienes una entrada en este reto.' using errcode = '23505';
    end if;
  end if;
  insert into public.micra_posts (tintero_id, kind, media_path, caption, challenge_id)
  values (v, p_kind, p_path, cap, p_challenge_id)
  returning * into r;
  return jsonb_build_object('id', r.id, 'kind', r.kind, 'media_path', r.media_path, 'caption', r.caption, 'status', r.status, 'created_at', r.created_at, 'challenge_id', r.challenge_id);
end;
$$;
revoke all on function public.micra_post_add(text, text, text, uuid, uuid) from public, anon;
grant execute on function public.micra_post_add(text, text, text, uuid, uuid) to authenticated;

-- El muro y la revisión dicen si una publicación es del reto
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
      'caption', p.caption, 'created_at', p.created_at, 'challenge_id', p.challenge_id
    ) as j, coalesce(p.reviewed_at, p.created_at) as at
    from public.micra_posts p
    join public.tinteros t on t.id = p.tintero_id
    where p.status = 'approved' and t.ad_consent is true
    order by coalesce(p.reviewed_at, p.created_at) desc
    limit least(greatest(coalesce(p_limit, 30), 1), 60)
  ) s;
$$;

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
      'kind', p.kind, 'media_path', p.media_path, 'caption', p.caption, 'created_at', p.created_at,
      'challenge', (select c.title from public.micra_challenges c where c.id = p.challenge_id)
    ) order by p.created_at), '[]'::jsonb)
    from public.micra_posts p
    join public.tinteros t on t.id = p.tintero_id
    where p.status = 'pending'
  );
end;
$$;

-- ── Calificar: 1 a 5 granos, un voto por celular por entrada (se puede cambiar) ──
create or replace function public.micra_vote(p_post_id uuid, p_ref text, p_score int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
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
  insert into public.micra_votes (post_id, voter_hash, score) values (p.id, h, p_score)
  on conflict (post_id, voter_hash) do update set score = excluded.score, updated_at = now();
  return jsonb_build_object(
    'post_id', p.id, 'my_score', p_score,
    'votes', (select count(*) from public.micra_votes where post_id = p.id),
    'avg', (select round(avg(score)::numeric, 2) from public.micra_votes where post_id = p.id)
  );
end;
$$;
revoke all on function public.micra_vote(uuid, text, int) from public;
grant execute on function public.micra_vote(uuid, text, int) to anon, authenticated;

-- ── El reto para todos: el abierto con sus entradas y mi nota, los pasados con su ganador ──
create or replace function public.micra_challenge(p_ref text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.micra_challenges := public.micra_challenge_now();
  d date := public.micra_today();
  me uuid := public.my_tintero_id();
  h text;
begin
  if c.id is not null and p_ref is not null then
    h := encode(sha256(convert_to(p_ref || '|' || c.id::text, 'UTF8')), 'hex');
  end if;
  return jsonb_build_object(
    'challenge', case when c.id is null then null else jsonb_build_object(
      'id', c.id, 'title', c.title, 'brief', c.brief, 'kind', c.kind, 'prize', c.prize,
      'starts_on', c.starts_on, 'ends_on', c.ends_on, 'days_left', (c.ends_on - d)
    ) end,
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'tintero_id', p.tintero_id, 'name', split_part(btrim(t.name), ' ', 1),
        'media_path', p.media_path, 'caption', p.caption, 'created_at', p.created_at,
        'votes', s.n, 'avg', s.avg,
        'my_score', (select v.score from public.micra_votes v where h is not null and v.post_id = p.id and v.voter_hash = h),
        'mine', (me is not null and me = p.tintero_id)
      ) order by s.avg desc nulls last, s.n desc, p.created_at), '[]'::jsonb)
      from public.micra_posts p
      join public.tinteros t on t.id = p.tintero_id
      left join lateral (select count(*)::int n, round(avg(v.score)::numeric, 2) avg from public.micra_votes v where v.post_id = p.id) s on true
      where c.id is not null and p.challenge_id = c.id and p.status = 'approved' and t.ad_consent is true
    ),
    'my_entry', (
      select jsonb_build_object('id', p.id, 'status', p.status, 'media_path', p.media_path)
      from public.micra_posts p
      where me is not null and c.id is not null and p.challenge_id = c.id and p.tintero_id = me and p.status in ('pending', 'approved')
      limit 1
    ),
    'past', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ch.id, 'title', ch.title, 'ends_on', ch.ends_on,
        'winner', (
          select jsonb_build_object('post_id', w.post_id, 'tintero_id', w.tintero_id, 'name', split_part(btrim(t.name), ' ', 1), 'media_path', p.media_path, 'avg', w.avg, 'votes', w.n)
          from public.micra_challenge_winner(ch.id) w
          join public.micra_posts p on p.id = w.post_id
          join public.tinteros t on t.id = w.tintero_id
        )
      ) order by ch.ends_on desc), '[]'::jsonb)
      from (select * from public.micra_challenges where ends_on < d order by ends_on desc limit 6) ch
    ),
    'my_wins', case when me is null then 0 else (
      select count(*) from public.micra_challenges ch
      where ch.ends_on < d and exists (select 1 from public.micra_challenge_winner(ch.id) w where w.tintero_id = me)
    ) end
  );
end;
$$;
revoke all on function public.micra_challenge(text) from public;
grant execute on function public.micra_challenge(text) to anon, authenticated;

-- ── El equipo: todos los retos con sus cifras, y crear o cambiar uno ────
create or replace function public.micra_challenges_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare d date := public.micra_today();
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo maneja los retos.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'entries', (select count(*) from public.micra_posts p where p.challenge_id = c.id and p.status = 'approved'),
      'pending', (select count(*) from public.micra_posts p where p.challenge_id = c.id and p.status = 'pending'),
      'votes', (select count(*) from public.micra_votes v join public.micra_posts p on p.id = v.post_id where p.challenge_id = c.id),
      'state', case when d < c.starts_on then 'soon' when d > c.ends_on then 'done' else 'open' end
    ) order by c.ends_on desc, c.created_at desc), '[]'::jsonb)
    from public.micra_challenges c
  );
end;
$$;
revoke all on function public.micra_challenges_admin() from public, anon;
grant execute on function public.micra_challenges_admin() to authenticated;

create or replace function public.micra_challenge_save(p_id uuid, p_ch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.micra_challenges;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo maneja los retos.' using errcode = '42501';
  end if;
  if p_id is null then
    insert into public.micra_challenges (title, brief, kind, prize, starts_on, ends_on)
    values (btrim(p_ch->>'title'), nullif(btrim(p_ch->>'brief'), ''), coalesce(p_ch->>'kind', 'arte_latte'), nullif(btrim(p_ch->>'prize'), ''), (p_ch->>'starts_on')::date, (p_ch->>'ends_on')::date)
    returning * into r;
  else
    update public.micra_challenges set
      title = btrim(p_ch->>'title'), brief = nullif(btrim(p_ch->>'brief'), ''), kind = coalesce(p_ch->>'kind', kind),
      prize = nullif(btrim(p_ch->>'prize'), ''), starts_on = (p_ch->>'starts_on')::date, ends_on = (p_ch->>'ends_on')::date
    where id = p_id
    returning * into r;
    if r.id is null then raise exception 'Ese reto no existe.' using errcode = 'P0002'; end if;
  end if;
  return to_jsonb(r);
end;
$$;
revoke all on function public.micra_challenge_save(uuid, jsonb) from public, anon;
grant execute on function public.micra_challenge_save(uuid, jsonb) to authenticated;

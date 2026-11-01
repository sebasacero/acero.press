-- El juez de arte latte (1 nov 2026): el puntaje automático que calcula el
-- celular (arteLatte.js) queda con la entrada, y el equipo califica como
-- jurado los mismos seis criterios de 0 a 10. Con los granos de la gente, eso
-- es el conjunto para entrenar el modelo propio después.
--  · micra_posts.judge: { v, score (0–100), scores: {criterio: 0–10} } del celular.
--  · micra_judge_scores: el juicio del equipo, uno por jurado y entrada.
-- Idempotente.
set lock_timeout = '5s';

alter table public.micra_posts add column if not exists judge jsonb;

create table if not exists public.micra_judge_scores (
  post_id     uuid not null references public.micra_posts(id) on delete cascade,
  judge_user  uuid not null,
  scores      jsonb not null,
  total       numeric not null check (total between 0 and 100),
  note        text check (note is null or char_length(note) <= 280),
  created_at  timestamptz not null default now(),
  primary key (post_id, judge_user)
);
alter table public.micra_judge_scores enable row level security;
revoke all on table public.micra_judge_scores from anon, authenticated;

-- Los criterios y sus pesos, los mismos de arteLatte.js (suma 100)
create or replace function public.micra_judge_total(p_scores jsonb)
returns numeric
language plpgsql
immutable
as $$
declare
  k text; w numeric; v numeric; total numeric := 0;
  weights jsonb := '{"contraste":20,"definicion":20,"simetria":20,"centrado":15,"tamano":15,"limpieza":10}'::jsonb;
begin
  for k, w in select key, value::numeric from jsonb_each_text(weights) loop
    v := (p_scores->>k)::numeric;
    if v is null or v < 0 or v > 10 then
      raise exception 'Cada criterio va de 0 a 10 (%).', k using errcode = '22023';
    end if;
    total := total + v * w;
  end loop;
  return round(total / 10, 1);
end;
$$;
revoke all on function public.micra_judge_total(jsonb) from public, anon, authenticated;

-- ── Publicar, ahora con el puntaje del juez del celular (opcional) ───────
drop function if exists public.micra_post_add(text, text, text, uuid, uuid);
create or replace function public.micra_post_add(p_kind text, p_path text, p_caption text default null, p_tintero_id uuid default null, p_challenge_id uuid default null, p_judge jsonb default null)
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
  j jsonb := null;
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
  -- El puntaje del celular: solo si trae lo esperado (se guarda limpio, nunca tal cual llega)
  if p_judge is not null and jsonb_typeof(p_judge->'scores') = 'object' and (p_judge->>'score') ~ '^[0-9]{1,3}$' and (p_judge->>'score')::int between 0 and 100 then
    j := jsonb_build_object('v', 1, 'score', (p_judge->>'score')::int, 'scores', p_judge->'scores', 'total', public.micra_judge_total(p_judge->'scores'));
  end if;
  insert into public.micra_posts (tintero_id, kind, media_path, caption, challenge_id, judge)
  values (v, p_kind, p_path, cap, p_challenge_id, j)
  returning * into r;
  return jsonb_build_object('id', r.id, 'kind', r.kind, 'media_path', r.media_path, 'caption', r.caption, 'status', r.status, 'created_at', r.created_at, 'challenge_id', r.challenge_id, 'judge', r.judge);
end;
$$;
revoke all on function public.micra_post_add(text, text, text, uuid, uuid, jsonb) from public, anon;
grant execute on function public.micra_post_add(text, text, text, uuid, uuid, jsonb) to authenticated;

-- ── El equipo califica como jurado ──────────────────────────────────────
create or replace function public.micra_judge_set(p_post_id uuid, p_scores jsonb, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo califica como jurado.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.micra_posts where id = p_post_id and challenge_id is not null) then
    raise exception 'Esa publicación no está en un reto.' using errcode = 'P0002';
  end if;
  t := public.micra_judge_total(p_scores);
  insert into public.micra_judge_scores (post_id, judge_user, scores, total, note)
  values (p_post_id, auth.uid(), p_scores, t, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (post_id, judge_user) do update set scores = excluded.scores, total = excluded.total, note = excluded.note, created_at = now();
  return jsonb_build_object('post_id', p_post_id, 'total', t,
    'team', (select round(avg(total), 1) from public.micra_judge_scores where post_id = p_post_id),
    'team_n', (select count(*) from public.micra_judge_scores where post_id = p_post_id));
end;
$$;
revoke all on function public.micra_judge_set(uuid, jsonb, text) from public, anon;
grant execute on function public.micra_judge_set(uuid, jsonb, text) to authenticated;

-- ── La competencia y la revisión muestran el juez del celular y el del equipo ──
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
        'mine', (me is not null and me = p.tintero_id),
        'judge', p.judge,
        'team', (select round(avg(total), 1) from public.micra_judge_scores js where js.post_id = p.id),
        'team_n', (select count(*) from public.micra_judge_scores js where js.post_id = p.id)
      ) order by s.avg desc nulls last, s.n desc, p.created_at), '[]'::jsonb)
      from public.micra_posts p
      join public.tinteros t on t.id = p.tintero_id
      left join lateral (select count(*)::int n, round(avg(v.score)::numeric, 2) avg from public.micra_votes v where v.post_id = p.id) s on true
      where c.id is not null and p.challenge_id = c.id and p.status = 'approved' and t.ad_consent is true
    ),
    'my_entry', (
      select jsonb_build_object('id', p.id, 'status', p.status, 'media_path', p.media_path, 'judge', p.judge)
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
      'challenge', (select c.title from public.micra_challenges c where c.id = p.challenge_id),
      'judge', p.judge,
      'my_judge', (select js.scores from public.micra_judge_scores js where js.post_id = p.id and js.judge_user = auth.uid())
    ) order by p.created_at), '[]'::jsonb)
    from public.micra_posts p
    join public.tinteros t on t.id = p.tintero_id
    where p.status = 'pending'
  );
end;
$$;

-- Anuncios «Patrocinado» en Micra, etapa 1 (31 oct 2026): el equipo carga el
-- anuncio que vendió (paquete por fechas), sale en Hoy como publicación o en la
-- fila de historias, y se cuentan vistas y toques por día. Solo cifras
-- agregadas: nunca quién lo vio. Las imágenes van en el bucket público
-- `marketing` (micra-ads/…), que ya solo deja subir al equipo.
-- Idempotente.
set lock_timeout = '5s';

create table if not exists public.micra_ads (
  id          uuid primary key default gen_random_uuid(),
  advertiser  text not null check (char_length(btrim(advertiser)) between 2 and 60),
  title       text not null check (char_length(btrim(title)) between 2 and 80),
  body        text check (body is null or char_length(body) <= 240),
  image_url   text check (image_url is null or image_url ~ '^https://'),
  cta_label   text not null default 'Ver más' check (char_length(btrim(cta_label)) between 2 and 24),
  cta_url     text not null check (cta_url ~ '^https://'),
  placement   text not null default 'feed' check (placement in ('feed', 'story')),
  audience    text not null default 'all' check (audience in ('all', 'client', 'barista')),
  -- Franja del día (hora de Bogotá, [desde, hasta)); sin franja, todo el día
  hour_from   int check (hour_from between 0 and 23),
  hour_to     int check (hour_to between 1 and 24),
  starts_on   date not null,
  ends_on     date not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on),
  check ((hour_from is null) = (hour_to is null) and (hour_from is null or hour_to > hour_from))
);
create index if not exists micra_ads_live_idx on public.micra_ads (starts_on, ends_on) where active;
alter table public.micra_ads enable row level security;
revoke all on table public.micra_ads from anon, authenticated;

create table if not exists public.micra_ad_stats (
  ad_id  uuid not null references public.micra_ads(id) on delete cascade,
  day    date not null,
  views  int not null default 0 check (views >= 0),
  taps   int not null default 0 check (taps >= 0),
  primary key (ad_id, day)
);
alter table public.micra_ad_stats enable row level security;
revoke all on table public.micra_ad_stats from anon, authenticated;

-- ── Lo que se ve hoy, según quién mira (cliente o barista) ──────────────
create or replace function public.micra_ads_live(p_audience text default 'client')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'advertiser', a.advertiser, 'title', a.title, 'body', a.body, 'image_url', a.image_url,
    'cta_label', a.cta_label, 'cta_url', a.cta_url, 'placement', a.placement,
    'hour_from', a.hour_from, 'hour_to', a.hour_to
  ) order by a.created_at desc), '[]'::jsonb)
  from public.micra_ads a
  where a.active
    and public.micra_today() between a.starts_on and a.ends_on
    and (a.audience = 'all' or a.audience = p_audience);
$$;
revoke all on function public.micra_ads_live(text) from public;
grant execute on function public.micra_ads_live(text) to anon, authenticated;

-- ── Una vista o un toque, sumado al día (sin quién) ─────────────────────
create or replace function public.micra_ad_event(p_ad_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d date := public.micra_today();
begin
  if p_kind not in ('view', 'tap') then
    raise exception 'Solo vistas o toques.' using errcode = '22023';
  end if;
  -- Solo cuenta lo que está al aire hoy
  if not exists (select 1 from public.micra_ads where id = p_ad_id and active and d between starts_on and ends_on) then
    return;
  end if;
  insert into public.micra_ad_stats as s (ad_id, day, views, taps)
  values (p_ad_id, d, (p_kind = 'view')::int, (p_kind = 'tap')::int)
  on conflict (ad_id, day) do update
    set views = s.views + excluded.views, taps = s.taps + excluded.taps;
end;
$$;
revoke all on function public.micra_ad_event(uuid, text) from public;
grant execute on function public.micra_ad_event(uuid, text) to anon, authenticated;

-- ── El equipo: todos los anuncios con sus cifras ────────────────────────
create or replace function public.micra_ads_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare d date := public.micra_today();
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo ve los anuncios.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object(
      'views', coalesce(s.views, 0), 'taps', coalesce(s.taps, 0), 'views_today', coalesce(s.today, 0),
      'live', a.active and d between a.starts_on and a.ends_on
    ) order by a.ends_on desc, a.created_at desc), '[]'::jsonb)
    from public.micra_ads a
    left join (
      select ad_id, sum(views)::int views, sum(taps)::int taps, sum(views) filter (where day = d)::int today
      from public.micra_ad_stats group by ad_id
    ) s on s.ad_id = a.id
  );
end;
$$;
revoke all on function public.micra_ads_admin() from public, anon;
grant execute on function public.micra_ads_admin() to authenticated;

-- ── Crear o cambiar un anuncio (p_id null: nuevo) ───────────────────────
create or replace function public.micra_ad_save(p_id uuid, p_ad jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.micra_ads;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo carga anuncios.' using errcode = '42501';
  end if;
  if p_id is null then
    insert into public.micra_ads (advertiser, title, body, image_url, cta_label, cta_url, placement, audience, hour_from, hour_to, starts_on, ends_on, active)
    values (
      btrim(p_ad->>'advertiser'), btrim(p_ad->>'title'), nullif(btrim(p_ad->>'body'), ''), nullif(p_ad->>'image_url', ''),
      coalesce(nullif(btrim(p_ad->>'cta_label'), ''), 'Ver más'), p_ad->>'cta_url',
      coalesce(p_ad->>'placement', 'feed'), coalesce(p_ad->>'audience', 'all'),
      (p_ad->>'hour_from')::int, (p_ad->>'hour_to')::int,
      (p_ad->>'starts_on')::date, (p_ad->>'ends_on')::date, coalesce((p_ad->>'active')::boolean, true)
    )
    returning * into r;
  else
    update public.micra_ads set
      advertiser = btrim(p_ad->>'advertiser'), title = btrim(p_ad->>'title'), body = nullif(btrim(p_ad->>'body'), ''),
      image_url = nullif(p_ad->>'image_url', ''), cta_label = coalesce(nullif(btrim(p_ad->>'cta_label'), ''), 'Ver más'),
      cta_url = p_ad->>'cta_url', placement = coalesce(p_ad->>'placement', 'feed'), audience = coalesce(p_ad->>'audience', 'all'),
      hour_from = (p_ad->>'hour_from')::int, hour_to = (p_ad->>'hour_to')::int,
      starts_on = (p_ad->>'starts_on')::date, ends_on = (p_ad->>'ends_on')::date,
      active = coalesce((p_ad->>'active')::boolean, active)
    where id = p_id
    returning * into r;
    if r.id is null then raise exception 'Ese anuncio no existe.' using errcode = 'P0002'; end if;
  end if;
  return to_jsonb(r);
end;
$$;
revoke all on function public.micra_ad_save(uuid, jsonb) from public, anon;
grant execute on function public.micra_ad_save(uuid, jsonb) to authenticated;

-- ── Pausar o volver a poner al aire ─────────────────────────────────────
create or replace function public.micra_ad_toggle(p_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.micra_ads;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo cambia los anuncios.' using errcode = '42501';
  end if;
  update public.micra_ads set active = p_active where id = p_id returning * into r;
  if r.id is null then raise exception 'Ese anuncio no existe.' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', r.id, 'active', r.active);
end;
$$;
revoke all on function public.micra_ad_toggle(uuid, boolean) from public, anon;
grant execute on function public.micra_ad_toggle(uuid, boolean) to authenticated;

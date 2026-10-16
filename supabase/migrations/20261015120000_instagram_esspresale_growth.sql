-- Conexión de Instagram renovable desde el panel, ventas de Esspresale y
-- métricas de redes para el agente de crecimiento.
--
-- Nada aquí guarda secretos de Meta (App ID / App Secret): esos viven en los
-- Secrets de las Edge Functions (META_APP_ID, META_APP_SECRET).

-- 1) Token de Instagram ------------------------------------------------------
-- Una fila por proveedor. Sin políticas RLS a propósito: solo las Edge
-- Functions (service role) pueden leer o escribir el token. El panel ve el
-- estado (sin el token) con la función get_instagram_status().
create table if not exists public.integration_tokens (
  provider      text primary key,              -- 'instagram'
  access_token  text not null,
  account_id    text,                          -- IG user id (Instagram) o IG business id (Facebook)
  username      text,
  token_kind    text not null,                 -- 'instagram_login' | 'facebook_login'
  expires_at    timestamptz,                   -- null = no vence (token de página)
  refreshed_at  timestamptz not null default now(),
  last_error    text,
  updated_at    timestamptz not null default now()
);
alter table public.integration_tokens enable row level security;

create or replace function public.get_instagram_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_admin() then null
    else (
      select jsonb_build_object(
        'connected', true,
        'username', username,
        'account_id', account_id,
        'token_kind', token_kind,
        'expires_at', expires_at,
        'refreshed_at', refreshed_at,
        'last_error', last_error
      )
      from public.integration_tokens where provider = 'instagram'
    )
  end;
$$;
revoke all on function public.get_instagram_status() from public, anon;
grant execute on function public.get_instagram_status() to authenticated;

-- 2) Métricas de Instagram ---------------------------------------------------
create table if not exists public.ig_media (
  id              text primary key,            -- id del post en Instagram
  media_type      text,
  media_product   text,                        -- FEED | REELS | STORY
  caption         text,
  permalink       text,
  thumbnail_url   text,
  posted_at       timestamptz,
  like_count      integer,
  comments_count  integer,
  reach           integer,
  views           integer,
  saved           integer,
  shares          integer,
  publication_id  bigint references public.publications(id) on delete set null,
  fetched_at      timestamptz not null default now()
);
alter table public.ig_media enable row level security;
drop policy if exists "solo admin ve metricas de instagram" on public.ig_media;
create policy "solo admin ve metricas de instagram" on public.ig_media
  for select using (public.is_admin());

create table if not exists public.ig_account_daily (
  day             date primary key,
  followers_count integer,
  media_count     integer,
  fetched_at      timestamptz not null default now()
);
alter table public.ig_account_daily enable row level security;
drop policy if exists "solo admin ve el historial de la cuenta" on public.ig_account_daily;
create policy "solo admin ve el historial de la cuenta" on public.ig_account_daily
  for select using (public.is_admin());

-- 3) Ventas de Esspresale -----------------------------------------------------
-- Una venta de Esspresale es un pedido normal (suma al contador y al
-- dashboard) con source = 'esspresale'.
alter type public.order_source add value if not exists 'esspresale';

-- Enlace entre la venta, la tarjeta publicada y su post en Instagram, para
-- que el agente pueda cruzar ventas con lo que pasó en redes.
alter table public.publications add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.publications add column if not exists ig_media_id text;
alter table public.publications add column if not exists media_kind text; -- 'image' | 'story' | 'reel'

-- 4) Historial del agente ----------------------------------------------------
alter table public.growth_ai_insights add column if not exists question text;
alter table public.growth_ai_insights add column if not exists sources jsonb;

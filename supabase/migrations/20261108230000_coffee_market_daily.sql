-- Serie diaria del mercado del café (FNC, Bolsa NY, TRM) que guarda el cron
-- /api/v1/collect, y la bitácora de cada corrida para ver cuándo se rompe una fuente.
-- Son datos públicos: se leen sin cuenta. Solo escribe la llave de servicio (el cron).
set lock_timeout = '5s';

create table if not exists public.coffee_market_daily (
  metric text not null check (metric in ('fnc_carga', 'ny_c', 'trm')),
  day date not null,
  value numeric not null check (value > 0),
  unit text not null,
  source text not null,
  source_url text,
  fetched_at timestamptz not null default now(),
  primary key (metric, day)
);

alter table public.coffee_market_daily enable row level security;

drop policy if exists coffee_market_daily_read on public.coffee_market_daily;
create policy coffee_market_daily_read on public.coffee_market_daily
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.coffee_market_daily from anon, authenticated;

create table if not exists public.coffee_collect_log (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  status jsonb not null default '{}'::jsonb,
  saved int not null default 0,
  hoy_updated boolean not null default false
);

alter table public.coffee_collect_log enable row level security;

drop policy if exists coffee_collect_log_admin on public.coffee_collect_log;
create policy coffee_collect_log_admin on public.coffee_collect_log
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.coffee_collect_log from anon, authenticated;

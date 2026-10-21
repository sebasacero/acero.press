-- Encuesta de tinteros y escenario de la reunión (Plan Micra, estudio de calle).
--
--   tintero_surveys: una fila por visita (se puede volver a encuestar al mismo
--     tintero y ver cómo cambia). Lo que el tintero DICE; lo que se OBSERVA
--     (precio del tinto, tazas por hora, foto) sigue en la ficha (tinteros).
--     Sin consentimiento no hay fila: la ley 1581 de 2012 pide autorización
--     previa e informada para guardar datos de una persona.
--   pilot_scenarios: los supuestos del informe (precio de distribuidor, costo
--     del kit, para quién es). NO van en app_config, que es de lectura pública.
--
-- Unidades: café en gramos por semana y precio por kilo; la app pregunta en
-- libras de 500 g (la «libra» de la tienda en Colombia) y convierte.

set lock_timeout = '5s';

create table if not exists public.tintero_surveys (
  id                   uuid primary key default gen_random_uuid(),
  tintero_id           uuid not null references public.tinteros(id) on delete cascade,
  surveyed_at          timestamptz not null default now(),
  consent              boolean not null check (consent),
  -- Su negocio (declarado)
  cups_per_day         integer check (cups_per_day between 0 and 2000),
  hours_per_day        numeric(4,1) check (hours_per_day > 0 and hours_per_day <= 24),
  days_per_week        smallint check (days_per_week between 1 and 7),
  years_selling        text check (years_selling in ('menos_1', '1_3', '3_10', 'mas_10')),
  -- Su café
  coffee_brand         text check (char_length(coffee_brand) between 1 and 60),
  coffee_g_week        integer check (coffee_g_week between 0 and 200000),
  coffee_price_kg      numeric check (coffee_price_kg between 0 and 500000),
  buys_where           text check (buys_where in ('tienda', 'supermercado', 'plaza', 'distribuidor', 'otro')),
  -- Disposición
  would_sell_specialty text check (would_sell_specialty in ('si', 'tal_vez', 'no')),
  specialty_price      numeric check (specialty_price between 0 and 50000),
  kit_interest         text check (kit_interest in ('si', 'tal_vez', 'no')),
  kit_payment          text check (kit_payment in ('contado', 'cuotas', 'arriendo', 'no_sabe')),
  -- Tecnología
  has_smartphone       boolean,
  payments             text[] check (payments <@ array['efectivo', 'nequi', 'daviplata', 'bre_b', 'tarjeta']::text[]),
  -- Quién es (opcional; el informe solo muestra grupos de 5 o más)
  gender               text check (gender in ('mujer', 'hombre', 'otro', 'prefiere_no')),
  age_range            text check (age_range in ('18_24', '25_34', '35_44', '45_54', '55_64', '65_mas', 'prefiere_no')),
  main_income          text check (main_income in ('si', 'no', 'prefiere_no')),
  notes                text check (char_length(notes) <= 500),
  surveyed_by          uuid default auth.uid(),
  created_at           timestamptz not null default now()
);
create index if not exists tintero_surveys_tintero_idx on public.tintero_surveys (tintero_id, surveyed_at desc);

alter table public.tintero_surveys enable row level security;
drop policy if exists "solo admin gestiona las encuestas" on public.tintero_surveys;
create policy "solo admin gestiona las encuestas" on public.tintero_surveys
  for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.tintero_surveys from anon;

-- Supuestos del informe: una fila por escenario (hoy solo «reunion»)
create table if not exists public.pilot_scenarios (
  key        text primary key check (key ~ '^[a-z0-9_-]{1,40}$'),
  data       jsonb not null default '{}'::jsonb
             check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 8192),
  updated_at timestamptz not null default now()
);
alter table public.pilot_scenarios enable row level security;
drop policy if exists "solo admin gestiona los escenarios" on public.pilot_scenarios;
create policy "solo admin gestiona los escenarios" on public.pilot_scenarios
  for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.pilot_scenarios from anon;

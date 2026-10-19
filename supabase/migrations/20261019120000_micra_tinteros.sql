-- Red de tinteros (Plan Micra): quiénes son y cómo les va cada día.
-- La lee el algoritmo de inteligencia de negocio (API de Acero, /api/v1/bi)
-- para medir la red: tinteros activos, tazas por hora e ingreso frente a su
-- línea base (lo que ganaban antes de sumarse). Solo el admin la ve.

create table if not exists public.tinteros (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 2 and 80),
  phone           text check (phone is null or phone ~ '^[0-9]{7,15}$'),
  zone            text check (zone is null or char_length(zone) <= 80),
  stage           text not null default 'prospecto'
                  check (stage in ('prospecto', 'piloto', 'activo', 'pausa', 'salio')),
  kit             text not null default 'ninguno'
                  check (kit in ('ninguno', 'prestamo', 'arriendo', 'propio')),
  -- Línea base: ingreso neto diario (COP) y tintos al día antes de la red
  baseline_income numeric check (baseline_income is null or baseline_income >= 0),
  baseline_cups   integer check (baseline_cups is null or baseline_cups >= 0),
  notes           text check (notes is null or char_length(notes) <= 500),
  joined_at       date,
  created_at      timestamptz not null default now()
);

create table if not exists public.tintero_days (
  tintero_id      uuid not null references public.tinteros(id) on delete cascade,
  day             date not null,
  cups_specialty  integer not null default 0 check (cups_specialty >= 0),
  cups_tinto      integer not null default 0 check (cups_tinto >= 0),
  price_specialty numeric check (price_specialty is null or price_specialty >= 0),
  net_income      numeric check (net_income is null or net_income >= 0),
  hours           numeric check (hours is null or (hours > 0 and hours <= 24)),
  source          text not null default 'panel' check (source in ('panel', 'whatsapp', 'app')),
  created_at      timestamptz not null default now(),
  primary key (tintero_id, day)
);
create index if not exists tintero_days_day_idx on public.tintero_days (day desc);

alter table public.tinteros enable row level security;
alter table public.tintero_days enable row level security;

drop policy if exists "solo admin gestiona tinteros" on public.tinteros;
create policy "solo admin gestiona tinteros" on public.tinteros
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "solo admin gestiona los dias de tinteros" on public.tintero_days;
create policy "solo admin gestiona los dias de tinteros" on public.tintero_days
  for all using (public.is_admin()) with check (public.is_admin());

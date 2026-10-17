-- Lista de espera de la app Esspresale: quienes quieren pedir café y quienes
-- quieren ser baristas. Cualquiera puede apuntarse; solo el admin la lee.
create table if not exists public.app_waitlist (
  id            uuid primary key default gen_random_uuid(),
  role          text not null check (role in ('cliente', 'barista')),
  name          text not null check (char_length(name) between 2 and 80),
  phone         text not null check (phone ~ '^[0-9]{7,15}$'),
  zone          text check (zone is null or char_length(zone) <= 80),
  has_aeropress boolean,
  lang          text check (lang is null or lang in ('es', 'en', 'ja')),
  created_at    timestamptz not null default now(),
  unique (phone, role)
);
create index if not exists app_waitlist_created_at_idx on public.app_waitlist (created_at desc);

alter table public.app_waitlist enable row level security;
drop policy if exists "cualquiera se apunta a la lista" on public.app_waitlist;
create policy "cualquiera se apunta a la lista" on public.app_waitlist for insert to anon, authenticated with check (true);
drop policy if exists "solo admin ve la lista" on public.app_waitlist;
create policy "solo admin ve la lista" on public.app_waitlist for select using (public.is_admin());
drop policy if exists "solo admin borra de la lista" on public.app_waitlist;
create policy "solo admin borra de la lista" on public.app_waitlist for delete using (public.is_admin());

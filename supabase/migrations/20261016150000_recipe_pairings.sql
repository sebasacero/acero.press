-- Cada receta campeona (por año) con el café recomendado y los extras del kit.
create table if not exists public.recipe_pairings (
  recipe_year    integer primary key,
  coffee_id      uuid references public.products(id) on delete set null,
  coffee_size    text not null default '250G',
  kit_ids        uuid[] not null default '{}',
  note           text,
  updated_at     timestamptz not null default now()
);
alter table public.recipe_pairings enable row level security;
drop policy if exists "cualquiera ve los emparejamientos" on public.recipe_pairings;
create policy "cualquiera ve los emparejamientos" on public.recipe_pairings for select using (true);
drop policy if exists "solo admin edita emparejamientos" on public.recipe_pairings;
create policy "solo admin edita emparejamientos" on public.recipe_pairings for all using (public.is_admin()) with check (public.is_admin());

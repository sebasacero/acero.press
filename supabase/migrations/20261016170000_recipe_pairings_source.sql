-- Quién eligió cada kit: 'manual' (desde el panel, manda siempre) o 'agent'
-- (el agente de crecimiento, con datos de ventas y mercado). Sin fila = la
-- regla automática de la página (src/shared/lib/pairing.js).
alter table public.recipe_pairings add column if not exists source text not null default 'manual';
alter table public.recipe_pairings drop constraint if exists recipe_pairings_source_check;
alter table public.recipe_pairings add constraint recipe_pairings_source_check check (source in ('manual', 'agent'));

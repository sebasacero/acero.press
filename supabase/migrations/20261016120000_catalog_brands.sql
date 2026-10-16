-- Catálogo abierto: productos de otras marcas (alianzas).
-- brand null = producto propio de Acero.press.
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists description text;

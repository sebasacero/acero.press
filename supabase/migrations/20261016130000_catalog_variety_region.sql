-- Filtros de la tienda: variedad y región de cada café.
alter table public.products add column if not exists variety text;
alter table public.products add column if not exists region text;
-- Los nombres actuales de las bolsas propias ya son variedades.
update public.products set variety = name
where category = 'coffee_bag' and variety is null and name in ('Geisha','Castillo','Chiroso','Bourbon Rosado','Bourbon Aji');

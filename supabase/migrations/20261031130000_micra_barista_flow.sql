-- Flujo del barista en la app Micra (31 oct 2026):
--  · el barista mismo acepta salir en el mapa público (antes lo activaba el equipo);
--  · cómo le pagan: solo los medios (efectivo, Nequi, Daviplata, Bre-B), sin número;
--  · cómo sale: puesto fijo, sombrilla o caminando;
--  · productos propios además de tinto, perico y aromática (+1 en Vender).
-- Idempotente. Los productos propios no se apartan: solo se cuentan en la libreta.
set lock_timeout = '5s';

-- ── Cómo sale a vender ──────────────────────────────────────────────────
alter table public.tinteros add column if not exists out_mode text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tinteros_out_mode_check') then
    alter table public.tinteros add constraint tinteros_out_mode_check
      check (out_mode is null or out_mode in ('fijo', 'sombrilla', 'caminando'));
  end if;
end $$;

-- ── Productos propios ───────────────────────────────────────────────────
create table if not exists public.micra_barista_products (
  id          uuid primary key default gen_random_uuid(),
  tintero_id  uuid not null references public.tinteros(id) on delete cascade,
  -- La clave que va en tintero_sales.product: corta para que quepa en los client_ref
  key         text not null unique default 'x' || substr(md5(gen_random_uuid()::text), 1, 10) check (key ~ '^x[0-9a-f]{10}$'),
  label       text not null check (char_length(btrim(label)) between 2 and 24),
  price       numeric not null check (price between 0 and 50000),
  created_at  timestamptz not null default now(),
  removed_at  timestamptz
);
create index if not exists micra_barista_products_idx on public.micra_barista_products (tintero_id) where removed_at is null;
alter table public.micra_barista_products enable row level security;
-- Sin políticas: solo por las funciones de abajo

-- La libreta acepta las claves de productos propios
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'tintero_sales_product_check'
             and pg_get_constraintdef(oid) not like '%x[0-9a-f]%') then
    alter table public.tintero_sales drop constraint tintero_sales_product_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tintero_sales_product_check') then
    alter table public.tintero_sales add constraint tintero_sales_product_check
      check (product in ('tinto', 'perico', 'aromatica') or product ~ '^x[0-9a-f]{10}$');
  end if;
end $$;

-- Lo propio del barista que no trae micra_barista_day: productos, medios de pago, cómo sale y si es público
create or replace function public.micra_barista_extras(p_tintero_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  t public.tinteros;
begin
  select * into t from public.tinteros where id = v;
  return jsonb_build_object(
    'products', (select coalesce(jsonb_agg(jsonb_build_object('id', p.key, 'label', p.label, 'price', p.price) order by p.created_at), '[]'::jsonb)
                 from public.micra_barista_products p where p.tintero_id = v and p.removed_at is null),
    'payments', coalesce(to_jsonb(array(select x from unnest(t.payments_seen) x where x <> 'fiado')), '[]'::jsonb),
    'out_mode', t.out_mode,
    'public', t.ad_consent, 'public_at', t.ad_consent_at
  );
end;
$$;
revoke all on function public.micra_barista_extras(uuid) from public, anon;
grant execute on function public.micra_barista_extras(uuid) to authenticated;

create or replace function public.micra_barista_product_add(p_label text, p_price numeric, p_tintero_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  r public.micra_barista_products;
begin
  if p_price is null or p_price not between 0 and 50000 then
    raise exception 'El precio va de $0 a $50.000.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_label, ''))) not between 2 and 24 then
    raise exception 'El nombre lleva de 2 a 24 letras.' using errcode = '22023';
  end if;
  if (select count(*) from public.micra_barista_products where tintero_id = v and removed_at is null) >= 6 then
    raise exception 'Puedes tener hasta 6 productos propios.' using errcode = '22023';
  end if;
  insert into public.micra_barista_products (tintero_id, label, price)
  values (v, btrim(p_label), round(p_price))
  returning * into r;
  return jsonb_build_object('id', r.key, 'label', r.label, 'price', r.price);
end;
$$;
revoke all on function public.micra_barista_product_add(text, numeric, uuid) from public, anon;
grant execute on function public.micra_barista_product_add(text, numeric, uuid) to authenticated;

-- Quitar un producto propio: sus ventas pasadas se quedan (removed_at, no delete)
create or replace function public.micra_barista_product_remove(p_key text, p_tintero_id uuid default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v uuid := public.micra_actor(p_tintero_id);
begin
  update public.micra_barista_products set removed_at = now()
  where key = p_key and tintero_id = v and removed_at is null;
  return found;
end;
$$;
revoke all on function public.micra_barista_product_remove(text, uuid) from public, anon;
grant execute on function public.micra_barista_product_remove(text, uuid) to authenticated;

-- Salir en el mapa público: lo acepta el barista mismo, desde su cuenta (no el equipo por él)
create or replace function public.micra_barista_public(p_on boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v uuid := public.my_tintero_id();
begin
  if v is null then raise exception 'Enlaza tu cuenta de barista primero.' using errcode = '42501'; end if;
  update public.tinteros set
    ad_consent = coalesce(p_on, false),
    ad_consent_at = case when coalesce(p_on, false) then coalesce(case when ad_consent then ad_consent_at end, now()) end
  where id = v;
  return (select jsonb_build_object('public', ad_consent, 'public_at', ad_consent_at) from public.tinteros where id = v);
end;
$$;
revoke all on function public.micra_barista_public(boolean) from public, anon;
grant execute on function public.micra_barista_public(boolean) to authenticated;

-- Cómo le pagan: solo los medios. El «fiado» que anotó el estudio se conserva.
create or replace function public.micra_barista_payments_set(p_methods text[], p_tintero_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  m text[] := array(select distinct x from unnest(coalesce(p_methods, '{}')) x);
begin
  if not m <@ array['efectivo', 'nequi', 'daviplata', 'bre_b'] then
    raise exception 'Medio de pago desconocido.' using errcode = '22023';
  end if;
  update public.tinteros set payments_seen =
    m || case when 'fiado' = any(coalesce(payments_seen, '{}')) then array['fiado'] else '{}'::text[] end
  where id = v;
  return to_jsonb(m);
end;
$$;
revoke all on function public.micra_barista_payments_set(text[], uuid) from public, anon;
grant execute on function public.micra_barista_payments_set(text[], uuid) to authenticated;

create or replace function public.micra_barista_mode(p_mode text, p_tintero_id uuid default null)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v uuid := public.micra_actor(p_tintero_id);
begin
  if p_mode is not null and p_mode not in ('fijo', 'sombrilla', 'caminando') then
    raise exception 'Escoge puesto fijo, sombrilla o caminando.' using errcode = '22023';
  end if;
  update public.tinteros set out_mode = p_mode where id = v;
  return p_mode;
end;
$$;
revoke all on function public.micra_barista_mode(text, uuid) from public, anon;
grant execute on function public.micra_barista_mode(text, uuid) to authenticated;

-- +1 con productos propios: el precio sigue saliendo de la base (la ficha o su tabla)
create or replace function public.micra_barista_sale(p_client_ref text, p_product text, p_qty int default 1, p_fiado_name text default null, p_tintero_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  t public.tinteros;
  v_price numeric;
  s public.tintero_sales;
begin
  select * into s from public.tintero_sales where client_ref = p_client_ref;
  if s.id is not null then
    if s.tintero_id <> v then raise exception 'Esa venta no es tuya.' using errcode = '42501'; end if;
    return jsonb_build_object('id', s.id, 'product', s.product, 'qty', s.qty, 'total', s.total, 'replay', true);
  end if;
  select * into t from public.tinteros where id = v;
  v_price := coalesce(public.micra_price(t, p_product),
    (select p.price from public.micra_barista_products p where p.key = p_product and p.tintero_id = v and p.removed_at is null));
  if v_price is null then
    raise exception 'Pon el precio de «%» antes de contarlo.', p_product using errcode = '22023';
  end if;
  insert into public.tintero_sales (tintero_id, client_ref, product, qty, unit_price, total, fiado_name)
  values (v, p_client_ref, p_product, p_qty, v_price, v_price * p_qty, nullif(btrim(p_fiado_name), ''))
  on conflict (client_ref) do nothing
  returning * into s;
  if s.id is null then
    select * into s from public.tintero_sales where client_ref = p_client_ref and tintero_id = v;
    return jsonb_build_object('id', s.id, 'product', s.product, 'qty', s.qty, 'total', s.total, 'replay', true);
  end if;
  return jsonb_build_object('id', s.id, 'product', s.product, 'qty', s.qty, 'total', s.total, 'replay', false);
end;
$$;
revoke all on function public.micra_barista_sale(text, text, int, text, uuid) from public, anon;
grant execute on function public.micra_barista_sale(text, text, int, text, uuid) to authenticated;

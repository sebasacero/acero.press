-- Réplica mínima del esquema de producción (tipos, tablas y RLS de Supabase)
-- para probar supabase/migrations/20261021120000_micra_atomic_sale.sql.
-- Los roles son de todo el servidor: se crean solo si no existen.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create type admin_role as enum ('owner','cashier','staff');
create type movement_reason as enum ('sale','restock','adjustment','waste');
create type order_source as enum ('web','whatsapp','pos','table','web_card','esspresale');
create type order_status as enum ('pending','confirmed','completed','cancelled');
create table admin_users (id uuid primary key default gen_random_uuid(), auth_user_id uuid not null, role admin_role not null default 'staff');
create function public.is_admin() returns boolean language sql stable security definer set search_path to 'public' as $$ select exists (select 1 from public.admin_users where auth_user_id = auth.uid()); $$;
create table customers (id uuid primary key default gen_random_uuid(), auth_user_id uuid);
create table products (id uuid primary key default gen_random_uuid(), name text not null, active boolean not null default true);
create table product_variants (id uuid primary key default gen_random_uuid(), product_id uuid not null references products(id), label text not null, price numeric not null, active boolean not null default true);
create table orders (id uuid primary key default gen_random_uuid(), source order_source not null, table_id uuid, status order_status not null default 'pending', customer_phone text, total numeric not null default 0, created_at timestamptz not null default now(), closed_at timestamptz, payment_provider text, payment_reference text, payment_method text, customer_id uuid references customers(id));
create table order_items (id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id) on delete cascade, variant_id uuid references product_variants(id), product_name_snapshot text not null, variant_label_snapshot text, unit_price numeric not null, qty int default 1, subtotal numeric not null);
create table inventory (variant_id uuid primary key references product_variants(id) on delete cascade, stock_qty int not null default 0, low_stock_threshold int default 5, updated_at timestamptz default now());
create table inventory_movements (id uuid primary key default gen_random_uuid(), variant_id uuid not null references product_variants(id) on delete cascade, change_qty int not null, reason movement_reason not null, reference_order_id uuid constraint fk_movement_order references orders(id), created_at timestamptz default now());
create table publications (id bigint generated always as identity primary key, video_url text not null default '', order_id uuid);
create table tinteros (
  id uuid primary key default gen_random_uuid(), name text not null, phone text, zone text,
  stage text not null default 'prospecto' check (stage in ('prospecto','piloto','activo','pausa','salio')),
  kit text not null default 'ninguno', baseline_income numeric, baseline_cups integer, notes text, joined_at date,
  created_at timestamptz not null default now()
);
alter table tinteros enable row level security;
create policy "solo admin gestiona tinteros" on tinteros for all using (is_admin()) with check (is_admin());
alter table admin_users enable row level security; alter table products enable row level security; alter table product_variants enable row level security;
alter table orders enable row level security; alter table order_items enable row level security; alter table inventory enable row level security;
alter table inventory_movements enable row level security; alter table publications enable row level security; alter table customers enable row level security;
create policy "solo admin se ve a si mismo" on admin_users for select using (is_admin());
create policy "public puede ver productos activos" on products for select using (active = true or is_admin());
create policy "solo admin gestiona productos" on products for all using (is_admin());
create policy "public puede ver variantes activas" on product_variants for select using (active = true or is_admin());
create policy "solo admin gestiona variantes" on product_variants for all using (is_admin());
create policy "cualquiera puede crear pedidos" on orders for insert with check (true);
create policy "el cliente ve sus propios pedidos" on orders for select using (customer_id in (select customers.id from customers where customers.auth_user_id = auth.uid()));
create policy "solo admin actualiza pedidos" on orders for update using (is_admin()) with check (is_admin());
create policy "solo admin borra pedidos" on orders for delete using (is_admin());
create policy "solo admin lee y edita pedidos" on orders for select using (is_admin());
create policy "cualquiera puede crear items de pedido" on order_items for insert with check (true);
create policy "solo admin lee items de pedido" on order_items for select using (is_admin());
create policy "solo admin edita items de pedido" on order_items for update using (is_admin()) with check (is_admin());
create policy "solo admin ve inventario" on inventory for all using (is_admin()) with check (is_admin());
create policy "solo admin ve movimientos" on inventory_movements for all using (is_admin()) with check (is_admin());
create policy "solo admin gestiona publicaciones" on publications for all using (is_admin()) with check (is_admin());
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
-- Como Supabase: las funciones nuevas quedan ejecutables por anon y authenticated
alter default privileges in schema public grant execute on functions to anon, authenticated;
-- Como Supabase: las tablas que creen las migraciones también quedan concedidas a los roles de la API
alter default privileges in schema public grant all on tables to anon, authenticated;

-- Stub de storage (el real es de Supabase): solo lo que la migración de estudio toca
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean not null default false);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects, storage.buckets to anon, authenticated;

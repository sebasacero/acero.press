-- Estudio de calle (Plan Micra): dónde se vende y dónde están los tinteros.
--
-- La ubicación se guarda como (carrera, calle), no como GPS: es lo que el
-- mapa del sitio ya dibuja, lo que cualquiera dice de memoria («la 85 con
-- 13») y no pide permisos en la calle. `zone` es el nombre del sector.
--
--   orders.place_*: dónde se vendió cada taza (lo escribe micra_record_sale).
--   tinteros.*: ficha de campo del puesto: ubicación, foto, precio del
--     tinto, tazas por hora observadas y si dio permiso para la foto.
--   micra_street_map(): lo que el mapa público puede ver: calor y puntos por
--     cuadra, sin nombres, teléfonos ni montos de una venta en particular.
--
-- Invariante nueva: una venta de Micra con lugar tiene carrera y calle
-- dentro de Bogotá (1–120 / 1–200); sin lugar, las tres columnas van nulas.
--
-- Aplicada en Supabase el 21 oct. 2026 en cuatro partes (micra_street_study_
-- tables, _map, _record_sale, _bucket) porque la herramienta se queda esperando
-- confirmación ante cualquier `drop`: allá la firma vieja de micra_record_sale
-- quedó renombrada a micra_record_sale_v1, sin permisos, en vez de borrada.
-- Para borrarla desde el panel: drop function public.micra_record_sale_v1(jsonb, text, text, text);

set lock_timeout = '5s';

-- ── Ventas con lugar ───────────────────────────────────────────────────
alter table public.orders add column if not exists place_carrera numeric(5,1);
alter table public.orders add column if not exists place_calle numeric(5,1);
alter table public.orders add column if not exists place_zone text;
alter table public.orders drop constraint if exists orders_place_check;
-- Las dos coordenadas o ninguna (con una sola, el rango daría NULL y el
-- check lo dejaría pasar: por eso se cuenta cuántas vienen).
alter table public.orders add constraint orders_place_check check (
  num_nonnulls(place_carrera, place_calle) in (0, 2)
  and (place_carrera is null or (place_carrera between 1 and 120 and place_calle between 1 and 200))
);
alter table public.orders drop constraint if exists orders_place_zone_check;
alter table public.orders add constraint orders_place_zone_check check (place_zone is null or char_length(place_zone) <= 60);
create index if not exists orders_place_idx on public.orders (place_carrera, place_calle) where place_carrera is not null;

-- ── Ficha de campo del tintero ─────────────────────────────────────────
alter table public.tinteros add column if not exists carrera numeric(5,1);
alter table public.tinteros add column if not exists calle numeric(5,1);
alter table public.tinteros add column if not exists photo_url text;
alter table public.tinteros add column if not exists photo_consent boolean not null default false;
alter table public.tinteros add column if not exists tinto_price numeric;
alter table public.tinteros add column if not exists cups_per_hour numeric;
alter table public.tinteros add column if not exists surveyed_at timestamptz;
alter table public.tinteros drop constraint if exists tinteros_place_check;
alter table public.tinteros add constraint tinteros_place_check check (
  num_nonnulls(carrera, calle) in (0, 2)
  and (carrera is null or (carrera between 1 and 120 and calle between 1 and 200))
);
alter table public.tinteros drop constraint if exists tinteros_tinto_price_check;
alter table public.tinteros add constraint tinteros_tinto_price_check check (tinto_price is null or tinto_price between 0 and 50000);
alter table public.tinteros drop constraint if exists tinteros_cups_per_hour_check;
alter table public.tinteros add constraint tinteros_cups_per_hour_check check (cups_per_hour is null or cups_per_hour between 0 and 500);
alter table public.tinteros drop constraint if exists tinteros_photo_url_check;
alter table public.tinteros add constraint tinteros_photo_url_check check (photo_url is null or photo_url ~ '^https://');

-- ── Venta con lugar: la firma anterior se retira (si quedara, PostgREST no
-- sabría cuál llamar) y la nueva acepta p_place = {carrera, calle, zone}.
drop function if exists public.micra_record_sale(jsonb, text, text, text);

create or replace function public.micra_record_sale(
  p_lines jsonb,
  p_payment_method text default null,
  p_phone text default null,
  p_client_ref text default null,
  p_place jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id uuid;
  v_replay   boolean := false;
  v_n        int;
  v_bad_qty  int;
  v_missing  int;
  v_total    numeric;
  v_priced   jsonb;
  v_now      timestamptz := now();
  v_row      record;
  v_old      int;
  v_new      int;
  v_carrera  numeric(5,1);
  v_calle    numeric(5,1);
  v_zone     text;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo puede registrar ventas.' using errcode = '42501';
  end if;
  if p_client_ref is not null and char_length(p_client_ref) not between 8 and 64 then
    raise exception 'client_ref inválido.' using errcode = '22023';
  end if;

  -- Lugar: las dos coordenadas o ninguna; el nombre de la zona es opcional
  if p_place is not null and jsonb_typeof(p_place) = 'object' then
    v_carrera := nullif(p_place->>'carrera', '')::numeric;
    v_calle   := nullif(p_place->>'calle', '')::numeric;
    v_zone    := nullif(btrim(left(coalesce(p_place->>'zone', ''), 60)), '');
    if (v_carrera is null) <> (v_calle is null) then
      raise exception 'El lugar necesita carrera y calle.' using errcode = '22023';
    end if;
    if v_carrera is not null and not (v_carrera between 1 and 120 and v_calle between 1 and 200) then
      raise exception 'Ese lugar no está en Bogotá.' using errcode = '22023';
    end if;
  end if;

  -- Reintento de un ticket que ya se guardó (la respuesta no llegó)
  if p_client_ref is not null then
    select id into v_order_id from public.orders where client_ref = p_client_ref;
    v_replay := found;
  end if;

  if not v_replay then
    if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
      raise exception 'El ticket está vacío.' using errcode = '22023';
    end if;
    if jsonb_array_length(p_lines) > 50 then
      raise exception 'El ticket tiene demasiadas líneas.' using errcode = '22023';
    end if;

    -- Precio, nombre y presentación de la base, leídos una sola vez
    with l as (
      select t.ord, (t.e->>'variant_id')::uuid as variant_id, (t.e->>'qty')::int as qty
      from jsonb_array_elements(p_lines) with ordinality as t(e, ord)
    )
    select
      count(*)::int,
      (count(*) filter (where l.qty is null or l.qty not between 1 and 999))::int,
      (count(*) filter (where p.id is null))::int,
      coalesce(sum(pv.price * l.qty), 0),
      jsonb_agg(jsonb_build_object(
        'variant_id', pv.id, 'name', p.name, 'label', pv.label, 'price', pv.price, 'qty', l.qty
      ) order by l.ord)
    into v_n, v_bad_qty, v_missing, v_total, v_priced
    from l
    left join public.product_variants pv
      on pv.id = l.variant_id and pv.active
    left join public.products p
      on p.id = pv.product_id and p.active;

    if v_bad_qty > 0 then
      raise exception 'Cantidad inválida en el ticket.' using errcode = '22023';
    end if;
    if v_missing > 0 then
      raise exception 'Una presentación del ticket ya no está disponible. Actualiza el catálogo.' using errcode = '22023';
    end if;

    insert into public.orders (source, status, total, payment_method, payment_provider, customer_phone, closed_at, client_ref,
                               place_carrera, place_calle, place_zone)
    values ('esspresale', 'completed', v_total, nullif(btrim(p_payment_method), ''), 'esspresale',
            nullif(btrim(p_phone), ''), v_now, p_client_ref, v_carrera, v_calle, v_zone)
    on conflict (client_ref) where client_ref is not null do nothing
    returning id into v_order_id;

    if v_order_id is null then
      -- Otra llamada con el mismo client_ref ganó la carrera: ese es el pedido
      select id into v_order_id from public.orders where client_ref = p_client_ref;
      v_replay := true;
    else
      insert into public.order_items (order_id, variant_id, product_name_snapshot, variant_label_snapshot, unit_price, qty, subtotal)
      select v_order_id, x.variant_id, x.name, x.label, x.price, x.qty, x.price * x.qty
      from jsonb_to_recordset(v_priced) as x(variant_id uuid, name text, label text, price numeric, qty int);

      -- Inventario: una vez por presentación, en orden fijo (sin bloqueos cruzados)
      for v_row in
        select x.variant_id, sum(x.qty)::int as qty
        from jsonb_to_recordset(v_priced) as x(variant_id uuid, qty int)
        group by x.variant_id
        order by x.variant_id
      loop
        select stock_qty into v_old from public.inventory where variant_id = v_row.variant_id for update;
        continue when not found;
        -- No baja de 0 (y si ya estaba en 0 o menos, no se mueve)
        v_new := least(v_old, greatest(0, v_old - v_row.qty));
        update public.inventory set stock_qty = v_new, updated_at = v_now where variant_id = v_row.variant_id;
        insert into public.inventory_movements (variant_id, change_qty, reason, reference_order_id)
        values (v_row.variant_id, -v_row.qty, 'sale', v_order_id);
        if v_new - v_old <> -v_row.qty then
          insert into public.inventory_movements (variant_id, change_qty, reason, reference_order_id)
          values (v_row.variant_id, (v_new - v_old) + v_row.qty, 'adjustment', v_order_id);
        end if;
      end loop;
    end if;
  end if;

  -- Lo que de verdad cambió el inventario, leído de los movimientos del pedido
  return (
    select jsonb_build_object(
      'order_id', o.id,
      'total', o.total,
      'status', o.status,
      'replay', v_replay,
      'place', case when o.place_carrera is null then null
               else jsonb_build_object('carrera', o.place_carrera, 'calle', o.place_calle, 'zone', o.place_zone) end,
      'stock', coalesce((
        select jsonb_agg(jsonb_build_object('variant_id', m.variant_id, 'applied', m.net) order by m.variant_id)
        from (
          select variant_id, sum(change_qty)::int as net
          from public.inventory_movements
          where reference_order_id = o.id
          group by variant_id
        ) m
      ), '[]'::jsonb)
    )
    from public.orders o
    where o.id = v_order_id
  );
end;
$$;

revoke all on function public.micra_record_sale(jsonb, text, text, text, jsonb) from public, anon;
grant execute on function public.micra_record_sale(jsonb, text, text, text, jsonb) to authenticated;

-- ── El mapa: calor por cuadra y puntos, sin datos de nadie ─────────────
-- Solo cuenta ventas completadas de Micra con lugar (últimos p_days) y
-- tinteros con ubicación. Devuelve cuadras redondeadas y conteos: ni
-- montos por venta, ni nombres, ni teléfonos, ni fotos. Se puede exponer al
-- público (es lo que dibuja el mapa de la portada).
create or replace function public.micra_street_map(p_days int default 90)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'days', least(greatest(coalesce(p_days, 90), 1), 365),
    'sales', coalesce((
      select jsonb_agg(jsonb_build_object('carrera', s.c, 'calle', s.k, 'cups', s.n, 'zone', s.zone) order by s.n desc)
      from (
        select round(o.place_carrera) as c, round(o.place_calle) as k,
               mode() within group (order by o.place_zone) as zone,
               sum(coalesce(i.qty, 0))::int as n
        from public.orders o
        left join (select order_id, sum(qty) as qty from public.order_items group by order_id) i on i.order_id = o.id
        where o.source = 'esspresale' and o.status = 'completed' and o.place_carrera is not null
          and o.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 365))
        group by round(o.place_carrera), round(o.place_calle)
      ) s
    ), '[]'::jsonb),
    'tinteros', coalesce((
      select jsonb_agg(jsonb_build_object('carrera', round(t.carrera), 'calle', round(t.calle), 'stage', t.stage,
                                          'cups_per_hour', t.cups_per_hour, 'zone', t.zone) order by t.created_at)
      from public.tinteros t
      where t.carrera is not null and t.stage <> 'salio'
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.micra_street_map(int) from public;
grant execute on function public.micra_street_map(int) to anon, authenticated;

-- ── Fotos del estudio: bucket privado ──────────────────────────────────
-- La foto de un tintero es la de una persona y su puesto: nunca va al bucket
-- público «marketing». Solo el equipo la sube y la ve; el mapa público no la
-- devuelve (micra_street_map no expone photo_url).
insert into storage.buckets (id, name, public) values ('estudio', 'estudio', false) on conflict (id) do nothing;
drop policy if exists "solo admin sube al estudio" on storage.objects;
create policy "solo admin sube al estudio" on storage.objects for insert
  with check (bucket_id = 'estudio' and public.is_admin());
drop policy if exists "solo admin ve el estudio" on storage.objects;
create policy "solo admin ve el estudio" on storage.objects for select
  using (bucket_id = 'estudio' and public.is_admin());
drop policy if exists "solo admin borra del estudio" on storage.objects;
create policy "solo admin borra del estudio" on storage.objects for delete
  using (bucket_id = 'estudio' and public.is_admin());

-- Venta y anulación de Micra en una sola transacción.
-- Antes el navegador hacía de 4 a 6 llamadas sueltas (pedido, líneas,
-- inventario, movimientos) y un corte a mitad dejaba datos a medias.
--
--   micra_record_sale: precios y nombres salen de la base (no del navegador),
--     cada fila de inventario se bloquea (FOR UPDATE) y no baja de 0, y un
--     reintento con el mismo client_ref devuelve el pedido ya creado.
--   micra_void_sale: anula una sola vez y devuelve al inventario exactamente
--     lo que la venta descontó.
--
-- Invariante: la suma de inventory_movements de un pedido es su efecto neto
-- en el inventario (la venta pide −qty; si no alcanzaba, un 'adjustment'
-- registra lo que no se pudo descontar). Anular deja esa suma en 0.
--
-- security invoker: corren con los permisos y el RLS de quien llama, y además
-- exigen is_admin().

-- Si una transacción larga tiene tomada la tabla, mejor fallar que encolar los pedidos
set lock_timeout = '5s';

alter table public.orders add column if not exists client_ref text;
create unique index if not exists orders_client_ref_key
  on public.orders (client_ref) where client_ref is not null;

create or replace function public.micra_record_sale(
  p_lines jsonb,
  p_payment_method text default null,
  p_phone text default null,
  p_client_ref text default null
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
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo puede registrar ventas.' using errcode = '42501';
  end if;
  if p_client_ref is not null and char_length(p_client_ref) not between 8 and 64 then
    raise exception 'client_ref inválido.' using errcode = '22023';
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

    insert into public.orders (source, status, total, payment_method, payment_provider, customer_phone, closed_at, client_ref)
    values ('esspresale', 'completed', v_total, nullif(btrim(p_payment_method), ''), 'esspresale',
            nullif(btrim(p_phone), ''), v_now, p_client_ref)
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

create or replace function public.micra_void_sale(p_order_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status   public.order_status;
  v_source   public.order_source;
  v_row      record;
  v_old      int;
  v_restored jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo puede anular ventas.' using errcode = '42501';
  end if;

  -- El bloqueo del pedido hace que dos «Deshacer» a la vez anulen una sola vez
  select status, source into v_status, v_source from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'No se encontró la venta.' using errcode = 'P0002';
  end if;
  if v_source <> 'esspresale' then
    raise exception 'Aquí solo se anulan ventas de Micra.' using errcode = '42501';
  end if;
  if v_status <> 'completed' then
    return jsonb_build_object('order_id', p_order_id, 'already_voided', true, 'stock', '[]'::jsonb);
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
  update public.publications set order_id = null where order_id = p_order_id;

  -- Devuelve lo que la venta descontó de verdad (la suma de sus movimientos)
  for v_row in
    select variant_id, sum(change_qty)::int as net
    from public.inventory_movements
    where reference_order_id = p_order_id
    group by variant_id
    having sum(change_qty) < 0
    order by variant_id
  loop
    select stock_qty into v_old from public.inventory where variant_id = v_row.variant_id for update;
    continue when not found;
    update public.inventory set stock_qty = v_old - v_row.net, updated_at = now() where variant_id = v_row.variant_id;
    insert into public.inventory_movements (variant_id, change_qty, reason, reference_order_id)
    values (v_row.variant_id, -v_row.net, 'adjustment', p_order_id);
    v_restored := v_restored || jsonb_build_object('variant_id', v_row.variant_id, 'change', -v_row.net);
  end loop;

  return jsonb_build_object('order_id', p_order_id, 'already_voided', false, 'stock', v_restored);
end;
$$;

revoke all on function public.micra_record_sale(jsonb, text, text, text) from public, anon;
revoke all on function public.micra_void_sale(uuid) from public, anon;
grant execute on function public.micra_record_sale(jsonb, text, text, text) to authenticated;
grant execute on function public.micra_void_sale(uuid) to authenticated;

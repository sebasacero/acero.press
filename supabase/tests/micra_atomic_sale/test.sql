-- Pruebas secuenciales: cada assert que falle detiene el script.
\set ON_ERROR_STOP 1
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $t$
declare r jsonb; r2 jsonb; v_oid uuid; n int; s int; sm int; code text;
  v250 uuid := '20000000-0000-0000-0000-000000000250'; v500 uuid := '20000000-0000-0000-0000-000000000500';
  vneg uuid := '20000000-0000-0000-0000-00000000000e'; vnoinv uuid := '20000000-0000-0000-0000-00000000000f';
begin
  -- 1. Dos líneas de la misma presentación (2 + 2) con stock 3, precio de la base (no del navegador)
  r := micra_record_sale(jsonb_build_array(
        jsonb_build_object('variant_id', v250, 'qty', 2, 'price', 1),
        jsonb_build_object('variant_id', v250, 'qty', 2),
        jsonb_build_object('variant_id', vnoinv, 'qty', 1),
        jsonb_build_object('variant_id', v500, 'qty', 1),
        jsonb_build_object('variant_id', vneg, 'qty', 1)), 'nequi', ' 573001234567 ', 'ticket-0001');
  raise notice 'venta 1: %', r;
  v_oid := (r->>'order_id')::uuid;
  assert (r->>'total')::numeric = 32000*4 + 5000 + 58000 + 10000, 'total de la base';
  assert (r->>'replay')::boolean = false, 'no es reintento';
  assert (select count(*) from order_items where order_id = v_oid) = 5, 'cinco líneas';
  assert (select customer_phone from orders where id = v_oid) = '573001234567', 'teléfono recortado';
  assert (select status from orders where id = v_oid) = 'completed', 'completada';
  assert (select stock_qty from inventory where variant_id = v250) = 0, 'no baja de 0';
  assert (select stock_qty from inventory where variant_id = v500) = 0, 'en 0 no se mueve';
  assert (select stock_qty from inventory where variant_id = vneg) = -2, 'negativo no sube';
  assert (r->'stock') @> jsonb_build_array(jsonb_build_object('variant_id', v250, 'applied', -3)), 'aplicado -3';
  assert (r->'stock') @> jsonb_build_array(jsonb_build_object('variant_id', v500, 'applied', 0)), 'aplicado 0';
  assert (r->'stock') @> jsonb_build_array(jsonb_build_object('variant_id', vneg, 'applied', 0)), 'aplicado 0 (neg)';
  assert jsonb_array_length(r->'stock') = 3, 'sin inventario no aparece';
  assert (select count(*) from inventory_movements where reference_order_id = v_oid and variant_id = vnoinv) = 0, 'sin movimiento sin inventario';
  assert (select array_agg(change_qty order by change_qty) from inventory_movements where reference_order_id = v_oid and variant_id = v250) = array[-4, 1], 'venta -4 + ajuste +1';

  -- 2. Reintento con el mismo client_ref: el mismo pedido, sin duplicar nada
  r2 := micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v250, 'qty', 9)), 'cash', null, 'ticket-0001');
  assert (r2->>'order_id')::uuid = v_oid and (r2->>'replay')::boolean, 'reintento devuelve el mismo';
  assert (r2->'stock') = (r->'stock'), 'mismo stock';
  assert (select count(*) from orders where client_ref = 'ticket-0001') = 1, 'un pedido';
  assert (select count(*) from order_items where order_id = v_oid) = 5, 'sin líneas nuevas';

  -- 3. Errores: nada queda a medias
  n := (select count(*) from orders);
  begin perform micra_record_sale('[{"variant_id":"20000000-0000-0000-0000-0000000000a0","qty":1}]', 'cash', null, null); assert false, 'inactiva';
  exception when sqlstate '22023' then null; end;
  begin perform micra_record_sale('[{"variant_id":"20000000-0000-0000-0000-0000000000b0","qty":1}]', 'cash', null, null); assert false, 'producto inactivo';
  exception when sqlstate '22023' then null; end;
  begin perform micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v250, 'qty', 0)), 'cash', null, null); assert false, 'qty 0';
  exception when sqlstate '22023' then null; end;
  begin perform micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v250)), 'cash', null, null); assert false, 'sin qty';
  exception when sqlstate '22023' then null; end;
  begin perform micra_record_sale('[]', 'cash', null, null); assert false, 'vacío';
  exception when sqlstate '22023' then null; end;
  begin perform micra_record_sale('{}', 'cash', null, null); assert false, 'no es arreglo';
  exception when sqlstate '22023' then null; end;
  begin perform micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v250, 'qty', 1)), 'cash', null, 'x'); assert false, 'ref corta';
  exception when sqlstate '22023' then null; end;
  assert (select count(*) from orders) = n, 'ningún pedido a medias';

  -- 4. Anular: una vez, devuelve exactamente lo aplicado y suelta publicaciones
  insert into publications (order_id) values (v_oid);
  r := micra_void_sale(v_oid);
  raise notice 'anular: %', r;
  assert (r->>'already_voided')::boolean = false, 'anulada';
  assert (select status from orders where id = v_oid) = 'cancelled', 'cancelada';
  assert (select stock_qty from inventory where variant_id = v250) = 3, 'devolvió 3 (no 4)';
  assert (select stock_qty from inventory where variant_id = v500) = 0, 'v500 sigue en 0';
  assert (select stock_qty from inventory where variant_id = vneg) = -2, 'neg sigue en -2';
  assert (select coalesce(sum(change_qty), 0) from inventory_movements where reference_order_id = v_oid) = 0, 'suma de movimientos 0';
  assert (select count(*) from publications where order_id = v_oid) = 0, 'publicación suelta';
  r := micra_void_sale(v_oid);
  assert (r->>'already_voided')::boolean, 'segunda vez: ya anulada';
  assert (select stock_qty from inventory where variant_id = v250) = 3, 'no devuelve dos veces';

  -- 5. Solo ventas de Micra; pedido inexistente
  begin perform micra_void_sale('30000000-0000-0000-0000-000000000001'); assert false, 'web';
  exception when sqlstate '42501' then null; end;
  assert (select status from orders where id = '30000000-0000-0000-0000-000000000001') = 'completed', 'web intacto';
  begin perform micra_void_sale(gen_random_uuid()); assert false, 'inexistente';
  exception when sqlstate 'P0002' then null; end;

  -- 6. Sin client_ref también funciona (dos ventas distintas)
  r := micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v250, 'qty', 1)), 'cash', '', null);
  r2 := micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v250, 'qty', 1)), 'cash', null, null);
  assert r->>'order_id' <> r2->>'order_id', 'dos pedidos';
  assert (select customer_phone from orders where id = (r->>'order_id')::uuid) is null, 'teléfono vacío = null';
  assert (select stock_qty from inventory where variant_id = v250) = 1, 'stock 3-1-1';
  raise notice 'TODO OK (secuencial)';
end $t$;

-- 7. Sin ser admin
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ff';
do $t$ begin
  begin perform micra_record_sale('[{"variant_id":"20000000-0000-0000-0000-000000000250","qty":1}]', 'cash', null, null); assert false, 'no admin';
  exception when sqlstate '42501' then null; end;
  begin perform micra_void_sale(gen_random_uuid()); assert false, 'no admin void';
  exception when sqlstate '42501' then null; end;
  raise notice 'no admin: rechazado OK';
end $t$;
reset role;
set role anon;
do $t$ begin
  begin perform micra_record_sale('[]', null, null, null); assert false, 'anon';
  exception when insufficient_privilege then null; end;
  begin perform micra_void_sale(gen_random_uuid()); assert false, 'anon void';
  exception when insufficient_privilege then null; end;
  raise notice 'anon: sin permiso OK';
end $t$;
reset role;

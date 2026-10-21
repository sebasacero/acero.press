-- Estudio de calle: venta con lugar, ficha de tintero y el mapa público.
-- Corre después de la migración y antes de seed.sql: crea sus propios datos.
\set ON_ERROR_STOP 1
insert into admin_users (auth_user_id, role) values ('00000000-0000-0000-0000-0000000000b1', 'owner');
insert into products (id, name, active) values ('11000000-0000-0000-0000-000000000001', 'Castillo calle', true);
insert into product_variants (id, product_id, label, price, active) values ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'taza', 3500, true);
insert into inventory (variant_id, stock_qty) values ('21000000-0000-0000-0000-000000000001', 100);

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
do $t$
declare r jsonb; v uuid := '21000000-0000-0000-0000-000000000001'; o uuid; m jsonb; code text;
begin
  -- 1. Venta con lugar: queda en el pedido y vuelve en la respuesta
  r := micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v, 'qty', 2)), 'cash', null, 'street-0001',
                         '{"carrera": 13, "calle": 85, "zone": "Chapinero"}');
  o := (r->>'order_id')::uuid;
  assert (select place_carrera from orders where id = o) = 13, 'carrera';
  assert (select place_calle from orders where id = o) = 85, 'calle';
  assert (select place_zone from orders where id = o) = 'Chapinero', 'zona';
  assert r->'place'->>'zone' = 'Chapinero', 'place en la respuesta';

  -- 2. Sin lugar: las tres columnas nulas y place null (la firma vieja sigue sirviendo)
  r := micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v, 'qty', 1)), 'cash', null, null);
  assert (select place_carrera from orders where id = (r->>'order_id')::uuid) is null, 'sin lugar';
  assert r->'place' = 'null'::jsonb, 'place null';

  -- 3. Lugar a medias o fuera de Bogotá: no se guarda nada
  begin perform micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v, 'qty', 1)), 'cash', null, null, '{"carrera": 13}'); assert false, 'a medias';
  exception when sqlstate '22023' then null; end;
  begin perform micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v, 'qty', 1)), 'cash', null, null, '{"carrera": 900, "calle": 85}'); assert false, 'fuera';
  exception when sqlstate '22023' then null; end;
  assert (select count(*) from orders where source = 'esspresale') = 2, 'sin pedidos a medias';

  -- 4. Reintento del mismo ticket conserva el lugar original aunque el reintento mande otro
  r := micra_record_sale(jsonb_build_array(jsonb_build_object('variant_id', v, 'qty', 9)), 'cash', null, 'street-0001', '{"carrera": 7, "calle": 60}');
  assert (r->>'replay')::boolean and (r->'place'->>'carrera')::numeric = 13, 'reintento no cambia el lugar';

  -- 5. Ficha de tintero con ubicación y precio
  insert into tinteros (name, zone, stage, carrera, calle, tinto_price, cups_per_hour, photo_consent, surveyed_at)
  values ('Don Jairo', 'Chapinero', 'prospecto', 13, 72, 1500, 25, true, now());
  begin insert into tinteros (name, carrera) values ('Mal', 13); assert false, 'tintero a medias';
  exception when check_violation then null; end;
  begin insert into tinteros (name, photo_url) values ('Mal', 'http://inseguro'); assert false, 'foto http';
  exception when check_violation then null; end;

  -- 6. El mapa: cuadras y conteos, nada de nadie; una venta anulada no cuenta
  perform micra_void_sale((select id from orders where client_ref is null and source = 'esspresale' limit 1));
  m := micra_street_map(90);
  assert jsonb_array_length(m->'sales') = 1, 'una cuadra con ventas';
  assert (m->'sales'->0->>'cups')::int = 2 and (m->'sales'->0->>'carrera')::int = 13, 'tazas por cuadra';
  assert m->'sales'->0 ? 'cups' and not (m->'sales'->0 ? 'total') and not (m->'sales'->0 ? 'phone'), 'sin montos ni teléfonos';
  assert jsonb_array_length(m->'tinteros') = 1 and m->'tinteros'->0->>'stage' = 'prospecto', 'tintero en el mapa';
  assert not (m->'tinteros'->0 ? 'name') and not (m->'tinteros'->0 ? 'photo_url'), 'sin nombre ni foto';
  raise notice 'estudio de calle: OK';
end $t$;

-- 7. Anónimo: ve el mapa, no las tablas. La sesión venía con el JWT del owner:
-- se borra, porque is_admin() lo leería y el anónimo pasaría por admin.
reset role;
reset request.jwt.claim.sub;
set role anon;
do $t$ declare m jsonb; begin
  m := micra_street_map(30);
  assert jsonb_array_length(m->'sales') = 1 and jsonb_array_length(m->'tinteros') = 1, 'anon ve el mapa agregado';
  -- Con RLS, anon no recibe filas (si además le falta el privilegio, da error): ninguna de las dos deja ver un tintero
  begin
    assert (select count(*) from tinteros) = 0, 'anon lee tinteros';
  exception when insufficient_privilege then null; end;
  raise notice 'anon: mapa sí, tablas no OK';
end $t$;
reset role;
-- Deja la base como la espera seed.sql
delete from inventory_movements; delete from order_items; delete from orders; delete from tinteros;
delete from inventory; delete from product_variants; delete from products; delete from admin_users;

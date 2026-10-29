-- App Micra: el público solo ve baristas con permiso y sin datos privados;
-- apartar calcula el precio en la base y no se duplica; el barista solo
-- toca lo suyo; el +1 reintentado no cuenta dos veces; entregar un apartado
-- lo pasa a la libreta una vez; deshacer y fiados.
\set ON_ERROR_STOP 1
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e1'), ('00000000-0000-0000-0000-0000000000e2');
insert into admin_users (auth_user_id, role) values ('00000000-0000-0000-0000-0000000000c1', 'owner');
insert into tinteros (id, name, phone, notes, localidad, referencia, stage, ad_consent, user_id, tinto_price, perico_price, products, payments_seen, lat, lng, hora_inicio, hora_fin) values
  ('60000000-0000-0000-0000-000000000001', 'Marlene Rojas', '3001234567', 'nota privada', 'Chapinero', 'Cl. 57 con Cra. 7', 'piloto', true,
   '00000000-0000-0000-0000-0000000000e1', 1500, 2000, array['tinto', 'perico'], array['efectivo', 'nequi', 'fiado'], 4.64312, -74.06367, 6, 11),
  ('60000000-0000-0000-0000-000000000002', 'Jairo', null, null, 'Chapinero', null, 'piloto', true, null, 1300, null, array['tinto'], null, null, null, 6, 9),
  ('60000000-0000-0000-0000-000000000003', 'Oculto', null, null, 'Chapinero', null, 'piloto', false, '00000000-0000-0000-0000-0000000000e2', 1300, null, array['tinto'], null, null, null, null, null);

-- 1. El público: dos baristas con permiso, sin teléfono, notas ni apellido; punto redondeado
set role anon;
reset request.jwt.claim.sub;
do $t$ declare b jsonb; m jsonb; begin
  b := micra_baristas();
  assert jsonb_array_length(b) = 2, 'solo los que tienen permiso: ' || b;
  m := (select x from jsonb_array_elements(b) x where x->>'id' = '60000000-0000-0000-0000-000000000001');
  assert m->>'name' = 'Marlene', 'solo el nombre';
  assert not (m ? 'phone') and not (m ? 'notes') and b::text !~ '3001234567' and b::text !~ 'nota privada', 'nada privado';
  assert (m->>'lat')::numeric = 4.643, 'punto redondeado';
  assert m->'payments' = '["efectivo", "nequi"]'::jsonb, 'fiado no sale en público';
  assert (m->>'takes_holds')::boolean, 'Marlene recibe apartados';
  assert not ((select x from jsonb_array_elements(b) x where x->>'name' = 'Jairo')->>'takes_holds')::boolean, 'Jairo sin cuenta no';
  raise notice 'público: OK';
end $t$;

-- 2. Apartar: el precio sale de la base, el mismo celular cambia su apartado, límites
do $t$ declare h jsonb; h2 jsonb; begin
  h := micra_hold('60000000-0000-0000-0000-000000000001', 'cliente-uno', ' Sebas ',
                  '[{"product":"tinto","qty":2,"unit_price":1},{"product":"perico","qty":1}]');
  assert (h->>'total')::numeric = 5000, 'precio de la base: ' || h;
  assert (h->>'cups')::int = 3, 'tres tazas';
  h2 := micra_hold('60000000-0000-0000-0000-000000000001', 'cliente-uno', 'Sebas', '[{"product":"tinto","qty":1}]');
  assert h2->>'id' = h->>'id' and (h2->>'total')::numeric = 1500, 'cambia el mismo apartado';
  assert jsonb_array_length(micra_my_holds('cliente-uno')) = 1, 'mis apartados';
  assert jsonb_array_length(micra_my_holds('otro-celular')) = 0, 'los de otro no';
  begin perform micra_hold('60000000-0000-0000-0000-000000000002', 'cliente-uno', 'Sebas', '[{"product":"tinto","qty":1}]'); assert false, 'sin cuenta';
  exception when no_data_found then null; end;
  begin perform micra_hold('60000000-0000-0000-0000-000000000003', 'cliente-uno', 'Sebas', '[{"product":"tinto","qty":1}]'); assert false, 'sin permiso';
  exception when no_data_found then null; end;
  begin perform micra_hold('60000000-0000-0000-0000-000000000001', 'cliente-dos', 'Ana', '[{"product":"tinto","qty":7}]'); assert false, 'más de 6';
  exception when invalid_parameter_value then null; end;
  begin perform micra_hold('60000000-0000-0000-0000-000000000001', 'cliente-dos', 'Ana', '[{"product":"aromatica","qty":1}]'); assert false, 'sin precio';
  exception when invalid_parameter_value then null; end;
  begin perform micra_hold('60000000-0000-0000-0000-000000000001', 'cliente-dos', '', '[{"product":"tinto","qty":1}]'); assert false, 'sin nombre';
  exception when invalid_parameter_value then null; end;
  perform micra_hold('60000000-0000-0000-0000-000000000001', 'cliente-dos', 'Ana', '[{"product":"tinto","qty":1}]');
  assert micra_hold_cancel('cliente-dos', (micra_my_holds('cliente-dos')->0->>'id')::uuid), 'cancela';
  assert not micra_hold_cancel('cliente-uno', (micra_my_holds('cliente-dos')->0->>'id')::uuid), 'no cancela el de otro';
  raise notice 'apartar: OK';
end $t$;
-- El público no lee las tablas ni llama funciones de barista
do $t$ begin
  begin perform 1 from micra_holds; assert false, 'anon lee apartados';
  exception when insufficient_privilege then null; end;
  begin perform micra_barista_day(); assert false, 'anon día de barista';
  exception when insufficient_privilege then null; end;
  raise notice 'anon cerrado: OK';
end $t$;

-- 3. Marlene: su día, el +1 sin duplicar, fiado, entrega del apartado, deshacer
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
do $t$ declare d jsonb; s jsonb; s2 jsonb; hid uuid; r jsonb; begin
  d := micra_barista_day();
  assert d->>'name' = 'Marlene Rojas', 'su día';
  assert jsonb_array_length(d->'holds') = 1, 'un apartado esperando (el cancelado no sale): ' || (d->'holds');
  assert jsonb_array_length(d->'week') = 7, 'la semana';
  s := micra_barista_sale('venta-0001', 'tinto');
  s2 := micra_barista_sale('venta-0001', 'tinto');
  assert s->>'id' = s2->>'id' and (s2->>'replay')::boolean, 'reintento = misma venta';
  assert (s->>'total')::numeric = 1500, 'precio de la ficha';
  perform micra_barista_sale('venta-0002', 'perico', 2, 'Portero Ed. Alcalá');
  begin perform micra_barista_sale('venta-0003', 'aromatica'); assert false, 'sin precio';
  exception when invalid_parameter_value then null; end;
  hid := (d->'holds'->0->>'id')::uuid;
  r := micra_hold_close(hid, true);
  assert r->>'status' = 'served', 'entregado';
  assert (micra_hold_close(hid, true)->>'replay')::boolean, 'entregar dos veces no suma';
  d := micra_barista_day();
  assert (select sum((x->>'qty')::int) from jsonb_array_elements(d->'sales') x) = 4, 'tazas: 1 + 2 + 1 del apartado: ' || (d->'sales');
  assert (d->'fiados'->0->>'total')::numeric = 4000, 'fiado';
  assert micra_barista_undo((s->>'id')::uuid), 'deshacer';
  assert not micra_barista_undo((s->>'id')::uuid), 'deshacer una sola vez';
  -- Deshacer la entrega devuelve el apartado a «esperando»
  perform micra_barista_undo((select (x->>'id')::uuid from jsonb_array_elements(d->'sales') x where x->>'product' = 'tinto' and x->>'id' <> s->>'id'));
  assert (select x->>'status' from jsonb_array_elements(micra_barista_day()->'holds') x where (x->>'id')::uuid = hid) = 'waiting', 'apartado vuelve a esperar';
  assert micra_fiado_paid('Portero Ed. Alcalá') = 4000, 'pagó el fiado';
  assert jsonb_array_length(micra_barista_day()->'fiados') = 0, 'sin fiados';
  -- Salí con el punto redondeado; con 0 vuelve
  perform micra_barista_out(120, 4.64312, -74.06367);
  assert micra_barista_day()->>'live_until' is not null, 'salió';
  perform micra_barista_prices(1600, 2000, 1200);
  assert micra_barista_day()->'products' ? 'aromatica', 'aromática entra a lo que vende';
  raise notice 'barista: OK';
end $t$;
-- No toca a otro barista ni ve el resumen del equipo
do $t$ begin
  begin perform micra_barista_day('60000000-0000-0000-0000-000000000002'); assert false, 'otro barista';
  exception when insufficient_privilege then null; end;
  begin perform micra_barista_sale('venta-0009', 'tinto', 1, null, '60000000-0000-0000-0000-000000000002'); assert false, 'vende por otro';
  exception when insufficient_privilege then null; end;
  begin perform micra_owner_day(); assert false, 'resumen del equipo';
  exception when insufficient_privilege then null; end;
  begin perform 1 from tintero_sales where tintero_id <> '60000000-0000-0000-0000-000000000001' limit 1;
    assert not found, 'lee ventas de otros';
  exception when insufficient_privilege then null; end;
  raise notice 'barista aislado: OK';
end $t$;
-- Alguien sin enlazar no es barista
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d9';
do $t$ begin
  begin perform micra_barista_day(); assert false, 'sin enlace';
  exception when insufficient_privilege then null; end;
  raise notice 'sin enlace: OK';
end $t$;

-- 4. El equipo: resumen del día y actuar como otro barista
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
do $t$ declare o jsonb; m jsonb; begin
  o := micra_owner_day();
  assert jsonb_array_length(o->'baristas') = 3, 'todos';
  m := (select x from jsonb_array_elements(o->'baristas') x where x->>'name' = 'Marlene Rojas');
  assert (m->>'cups')::int = 2 and m->>'live_until' is not null and (m->>'waiting')::int = 1, 'Marlene en el resumen: ' || m;
  perform micra_barista_sale('venta-equipo-1', 'tinto', 1, null, '60000000-0000-0000-0000-000000000002');
  assert (micra_barista_day('60000000-0000-0000-0000-000000000002')->'sales'->0->>'total')::numeric = 1300, 'como Jairo';
  raise notice 'equipo: OK';
end $t$;

reset role;
reset request.jwt.claim.sub;
delete from tinteros where id::text like '60000000-%';
delete from admin_users; delete from auth.users;

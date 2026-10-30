-- Mapa en vivo: «busco café» guarda solo la celda y un hash, una vez cada
-- 15 min por celular; las zonas salen con 2 señales o más; el público no lee
-- nada; las señales vencidas se borran; el barista ve a los que están en la
-- calle con permiso y el equipo a todos.
\set ON_ERROR_STOP 1
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1'), ('00000000-0000-0000-0000-0000000000f2');
insert into admin_users (auth_user_id, role) values ('00000000-0000-0000-0000-0000000000c1', 'owner') on conflict do nothing;
-- Marlene (enlazada, en la calle), Jairo (en la calle), Oculto (en la calle sin permiso público),
-- Quieta (no salió) y dos puestos del estudio en la misma celda que Quieta
insert into tinteros (id, name, notes, stage, ad_consent, user_id, lat, lng, out_until, out_lat, out_lng) values
  ('61000000-0000-0000-0000-000000000001', 'Marlene Rojas', 'nota privada', 'piloto', true, '00000000-0000-0000-0000-0000000000f1', 4.64312, -74.06367, now() + interval '2 hours', 4.643, -74.064),
  ('61000000-0000-0000-0000-000000000002', 'Jairo Pérez', null, 'piloto', true, null, 4.65001, -74.05801, now() + interval '2 hours', 4.650, -74.058),
  ('61000000-0000-0000-0000-000000000003', 'Oculto Ruiz', null, 'piloto', false, '00000000-0000-0000-0000-0000000000f2', 4.66, -74.05, now() + interval '1 hour', 4.660, -74.050),
  ('61000000-0000-0000-0000-000000000004', 'Quieta Gómez', 'otra nota', 'piloto', true, null, 4.6701, -74.0451, null, null, null),
  ('61000000-0000-0000-0000-000000000005', 'Puesto Dos', null, 'prospecto', false, null, 4.6702, -74.0452, null, null, null),
  ('61000000-0000-0000-0000-000000000006', 'Puesto Solo', null, 'prospecto', false, null, 4.6801, -74.0301, null, null, null);

-- 1. El cliente sin cuenta: manda su celda; se guarda el centro y un hash, una vez cada 15 min
set role anon;
reset request.jwt.claim.sub;
do $t$ declare r jsonb; begin
  r := micra_seek('busco-cel-uno', 4.64512, -74.06381, 'perico'); -- un cliente que mande el punto exacto
  assert (r->>'accepted')::boolean, 'primera señal: ' || r::text;
  r := micra_seek('busco-cel-uno', 4.64512, -74.06381, 'tinto');
  assert not (r->>'accepted')::boolean and r->>'reason' = 'reciente', 'segunda en 15 min: ' || r::text;
  assert (micra_seek('busco-cel-dos', 4.6461, -74.0621, 'tinto')->>'accepted')::boolean, 'otro celular, misma celda';
  assert (micra_seek('busco-cel-tres', 4.6541, -74.0381, 'tinto')->>'accepted')::boolean, 'celda con una sola señal';
  assert micra_seek('busco-cel-cuatro', 6.25, -75.56, 'tinto')->>'reason' = 'fuera', 'Medellín no';
  begin perform micra_seek('corta', 4.64, -74.06, 'tinto'); assert false, 'llave corta';
  exception when invalid_parameter_value then null; end;
  begin perform 1 from micra_demand; assert false, 'anon lee señales';
  exception when insufficient_privilege then null; end;
  begin perform micra_live_map(); assert false, 'anon ve el mapa';
  exception when insufficient_privilege then null; end;
  raise notice 'busco café: OK';
end $t$;
reset role;
do $t$ declare n int; begin
  -- Solo la celda (4 decimales, centro del cuadro de 0,004°) y un hash de 64; nunca la llave
  assert (select count(*) from micra_demand) = 3, 'tres guardadas';
  assert (select count(*) from micra_demand where cell_lat = 4.646 and cell_lng = -74.062) = 2, 'centro de la celda';
  assert not exists (select 1 from micra_demand where device_hash like '%busco%' or char_length(device_hash) <> 64), 'sin la llave en claro';
  assert not exists (select 1 from micra_demand where cell_lat = 4.64512), 'sin el punto exacto';
  raise notice 'lo guardado: OK';
end $t$;

-- 2. Un apartado esperando a Jairo y una señal en su celda: zona de 2
insert into micra_holds (tintero_id, client_ref, name, items, cups, total, for_day, status) values
  ('61000000-0000-0000-0000-000000000002', 'cliente-de-jairo', 'Ana', '[{"product":"tinto","qty":1,"unit_price":1300}]', 1, 1300, micra_today(), 'waiting'),
  ('61000000-0000-0000-0000-000000000001', 'cliente-de-marlene', 'Sebas', '[{"product":"tinto","qty":3,"unit_price":1500}]', 3, 4500, micra_today(), 'waiting');
set role anon;
select micra_seek('busco-cel-cinco', 4.6501, -74.0581, 'aromatica');

-- 3. La barista enlazada: zonas de 2 o más, baristas con permiso, sus tazas aparte
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
do $t$ declare m jsonb; z jsonb; begin
  m := micra_live_map();
  assert (m->>'min_count')::int = 2 and (m->>'cell_deg')::numeric = 0.004, 'reglas: ' || m::text;
  assert jsonb_array_length(m->'demand') = 2, 'dos zonas (la de una sola señal no sale): ' || (m->'demand')::text;
  z := (select x from jsonb_array_elements(m->'demand') x where (x->>'lat')::numeric = 4.646);
  assert (z->>'n')::int = 2 and (z->'drinks'->>'perico')::int = 1, 'zona de Chapinero: ' || z::text;
  z := (select x from jsonb_array_elements(m->'demand') x where (x->>'lat')::numeric = 4.65);
  assert (z->>'pings')::int = 1 and (z->>'holds')::int = 1, 'la señal y el apartado de Jairo: ' || z::text;
  assert not exists (select 1 from jsonb_array_elements(m->'demand') x where (x->>'lat')::numeric = 4.654), 'la de una sola no sale';
  assert (m->>'waiting_cups')::int = 3, 'lo suyo aparte';
  assert jsonb_array_length(m->'baristas') = 2, 'Marlene y Jairo, no Oculto ni Quieta: ' || (m->'baristas')::text;
  assert (select bool_and((x->>'me')::boolean = (x->>'id' = '61000000-0000-0000-0000-000000000001')) from jsonb_array_elements(m->'baristas') x), 'marca a sí misma';
  assert (select x->>'name' from jsonb_array_elements(m->'baristas') x where x->>'id' = '61000000-0000-0000-0000-000000000002') = 'Jairo', 'nombre de pila';
  assert m::text not like '%nota%' and m::text not like '%Pérez%' and m::text not like '%busco%', 'nada privado';
  -- Estudio: Quieta y Puesto Dos en la misma celda salen (2); Puesto Solo no; solo celda y cuántos
  assert exists (select 1 from jsonb_array_elements(m->'study') x where (x->>'lat')::numeric = 4.67 and (x->>'lng')::numeric = -74.046 and (x->>'n')::int = 2), 'estudio por celda: ' || (m->'study')::text;
  assert not exists (select 1 from jsonb_array_elements(m->'study') x where (x->>'lat')::numeric = 4.682), 'un puesto solo no sale';
  assert not exists (select 1 from jsonb_array_elements(m->'study') x where x - 'lat' - 'lng' - 'n' <> '{}'::jsonb), 'sin nada más que celda y cuántos';
  raise notice 'barista: OK';
end $t$;

-- 4. Sin ficha enlazada no hay mapa; el equipo ve a todos los que están en la calle
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d9';
do $t$ begin
  begin perform micra_live_map(); assert false, 'sin ficha';
  exception when insufficient_privilege then null; end;
end $t$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
do $t$ declare m jsonb; begin
  m := micra_live_map(60);
  assert jsonb_array_length(m->'baristas') = 3, 'equipo: los tres en la calle';
  assert (m->>'waiting_cups')::int = 0 and (m->>'minutes')::int = 60, 'equipo: ' || m::text;
  -- Los apartados de Marlene cuentan como demanda para el equipo, en la celda de Marlene (3 + 0 señales = 1 apartado: no sale)
  assert jsonb_array_length(m->'demand') = 2, 'mismas zonas';
  raise notice 'equipo: OK';
end $t$;

-- 5. Las señales vencen a la hora; los frenos
reset role;
reset request.jwt.claim.sub;
update micra_demand set created_at = now() - interval '61 minutes' where cell_lat = 4.654;
insert into micra_demand (cell_lat, cell_lng, drink, device_hash)
  select 4.682, -74.03, 'tinto', repeat('a', 63) || g % 10 from generate_series(1, 40) g;
set role anon;
do $t$ begin
  assert micra_seek('busco-cel-seis', 4.6821, -74.0301, 'tinto')->>'reason' = 'lleno', 'celda llena';
  raise notice 'frenos: OK';
end $t$;
reset role;
do $t$ begin
  assert not exists (select 1 from micra_demand where cell_lat = 4.654), 'la vencida se borró';
  raise notice 'vencidas: OK';
end $t$;

delete from micra_demand;
delete from micra_holds where tintero_id::text like '61000000-%';
delete from tinteros where id::text like '61000000-%';
delete from admin_users; delete from auth.users;

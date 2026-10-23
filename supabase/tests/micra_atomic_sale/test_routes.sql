-- Rutas de tinteros: invitación, enlace de cuenta, permiso, recorrido y que
-- cada tintero vea y escriba solo lo suyo.
\set ON_ERROR_STOP 1
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2'), ('00000000-0000-0000-0000-0000000000d3');
insert into admin_users (auth_user_id, role) values ('00000000-0000-0000-0000-0000000000c1', 'owner');
insert into tinteros (id, name, zone) values
  ('40000000-0000-0000-0000-000000000001', 'Marlene', 'Chapinero'),
  ('40000000-0000-0000-0000-000000000002', 'Don Jairo', 'Chapinero');

-- 1. El equipo genera los códigos
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
create temp table codes as
  select (tintero_invite('40000000-0000-0000-0000-000000000001')->>'code') as a,
         (tintero_invite('40000000-0000-0000-0000-000000000002')->>'code') as b;
do $t$ begin
  assert (select a ~ '^[A-Z2-9]{6}$' from codes), 'código de 6';
  assert (select a <> b from codes), 'códigos distintos';
  raise notice 'invitación OK';
end $t$;

-- 2. Alguien que no es del equipo no invita
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $t$ begin
  begin perform tintero_invite('40000000-0000-0000-0000-000000000001'); assert false, 'no admin invita';
  exception when insufficient_privilege then null; end;
  -- Sin enlazar: no es nadie, no ve nada, no empieza recorridos
  assert tintero_me() is null, 'sin enlace';
  assert (select count(*) from tintero_routes) = 0, 'no ve recorridos';
  begin perform tintero_route_start('ref-sin-enlace'); assert false, 'empieza sin enlace';
  exception when insufficient_privilege then null; end;
  begin perform tintero_claim('ZZZZZZ'); assert false, 'código falso';
  exception when invalid_parameter_value then null; end;
  raise notice 'sin enlace: nada OK';
end $t$;

-- 3. Marlene enlaza su cuenta con su código (con espacios y en minúscula)
do $t$ declare me jsonb; begin
  me := tintero_claim(lower(' ' || (select a from codes)));
  assert me->>'name' = 'Marlene', 'enlazada';
  assert me->'consent_at' = 'null'::jsonb, 'sin permiso todavía';
  -- El código ya se usó: no lo puede usar otra cuenta
  assert (select invite_code from tinteros where id = '40000000-0000-0000-0000-000000000001') is null, 'código gastado';
  -- Sin permiso no hay recorrido
  begin perform tintero_route_start('ref-marlene-1'); assert false, 'sin permiso';
  exception when insufficient_privilege then null; end;
  raise notice 'enlace OK';
end $t$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d3';
do $t$ begin
  begin perform tintero_claim((select a from codes)); assert false, 'código reusado';
  exception when invalid_parameter_value then null; end;
  raise notice 'código de un solo uso OK';
end $t$;

-- 4. Permiso, recorrido, puntos y fin
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $t$ declare r jsonb; r2 jsonb; p jsonb; e jsonb; rid uuid; t0 timestamptz := now() - interval '20 minutes'; begin
  assert tintero_consent(true)->>'consent_at' is not null, 'permiso';
  r := tintero_route_start('ref-marlene-1', t0);
  rid := (r->>'id')::uuid;
  -- Reintento y segundo «Empezar» con otro ref: el mismo recorrido abierto
  assert (tintero_route_start('ref-marlene-1')->>'id')::uuid = rid, 'reintento';
  assert (tintero_route_start('ref-marlene-2')->>'id')::uuid = rid, 'retoma el abierto';
  assert (tintero_me()->'open_route'->>'id')::uuid = rid, 'me ve el abierto';

  p := tintero_route_add_points(rid, jsonb_build_array(
    jsonb_build_object('t', t0 + interval '1 minute', 'lat', 4.6431, 'lng', -74.0636, 'acc', 12),
    jsonb_build_object('t', t0 + interval '2 minutes', 'lat', 4.6436, 'lng', -74.0640, 'acc', 9),
    jsonb_build_object('t', t0 + interval '3 minutes', 'lat', 4.6440, 'lng', -74.0645),
    -- Fuera de Bogotá, muy impreciso, antes de empezar, basura: se descartan
    jsonb_build_object('t', t0 + interval '4 minutes', 'lat', 6.25, 'lng', -75.56, 'acc', 10),
    jsonb_build_object('t', t0 + interval '5 minutes', 'lat', 4.6441, 'lng', -74.0646, 'acc', 900),
    jsonb_build_object('t', t0 - interval '2 hours', 'lat', 4.6441, 'lng', -74.0646, 'acc', 5),
    jsonb_build_object('t', t0 + interval '6 minutes', 'lat', 'x', 'lng', -74.0646),
    '"no es un punto"'::jsonb));
  assert (p->>'accepted')::int = 3, 'tres puntos buenos, salió ' || (p->>'accepted');
  -- El mismo lote otra vez (no llegó la respuesta): no se duplica
  p := tintero_route_add_points(rid, jsonb_build_array(jsonb_build_object('t', t0 + interval '1 minute', 'lat', 4.6431, 'lng', -74.0636, 'acc', 12)));
  assert (p->>'accepted')::int = 0 and (p->>'points_n')::int = 3, 'reintento de puntos';
  assert (select count(*) from tintero_route_points) = 3, 've sus puntos';

  e := tintero_route_end(rid, null, '{"distance_m": 112.4, "stops": [{"lat": 4.6431, "lng": -74.0636, "minutes": 4}], "path": [[-74.0636, 4.6431], [-74.0645, 4.644]]}');
  assert (e->>'distance_m')::int = 112 and (e->>'stops')::int = 1, 'resumen';
  -- Terminar otra vez no cambia nada
  e := tintero_route_end(rid, null, '{"distance_m": 9999}');
  assert (e->>'distance_m')::int = 112, 'terminar dos veces';
  assert tintero_me()->'open_route' = 'null'::jsonb, 'sin abierto';
  -- Un recorrido terminado no recibe puntos de después
  p := tintero_route_add_points(rid, jsonb_build_array(jsonb_build_object('t', now() + interval '1 hour', 'lat', 4.65, 'lng', -74.06)));
  assert (p->>'accepted')::int = 0, 'puntos después del fin';
  -- Escribir directo en las tablas: no
  begin insert into tintero_route_points (route_id, recorded_at, lat, lng) values (rid, now(), 4.65, -74.06); assert false, 'insert directo';
  exception when insufficient_privilege then null; end;
  begin update tintero_routes set distance_m = 1 where id = rid; assert (select distance_m from tintero_routes where id = rid) = 112, 'update directo';
  exception when insufficient_privilege then null; end;
  r2 := tintero_route_start('ref-marlene-3');
  assert (r2->>'id')::uuid <> rid, 'otro recorrido después de terminar';
  raise notice 'recorrido OK';
end $t$;

-- 5. Don Jairo no ve ni toca lo de Marlene
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
do $t$ declare rid uuid; begin
  perform tintero_claim((select b from codes));
  perform tintero_consent(true);
  assert (select count(*) from tintero_routes) = 0, 'no ve recorridos ajenos';
  assert (select count(*) from tintero_route_points) = 0, 'no ve puntos ajenos';
  select id into rid from tintero_routes;
  reset role;
  select id into rid from tintero_routes where client_ref = 'ref-marlene-1';
  set role authenticated;
  begin perform tintero_route_add_points(rid, '[]'); assert false, 'puntos en ruta ajena';
  exception when insufficient_privilege then null; end;
  begin perform tintero_route_end(rid); assert false, 'termina ruta ajena';
  exception when insufficient_privilege then null; end;
  assert not tintero_route_delete(rid), 'borra ruta ajena';
  begin perform tintero_route_start('ref-marlene-1'); assert false, 'roba el client_ref';
  exception when invalid_parameter_value then null; end;
  raise notice 'aislamiento OK';
end $t$;

-- 6. El equipo ve todo; anónimo nada
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
do $t$ begin
  assert (select count(*) from tintero_routes) = 2, 'equipo ve los recorridos';
  assert (select count(*) from tintero_route_points) = 3, 'equipo ve los puntos';
  raise notice 'equipo OK';
end $t$;
reset role;
reset request.jwt.claim.sub;
set role anon;
do $t$ begin
  begin perform count(*) from tintero_routes; assert false, 'anon lee recorridos';
  exception when insufficient_privilege then null; end;
  begin perform tintero_me(); assert false, 'anon llama tintero_me';
  exception when insufficient_privilege then null; end;
  raise notice 'anon: nada OK';
end $t$;
reset role;

-- 7. Retirar el permiso cierra el abierto; borrar un recorrido borra sus puntos
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $t$ declare rid uuid; begin
  perform tintero_consent(false);
  assert tintero_me()->'open_route' = 'null'::jsonb, 'retirar cierra';
  begin perform tintero_route_start('ref-marlene-4'); assert false, 'empieza sin permiso';
  exception when insufficient_privilege then null; end;
  select id into rid from tintero_routes where client_ref = 'ref-marlene-1';
  assert tintero_route_delete(rid), 'borra el suyo';
  assert (select count(*) from tintero_route_points) = 0, 'puntos borrados';
  raise notice 'retirar y borrar OK';
end $t$;
reset role;
reset request.jwt.claim.sub;

-- Deja la base como la espera seed.sql
delete from tinteros where id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002');
delete from admin_users; delete from auth.users;

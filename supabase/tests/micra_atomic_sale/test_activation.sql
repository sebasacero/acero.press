-- Activación automática: la etapa del barista sigue a sus requisitos (sin
-- tocar «pausa» ni «salio»); el cliente que no llegó a sus dos últimos
-- apartados no aparta por 7 días y vuelve solo; el resumen del equipo trae
-- cifras de clientes sin llaves ni nombres.
\set ON_ERROR_STOP 1
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a7'), ('00000000-0000-0000-0000-0000000000a8');
insert into admin_users (auth_user_id, role) values ('00000000-0000-0000-0000-0000000000c1', 'owner') on conflict do nothing;
insert into tinteros (id, name, stage, ad_consent, user_id, tinto_price) values
  ('62000000-0000-0000-0000-000000000001', 'Ficha Sola', 'piloto', true, null, 1500),
  ('62000000-0000-0000-0000-000000000002', 'Ana Lista', 'prospecto', true, '00000000-0000-0000-0000-0000000000a7', 1500),
  ('62000000-0000-0000-0000-000000000003', 'Pausada', 'pausa', true, '00000000-0000-0000-0000-0000000000a8', 1500);

-- 1. Barista: la etapa la ponen los requisitos
do $t$ declare s text; begin
  assert (select stage from tinteros where id = '62000000-0000-0000-0000-000000000001') = 'prospecto', 'sin cuenta = prospecto';
  assert (select stage from tinteros where id = '62000000-0000-0000-0000-000000000002') = 'activo', 'cuenta + permiso + precio = activo';
  assert (select stage from tinteros where id = '62000000-0000-0000-0000-000000000003') = 'pausa', 'pausa es a mano';
  update tinteros set ad_consent = false where id = '62000000-0000-0000-0000-000000000002';
  assert (select stage from tinteros where id = '62000000-0000-0000-0000-000000000002') = 'piloto', 'retira el permiso = piloto';
  update tinteros set ad_consent = true where id = '62000000-0000-0000-0000-000000000002';
  assert (select stage from tinteros where id = '62000000-0000-0000-0000-000000000002') = 'activo', 'vuelve solo';
  update tinteros set stage = 'salio' where id = '62000000-0000-0000-0000-000000000002';
  assert (select stage from tinteros where id = '62000000-0000-0000-0000-000000000002') = 'salio', 'salio es a mano';
  update tinteros set stage = 'activo' where id = '62000000-0000-0000-0000-000000000002';
  raise notice 'etapa automática: OK';
end $t$;

-- 2. Cliente: dos «No vino» seguidos frenan 7 días; una entrega en medio no
insert into micra_holds (tintero_id, client_ref, name, items, cups, total, for_day, status) values
  ('62000000-0000-0000-0000-000000000002', 'cliente-falla', 'Falla', '[]', 1, 1500, micra_today() - 3, 'missed'),
  ('62000000-0000-0000-0000-000000000002', 'cliente-falla', 'Falla', '[]', 1, 1500, micra_today() - 1, 'missed'),
  ('62000000-0000-0000-0000-000000000002', 'cliente-bien', 'Bien', '[]', 1, 1500, micra_today() - 3, 'missed'),
  ('62000000-0000-0000-0000-000000000002', 'cliente-bien', 'Bien', '[]', 1, 1500, micra_today() - 2, 'served'),
  ('62000000-0000-0000-0000-000000000002', 'cliente-bien', 'Bien', '[]', 1, 1500, micra_today() - 1, 'missed'),
  ('62000000-0000-0000-0000-000000000002', 'cliente-viejo', 'Viejo', '[]', 1, 1500, micra_today() - 9, 'missed'),
  ('62000000-0000-0000-0000-000000000002', 'cliente-viejo', 'Viejo', '[]', 1, 1500, micra_today() - 8, 'missed'),
  ('62000000-0000-0000-0000-000000000002', 'cliente-fiel', 'Fiel', '[]', 1, 1500, micra_today() - 3, 'served'),
  ('62000000-0000-0000-0000-000000000002', 'cliente-fiel', 'Fiel', '[]', 1, 1500, micra_today() - 2, 'served'),
  ('62000000-0000-0000-0000-000000000002', 'cliente-fiel', 'Fiel', '[]', 1, 1500, micra_today() - 1, 'served');
set role anon;
reset request.jwt.claim.sub;
do $t$ begin
  begin
    perform micra_hold('62000000-0000-0000-0000-000000000002', 'cliente-falla', 'Falla', '[{"product":"tinto","qty":1}]');
    assert false, 'dos no vino seguidos';
  exception when insufficient_privilege then
    assert sqlerrm like '%Vuelves a apartar el ' || to_char(micra_today() + 6, 'DD/MM') || '%', 'dice el día: ' || sqlerrm;
  end;
  perform micra_hold('62000000-0000-0000-0000-000000000002', 'cliente-bien', 'Bien', '[{"product":"tinto","qty":1}]');
  perform micra_hold('62000000-0000-0000-0000-000000000002', 'cliente-viejo', 'Viejo', '[{"product":"tinto","qty":1}]');
  perform micra_hold('62000000-0000-0000-0000-000000000002', 'cliente-nuevo', 'Nuevo', '[{"product":"tinto","qty":1}]');
  begin perform micra_client_paused_until('cliente-falla'); assert false, 'anon no consulta el freno';
  exception when insufficient_privilege then null; end;
  raise notice 'freno del cliente: OK';
end $t$;

-- 3. El equipo: clientes en cifras, celular sí/no, última actividad
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
do $t$ declare o jsonb; c jsonb; a jsonb; begin
  o := micra_owner_day();
  c := o->'clients';
  assert (c->>'total')::int = 5, 'cinco celulares: ' || c::text;
  assert (c->>'paused')::int = 1, 'uno frenado: ' || c::text;
  assert (c->>'active')::int = 2 and (c->>'frequent')::int = 1, 'activos y frecuentes: ' || c::text;
  assert (c->>'new_7d')::int = 4, 'nuevos en 7 días (falla, bien, fiel, nuevo; viejo no): ' || c::text;
  assert c::text !~ 'cliente-', 'sin llaves';
  a := (select x from jsonb_array_elements(o->'baristas') x where x->>'name' = 'Ana Lista');
  assert a->>'stage' = 'activo' and a ? 'has_phone' and a->>'last_active_at' is not null, 'Ana: ' || a::text;
  raise notice 'resumen del equipo: OK';
end $t$;

reset role;
reset request.jwt.claim.sub;
delete from micra_holds where tintero_id::text like '62000000-%';
delete from tinteros where id::text like '62000000-%';

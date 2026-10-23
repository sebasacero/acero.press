-- Encuesta de tinteros y escenario de la reunión: consentimiento, rangos,
-- borrado en cascada y que solo el equipo los vea.
\set ON_ERROR_STOP 1
insert into admin_users (auth_user_id, role) values ('00000000-0000-0000-0000-0000000000c1', 'owner');
insert into tinteros (id, name, zone, carrera, calle, tinto_price) values ('30000000-0000-0000-0000-000000000001', 'Doña Rosa', 'Chapinero', 13, 60, 1500);

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
do $t$
declare t uuid := '30000000-0000-0000-0000-000000000001'; s uuid;
begin
  -- 1. Encuesta completa: queda con quién la hizo
  insert into tintero_surveys (tintero_id, consent, cups_per_day, hours_per_day, days_per_week, years_selling,
    coffee_brand, coffee_g_week, coffee_price_kg, buys_where, would_sell_specialty, specialty_price, kit_interest, kit_payment,
    has_smartphone, payments, gender, age_range, main_income)
  values (t, true, 80, 6, 6, '3_10', 'Águila Roja', 1500, 40000, 'tienda', 'tal_vez', 4000, 'si', 'cuotas',
    true, array['efectivo', 'nequi'], 'mujer', '45_54', 'si')
  returning id into s;
  assert (select surveyed_by from tintero_surveys where id = s) = '00000000-0000-0000-0000-0000000000c1', 'quién encuestó';

  -- 2. Solo lo mínimo (consentimiento): todo lo demás es opcional
  insert into tintero_surveys (tintero_id, consent) values (t, true);

  -- 3. Sin consentimiento, fuera de rango o con opciones que no existen: no entra
  begin insert into tintero_surveys (tintero_id, consent) values (t, false); assert false, 'sin consentimiento';
  exception when check_violation then null; end;
  begin insert into tintero_surveys (tintero_id, consent, days_per_week) values (t, true, 9); assert false, 'días';
  exception when check_violation then null; end;
  begin insert into tintero_surveys (tintero_id, consent, gender) values (t, true, 'x'); assert false, 'género';
  exception when check_violation then null; end;
  begin insert into tintero_surveys (tintero_id, consent, payments) values (t, true, array['bitcoin']); assert false, 'pagos';
  exception when check_violation then null; end;
  begin insert into tintero_surveys (tintero_id, consent, coffee_brand) values (t, true, ''); assert false, 'marca vacía';
  exception when check_violation then null; end;
  begin insert into tintero_surveys (tintero_id, consent, offer_choice) values (t, true, 'otra'); assert false, 'preparación o termo';
  exception when check_violation then null; end;
  begin insert into tintero_surveys (tintero_id, consent, offer_choice, thermo_cups_day) values (t, true, 'termo', 900); assert false, 'tazas del termo';
  exception when check_violation then null; end;
  assert (select count(*) from tintero_surveys) = 2, 'dos encuestas';

  -- 4. Escenario privado: se guarda y se reemplaza
  insert into pilot_scenarios (key, data) values ('reunion', '{"kitCost": 250000}');
  insert into pilot_scenarios (key, data) values ('reunion', '{"kitCost": 300000}')
    on conflict (key) do update set data = excluded.data, updated_at = now();
  assert (select (data->>'kitCost')::int from pilot_scenarios where key = 'reunion') = 300000, 'escenario';
  begin insert into pilot_scenarios (key, data) values ('mal', '[1]'); assert false, 'escenario no objeto';
  exception when check_violation then null; end;
  raise notice 'encuestas y escenario: OK';
end $t$;

-- 5. Alguien con sesión pero sin ser del equipo no ve ni escribe nada
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ff';
do $t$ begin
  assert (select count(*) from tintero_surveys) = 0, 'no admin ve encuestas';
  assert (select count(*) from pilot_scenarios) = 0, 'no admin ve el escenario';
  begin insert into tintero_surveys (tintero_id, consent) values ('30000000-0000-0000-0000-000000000001', true); assert false, 'no admin encuesta';
  exception when insufficient_privilege then null; end;
  raise notice 'sin ser del equipo: nada OK';
end $t$;

-- 6. Anónimo: ni encuestas ni escenario (sin privilegio sobre las tablas)
reset role;
reset request.jwt.claim.sub;
set role anon;
do $t$ begin
  begin perform count(*) from tintero_surveys; assert false, 'anon lee encuestas';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from pilot_scenarios; assert false, 'anon lee el escenario';
  exception when insufficient_privilege then null; end;
  raise notice 'anon: nada OK';
end $t$;
reset role;

-- 7. Borrar el tintero borra sus encuestas
delete from tinteros where id = '30000000-0000-0000-0000-000000000001';
do $t$ begin assert (select count(*) from tintero_surveys) = 0, 'cascada'; raise notice 'cascada OK'; end $t$;
-- Deja la base como la espera seed.sql
delete from pilot_scenarios; delete from admin_users;

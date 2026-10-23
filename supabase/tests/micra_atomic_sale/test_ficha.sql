-- Ficha del tintero con los datos del estudio: valores válidos entran, los
-- que no existen no, y una ficha vieja (sin nada nuevo) sigue valiendo.
\set ON_ERROR_STOP 1
do $t$ begin
  insert into tinteros (id, name, localidad, formato, recorrido, hora_inicio, hora_fin, termos, products, perico_price,
                        client_mix, client_types, payments_seen, ipes)
  values ('50000000-0000-0000-0000-000000000001', 'Marlene', 'Chapinero', 'termos_a_pie', 'ruta', 6, 11, 3,
          array['tinto', 'perico'], 1700, 'fijos', array['porteros', 'obreros'], array['efectivo', 'fiado'], 'no_sabe');
  insert into tinteros (id, name) values ('50000000-0000-0000-0000-000000000002', 'Ficha vieja');
  -- Las localidades que no eran del estudio también entran
  insert into tinteros (id, name, localidad) values ('50000000-0000-0000-0000-000000000003', 'Don Ernesto', 'Ciudad Bolívar');
  update tinteros set localidad = 'Sumapaz' where id = '50000000-0000-0000-0000-000000000003';
  begin insert into tinteros (name, localidad) values ('x', 'Medellín'); assert false, 'localidad';
  exception when check_violation then null; end;
  begin insert into tinteros (name, hora_inicio, hora_fin) values ('x', 10, 9); assert false, 'horario';
  exception when check_violation then null; end;
  begin insert into tinteros (name, products) values ('x', array['whisky']); assert false, 'producto';
  exception when check_violation then null; end;
  begin insert into tinteros (name, payments_seen) values ('x', array['bitcoin']); assert false, 'pago';
  exception when check_violation then null; end;
  begin insert into tinteros (name, termos) values ('x', 50); assert false, 'termos';
  exception when check_violation then null; end;
  delete from tinteros where id in ('50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003');
  raise notice 'ficha del estudio: OK';
end $t$;

-- Permiso de publicidad (filtro «Tintero aliado»): apagado por defecto
do $$
declare t uuid;
begin
  insert into tinteros (name) values ('Prueba publicidad') returning id into t;
  assert (select ad_consent from tinteros where id = t) = false, 'publicidad apagada por defecto';
  assert (select ad_consent_at from tinteros where id = t) is null, 'sin fecha de permiso';
  delete from tinteros where id = t;
end $$;

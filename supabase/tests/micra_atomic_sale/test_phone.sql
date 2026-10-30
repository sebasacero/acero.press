-- Entrar con el celular (20261030120000_micra_phone_login.sql): el número sale
-- de auth.users, se compara normalizado, un número repetido no enlaza a nadie
-- y solo el equipo pone o ve celulares.
\set ON_ERROR_STOP 1
-- La réplica de auth.users solo tiene id: lo que Supabase guarda del SMS
alter table auth.users add column if not exists phone text;
alter table auth.users add column if not exists phone_confirmed_at timestamptz;
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000e1', '573001234567', now()),   -- Marlene, verificado
  ('00000000-0000-0000-0000-0000000000e2', '573109998877', now()),   -- nadie lo tiene
  ('00000000-0000-0000-0000-0000000000e3', '573205556677', now()),   -- dos fichas con su número
  ('00000000-0000-0000-0000-0000000000e4', '573001234567', null),    -- el de Marlene sin verificar
  ('00000000-0000-0000-0000-0000000000e5', null, null),              -- entró con Google
  ('00000000-0000-0000-0000-0000000000e6', '573001234567', now());   -- otro celular con el número de Marlene
insert into admin_users (auth_user_id, role) values ('00000000-0000-0000-0000-0000000000c2', 'owner');
insert into tinteros (id, name, zone, phone, stage) values
  ('41000000-0000-0000-0000-000000000001', 'Marlene', 'Chapinero', null, 'piloto'),
  ('41000000-0000-0000-0000-000000000002', 'Gemela A', 'Kennedy', '573205556677', 'piloto'),
  ('41000000-0000-0000-0000-000000000003', 'Gemela B', 'Kennedy', '3205556677', 'prospecto'),
  ('41000000-0000-0000-0000-000000000004', 'Se fue', 'Suba', '573109998877', 'salio');

do $t$ begin
  assert micra_co_phone('300 123 4567') = '+573001234567', 'con espacios';
  assert micra_co_phone('+57 300-123-4567') = '+573001234567', 'con +57';
  assert micra_co_phone('0057 3001234567') = '+573001234567', 'con 0057';
  assert micra_co_phone('601 123 4567') is null, 'fijo no';
  assert micra_co_phone('') is null and micra_co_phone(null) is null, 'vacío';
  raise notice 'normalizar OK';
end $t$;

-- 1. El equipo pone el celular de Marlene (como lo dicten) y ve los de todos
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
do $t$ begin
  assert micra_barista_phone_set('41000000-0000-0000-0000-000000000001', '300 123 4567')->>'phone' = '573001234567', 'se guarda con el 57';
  assert micra_barista_phones()->>'41000000-0000-0000-0000-000000000001' = '573001234567', 'lo ve';
  assert not (micra_barista_phones() ? '41000000-0000-0000-0000-000000000004'), 'sin los que salieron';
  begin perform micra_barista_phone_set('41000000-0000-0000-0000-000000000001', '12345'); assert false, 'número malo';
  exception when invalid_parameter_value then null; end;
  -- Un número es de un solo barista
  begin perform micra_barista_phone_set('41000000-0000-0000-0000-000000000003', '+57 300 123 4567'); assert false, 'número repetido';
  exception when unique_violation then null; end;
  raise notice 'equipo pone celulares OK';
end $t$;

-- 2. Alguien que no es del equipo no pone ni ve celulares
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
do $t$ begin
  begin perform micra_barista_phone_set('41000000-0000-0000-0000-000000000001', '3109998877'); assert false, 'no admin pone';
  exception when insufficient_privilege then null; end;
  begin perform micra_barista_phones(); assert false, 'no admin ve';
  exception when insufficient_privilege then null; end;
  -- Su número no está (el de la ficha que salió no cuenta)
  begin perform tintero_claim_phone(); assert false, 'número sin ficha';
  exception when no_data_found then null; end;
  assert tintero_me() is null, 'sigue sin enlace';
  raise notice 'sin ficha OK';
end $t$;

-- 3. Sin SMS verificado (o con Google) no se busca nada
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e4';
do $t$ begin
  begin perform tintero_claim_phone(); assert false, 'sin verificar';
  exception when insufficient_privilege then null; end;
  raise notice 'sin verificar OK';
end $t$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e5';
do $t$ begin
  begin perform tintero_claim_phone(); assert false, 'Google';
  exception when insufficient_privilege then null; end;
end $t$;

-- 4. Dos fichas con el mismo número: no enlaza ninguna
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
do $t$ begin
  begin perform tintero_claim_phone(); assert false, 'ambiguo';
  exception when cardinality_violation then null; end;
  assert tintero_me() is null, 'ninguna enlazada';
  raise notice 'número repetido OK';
end $t$;

-- 5. Marlene entra con su celular: queda enlazada; volver a llamar devuelve lo mismo
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
do $t$ declare me jsonb; begin
  me := tintero_claim_phone();
  assert me->>'name' = 'Marlene', 'enlazada';
  assert tintero_claim_phone()->>'id' = me->>'id', 'otra vez, lo mismo';
  raise notice 'entrar con el celular OK';
end $t$;

-- 6. Otra cuenta con el mismo número no se lleva la ficha
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e6';
do $t$ begin
  begin perform tintero_claim_phone(); assert false, 'ya enlazada';
  exception when unique_violation then null; end;
  raise notice 'ya enlazada OK';
end $t$;
reset role;
reset request.jwt.claim.sub;

do $t$ begin
  assert (select user_id from tinteros where id = '41000000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-0000000000e1', 'user_id de Marlene';
  assert (select count(*) from tinteros where id in ('41000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000003') and user_id is not null) = 0, 'gemelas sin enlace';
end $t$;

-- anon no llama nada de esto
set role anon;
do $t$ begin
  begin perform tintero_claim_phone(); assert false, 'anon';
  exception when insufficient_privilege then null; end;
  begin perform micra_barista_phone_set('41000000-0000-0000-0000-000000000001', null); assert false, 'anon pone';
  exception when insufficient_privilege then null; end;
  raise notice 'anon: nada OK';
end $t$;
reset role;

-- Deja la base como la espera seed.sql
delete from tinteros where id::text like '41000000-%';
delete from admin_users where auth_user_id = '00000000-0000-0000-0000-0000000000c2';
delete from auth.users where id::text like '00000000-0000-0000-0000-0000000000e%';

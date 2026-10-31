-- Flujo del barista (20261031130000_micra_barista_flow.sql): acepta el mapa él
-- mismo, escoge medios de pago sin número, cómo sale y sus productos propios,
-- que se cuentan con el precio de la base.
\set ON_ERROR_STOP 1
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1'), ('00000000-0000-0000-0000-0000000000f2'), ('00000000-0000-0000-0000-0000000000ff') on conflict do nothing;
insert into tinteros (id, name, zone, stage, user_id, tinto_price, payments_seen) values
  ('43000000-0000-0000-0000-000000000001', 'Flor', 'Chapinero', 'piloto', '00000000-0000-0000-0000-0000000000f1', 1500, array['efectivo', 'fiado']),
  ('43000000-0000-0000-0000-000000000002', 'Otro', 'Suba', 'piloto', '00000000-0000-0000-0000-0000000000f2', 1200, null);

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
do $t$
declare p jsonb; k text; s jsonb;
begin
  -- El mapa público: lo prende y lo apaga él
  assert (micra_barista_public(true)->>'public')::boolean, 'se prende';
  assert micra_barista_extras()->>'public_at' is not null, 'queda con fecha';
  assert not (micra_barista_public(false)->>'public')::boolean, 'se apaga';
  assert micra_barista_extras()->>'public_at' is null, 'sin fecha al apagar';

  -- Medios de pago: solo los conocidos; el fiado del estudio se conserva
  perform micra_barista_payments_set(array['nequi', 'efectivo']);
  assert micra_barista_extras()->'payments' = '["efectivo", "nequi"]'::jsonb or micra_barista_extras()->'payments' = '["nequi", "efectivo"]'::jsonb, 'extras sin fiado';
  begin perform micra_barista_payments_set(array['tarjeta']); assert false, 'medio raro';
  exception when invalid_parameter_value then null; end;

  -- Cómo sale
  assert micra_barista_mode('sombrilla') = 'sombrilla', 'modo';
  assert micra_barista_extras()->>'out_mode' = 'sombrilla', 'se lee';
  begin perform micra_barista_mode('bici'); assert false, 'modo raro';
  exception when invalid_parameter_value then null; end;

  -- Producto propio: se cuenta con el precio de la base, no el del celular
  p := micra_barista_product_add('  Empanada ', 2500);
  k := p->>'id';
  assert k ~ '^x[0-9a-f]{10}$', 'clave corta';
  assert p->>'label' = 'Empanada', 'nombre limpio';
  s := micra_barista_sale('flow-ref-0001', k, 2, null);
  assert (s->>'total')::numeric = 5000, 'precio de la base';
  assert (micra_barista_sale('flow-ref-0001', k, 2, null)->>'replay')::boolean, 'reintento no cobra dos veces';
  begin perform micra_barista_product_add('Pan', 60000); assert false, 'precio alto';
  exception when invalid_parameter_value then null; end;
  begin perform micra_barista_product_add('x', 100); assert false, 'nombre corto';
  exception when invalid_parameter_value then null; end;

  -- Quitar: ya no se vende, pero la venta de antes se queda
  assert micra_barista_product_remove(k), 'se quita';
  assert jsonb_array_length(micra_barista_extras()->'products') = 0, 'sin productos';
  begin perform micra_barista_sale('flow-ref-0002', k, 1, null); assert false, 'quitado no se vende';
  exception when invalid_parameter_value then null; end;
  -- Seis como máximo
  for i in 1..6 loop perform micra_barista_product_add('Prod ' || i, 1000); end loop;
  begin perform micra_barista_product_add('Prod 7', 1000); assert false, 'máximo 6';
  exception when invalid_parameter_value then null; end;
  raise notice 'flujo del barista OK';
end $t$;

reset role;
-- Lo guardado, visto como la base (sin RLS)
do $t$ begin
  assert (select payments_seen @> array['nequi', 'efectivo', 'fiado'] from tinteros where name = 'Flor'), 'guarda y conserva el fiado';
  assert (select count(*) from tintero_sales where client_ref = 'flow-ref-0001') = 1, 'una sola venta';
  assert (select count(*) from tintero_sales s join micra_barista_products p on p.key = s.product where p.removed_at is not null) = 1, 'venta vieja intacta';
  perform set_config('flow.key', (select key from micra_barista_products where removed_at is null limit 1), false);
  raise notice 'lo guardado OK';
end $t$;
set role authenticated;
-- Otro barista no vende ni quita lo de Flor
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
do $t$
declare k text := current_setting('flow.key');
begin
  begin perform micra_barista_sale('flow-ref-0003', k, 1, null); assert false, 'producto ajeno';
  exception when invalid_parameter_value then null; end;
  assert not micra_barista_product_remove(k), 'no quita lo ajeno';
  begin perform micra_barista_extras('43000000-0000-0000-0000-000000000001'); assert false, 'no ve lo ajeno';
  exception when insufficient_privilege then null; end;
  raise notice 'lo ajeno OK';
end $t$;

-- Sin sesión de barista no acepta el mapa por nadie
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ff';
do $t$ begin
  begin perform micra_barista_public(true); assert false, 'sin ficha';
  exception when insufficient_privilege then null; end;
  raise notice 'sin ficha OK';
end $t$;
reset role;

-- Freno por red (20261108120000_micra_net_brake.sql): con llaves inventadas desde
-- una misma IP ya no se llena el mapa, ni un barista, ni el podio. Sin cabeceras
-- (como psql) no frena; otra red sigue pasando; cambiar lo propio no cuenta.
\set ON_ERROR_STOP 1
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b7') on conflict do nothing;
insert into tinteros (id, name, localidad, stage, ad_consent, user_id, tinto_price, products)
values ('60000000-0000-0000-0000-0000000000b7', 'Freno Prueba', 'Chapinero', 'piloto', true,
        '00000000-0000-0000-0000-0000000000b7', 1500, array['tinto']);
insert into micra_challenges (id, title, kind, starts_on, ends_on)
values ('70000000-0000-0000-0000-0000000000b7', 'Reto freno', 'foto', micra_today() - 1, micra_today() + 5);
insert into micra_posts (id, tintero_id, kind, media_path, status, challenge_id, reviewed_at)
values ('71000000-0000-0000-0000-0000000000b7', '60000000-0000-0000-0000-0000000000b7', 'foto', 'freno/f1.jpg', 'approved',
        '70000000-0000-0000-0000-0000000000b7', now());
insert into micra_ads (id, advertiser, title, cta_url, starts_on, ends_on)
values ('72000000-0000-0000-0000-0000000000b7', 'Prueba', 'Anuncio', 'https://example.com', micra_today() - 1, micra_today() + 1);

set role anon;
reset request.jwt.claim.sub;

-- 0. Sin cabeceras (psql, pruebas): no hay red, no frena
do $t$ begin
  for i in 1..40 loop
    assert (micra_seek('sin-red-' || lpad(i::text, 4, '0'), 4.6 + i * 0.004, -74.07) ->> 'accepted')::boolean, 'sin red: ' || i;
  end loop;
  raise notice 'sin cabeceras: OK';
end $t$;
reset role;
delete from micra_demand;
set role anon;

-- 1. «Busco café»: 30 llaves distintas desde una IP pasan, la 31 no; otra IP sí
do $t$ declare r jsonb; begin
  perform set_config('request.headers', '{"x-forwarded-for": "181.50.1.1, 10.0.0.1"}', false);
  for i in 1..30 loop
    r := micra_seek('bot-' || lpad(i::text, 6, '0'), 4.6 + (i % 20) * 0.004, -74.07);
    assert (r->>'accepted')::boolean, 'seña ' || i || ': ' || r;
  end loop;
  r := micra_seek('bot-000031', 4.65, -74.07);
  assert not (r->>'accepted')::boolean and r->>'reason' = 'red', 'la 31 desde la misma red: ' || r;
  perform set_config('request.headers', '{"cf-connecting-ip": "190.25.9.9"}', false);
  r := micra_seek('otra-red-0001', 4.65, -74.07);
  assert (r->>'accepted')::boolean, 'otra red pasa: ' || r;
  raise notice 'busco café: OK';
end $t$;

-- 2. Apartar: 20 nuevos por hora desde una red; cambiar el propio no cuenta
do $t$ declare h jsonb; begin
  perform set_config('request.headers', '{"x-forwarded-for": "181.50.2.2"}', false);
  for i in 1..20 loop
    perform micra_hold('60000000-0000-0000-0000-0000000000b7', 'falso-' || lpad(i::text, 6, '0'), 'Falso ' || i, '[{"product":"tinto","qty":1}]');
  end loop;
  -- El mismo celular cambia su apartado: sigue pudiendo
  h := micra_hold('60000000-0000-0000-0000-0000000000b7', 'falso-000001', 'Falso 1', '[{"product":"tinto","qty":2}]');
  assert (h->>'cups')::int = 2, 'cambiar el propio no cuenta: ' || h;
  begin
    perform micra_hold('60000000-0000-0000-0000-0000000000b7', 'falso-000021', 'Falso 21', '[{"product":"tinto","qty":1}]');
    assert false, 'el 21 nuevo desde la misma red';
  exception when program_limit_exceeded then null; end;
  perform set_config('request.headers', '{"x-forwarded-for": "181.50.3.3"}', false);
  perform micra_hold('60000000-0000-0000-0000-0000000000b7', 'cliente-real-01', 'Ana', '[{"product":"tinto","qty":1}]');
  raise notice 'apartar: OK';
end $t$;

-- 3. Votos: 8 por entrada al día desde una red; cambiar la nota no cuenta
do $t$ declare v jsonb; begin
  perform set_config('request.headers', '{"x-forwarded-for": "181.50.4.4"}', false);
  for i in 1..8 loop
    perform micra_vote('71000000-0000-0000-0000-0000000000b7', 'votante-' || lpad(i::text, 6, '0'), 5);
  end loop;
  v := micra_vote('71000000-0000-0000-0000-0000000000b7', 'votante-000001', 4);
  assert (v->>'votes')::int = 8, 'cambiar la nota no suma: ' || v;
  begin
    perform micra_vote('71000000-0000-0000-0000-0000000000b7', 'votante-000009', 5);
    assert false, 'el voto 9 desde la misma red';
  exception when program_limit_exceeded then null; end;
  perform set_config('request.headers', '{"x-forwarded-for": "181.50.5.5"}', false);
  v := micra_vote('71000000-0000-0000-0000-0000000000b7', 'votante-otra-01', 5);
  assert (v->>'votes')::int = 9, 'otra red vota: ' || v;
  raise notice 'votos: OK';
end $t$;

-- 4. Anuncios: 200 vistas por hora desde una red; lo demás no cuenta y no da error
do $t$ begin
  perform set_config('request.headers', '{"x-forwarded-for": "181.50.6.6"}', false);
  for i in 1..230 loop perform micra_ad_event('72000000-0000-0000-0000-0000000000b7', 'view'); end loop;
  raise notice 'anuncios: OK';
end $t$;
reset role;
do $t$ begin
  assert (select views from micra_ad_stats where ad_id = '72000000-0000-0000-0000-0000000000b7') = 200, 'solo 200 vistas';
  -- La tabla guarda solo el hash, nunca la IP
  assert not exists (select 1 from micra_net_hits where net_hash like '%181.%'), 'sin IP en claro';
  -- Y no se lee desde la API
  set local role anon;
  begin perform 1 from micra_net_hits; assert false, 'anon lee la tabla';
  exception when insufficient_privilege then null; end;
  begin perform micra_net_allow('seek', 1, interval '1 minute'); assert false, 'anon llama al freno';
  exception when insufficient_privilege then null; end;
  raise notice 'privacidad: OK';
end $t$;
reset request.headers;
delete from micra_demand;

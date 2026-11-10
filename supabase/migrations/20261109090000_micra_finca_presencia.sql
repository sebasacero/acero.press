-- La presencia digital de las fincas cafeteras (9 nov 2026, pedido del usuario).
-- El caficultor que crea su finca en /micra/finca contesta qué tiene en internet
-- (WhatsApp, Instagram, Facebook, Google Maps, web…), a quién le vende y si le interesa
-- vender a baristas. Con su permiso (Ley 1581) se guarda aquí para que el equipo saque
-- la cifra con su margen en Equipo › Hoy › Fincas.
--
-- Sin nombres: ni de la finca ni del caficultor (eso va por WhatsApp al equipo). Para no
-- contar dos veces la misma finca se guarda solo sha256(nombre|municipio). El usuario de
-- Instagram y la web sí, porque son públicos de la finca y sirven para verificarla.
-- Depende de micra_net_allow (20261108120000_micra_net_brake.sql).
set lock_timeout = '5s';

create table if not exists public.micra_finca_presencia (
  id            bigint generated always as identity primary key,
  finca_hash    text not null unique check (char_length(finca_hash) = 64),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  consent_at    timestamptz not null,
  departamento  text check (departamento is null or char_length(departamento) between 3 and 40),
  hectareas     numeric(7, 1) check (hectareas is null or hectareas between 0 and 100000),
  canales       text[] not null default '{}',
  nivel         smallint not null check (nivel between 0 and 3),
  venta         text check (venta is null or venta in ('cooperativa', 'intermediario', 'exportador', 'marca')),
  interes       text check (interes is null or interes in ('si', 'tal_vez', 'no')),
  ig            text check (ig is null or ig ~ '^[a-z0-9._]{1,30}$'),
  web           text check (web is null or (web ~ '^https://' and char_length(web) <= 200)),
  ref           text check (ref is null or ref ~ '^[a-z0-9-]{1,32}$'),
  muestra       boolean not null default false
);
create index if not exists micra_finca_presencia_created_idx on public.micra_finca_presencia (created_at desc);
alter table public.micra_finca_presencia enable row level security;
-- Sin políticas: solo por las funciones de abajo
revoke all on public.micra_finca_presencia from anon, authenticated;

-- El caficultor (sin cuenta) guarda o cambia sus respuestas. Solo con permiso.
create or replace function public.micra_finca_presencia_add(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_key text := lower(btrim(coalesce(p->>'finca_key', '')));
  v_canales text[];
  v_nivel int;
begin
  if coalesce((p->>'consent')::boolean, false) is not true then
    return jsonb_build_object('saved', false, 'reason', 'sin_permiso');
  end if;
  if char_length(v_key) not between 3 and 200 then
    raise exception 'Falta el nombre de la finca.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct c), '{}') into v_canales
  from jsonb_array_elements_text(coalesce(p->'canales', '[]'::jsonb)) as c
  where c in ('whatsapp', 'whatsapp_business', 'instagram', 'facebook', 'tiktok', 'maps', 'tienda', 'web', 'ninguna');
  if cardinality(v_canales) = 0 then
    raise exception 'Cuéntanos qué tiene tu finca en internet.' using errcode = '22023';
  end if;
  -- El nivel lo pone la base, no el celular
  v_nivel := case
    when v_canales && array['tienda', 'web'] then 3
    when v_canales && array['whatsapp_business', 'instagram', 'facebook', 'tiktok', 'maps'] then 2
    when 'whatsapp' = any(v_canales) then 1
    else 0 end;
  if not public.micra_net_allow('finca_presencia', 20, interval '1 hour') then
    return jsonb_build_object('saved', false, 'reason', 'red');
  end if;

  insert into public.micra_finca_presencia as f
    (finca_hash, consent_at, departamento, hectareas, canales, nivel, venta, interes, ig, web, ref, muestra)
  values (
    encode(sha256(convert_to(v_key, 'UTF8')), 'hex'), now(),
    nullif(left(btrim(p->>'departamento'), 40), ''),
    case when (p->>'hectareas') ~ '^\d{1,6}(\.\d)?$' then (p->>'hectareas')::numeric end,
    v_canales, v_nivel,
    case when p->>'venta' in ('cooperativa', 'intermediario', 'exportador', 'marca') then p->>'venta' end,
    case when p->>'interes' in ('si', 'tal_vez', 'no') then p->>'interes' end,
    case when lower(p->>'ig') ~ '^[a-z0-9._]{1,30}$' then lower(p->>'ig') end,
    case when p->>'web' ~ '^https://[^\s]+$' and char_length(p->>'web') <= 200 then p->>'web' end,
    case when p->>'ref' ~ '^[a-z0-9-]{1,32}$' then p->>'ref' end,
    coalesce((p->>'muestra')::boolean, false)
  )
  on conflict (finca_hash) do update set
    updated_at = now(), consent_at = now(), departamento = excluded.departamento, hectareas = excluded.hectareas,
    canales = excluded.canales, nivel = excluded.nivel, venta = excluded.venta, interes = excluded.interes,
    ig = excluded.ig, web = excluded.web,
    -- La primera invitación es la que cuenta; quien salió del sorteo sigue en la muestra
    ref = coalesce(f.ref, excluded.ref), muestra = f.muestra or excluded.muestra;
  return jsonb_build_object('saved', true);
end;
$$;
revoke all on function public.micra_finca_presencia_add(jsonb) from public;
grant execute on function public.micra_finca_presencia_add(jsonb) to anon, authenticated;

-- El equipo: las respuestas sin nada que identifique a la persona (el resumen se cuenta en la app).
create or replace function public.micra_finca_presencia_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo ve el estudio de fincas.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'created_at', created_at, 'departamento', departamento, 'hectareas', hectareas, 'canales', canales, 'nivel', nivel,
      'venta', venta, 'interes', interes, 'ig', ig, 'web', web, 'ref', ref, 'muestra', muestra) order by created_at desc)
    from public.micra_finca_presencia), '[]'::jsonb);
end;
$$;
revoke all on function public.micra_finca_presencia_list() from public, anon;
grant execute on function public.micra_finca_presencia_list() to authenticated;

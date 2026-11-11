-- Celestra (11 nov 2026, pedido del usuario): la inteligencia de Micra para el dueño.
-- Guarda el parte del día con sus propuestas, lo que el dueño decide sobre cada una
-- (la memoria de Celestra) y cada corrida con lo que costó (el tope de US$50 al mes).
-- Tablas sin políticas: todo pasa por funciones que verifican que sea el owner.
-- Idempotente. Tablas nuevas: no hace falta lock_timeout.

create table if not exists public.celestra_runs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('pregunta', 'parte')),
  model text,
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cache_read_tokens int not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens int not null default 0 check (cache_write_tokens >= 0),
  cost_usd numeric(10, 4) not null default 0 check (cost_usd >= 0),
  tools text[] not null default '{}'
);
create index if not exists celestra_runs_at on public.celestra_runs (at);

create table if not exists public.celestra_partes (
  day date primary key,
  resumen text not null check (length(resumen) between 1 and 400),
  run_id bigint references public.celestra_runs (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.celestra_propuestas (
  id uuid primary key default gen_random_uuid(),
  day date not null references public.celestra_partes (day) on delete cascade,
  pos smallint not null check (pos between 1 and 3),
  oficio text not null check (oficio in ('estudio', 'calle', 'clientes', 'mercado', 'fincas', 'equipo')),
  titulo text not null check (length(titulo) between 1 and 90),
  por_que text not null check (length(por_que) between 1 and 260),
  accion text check (accion is null or length(accion) <= 220),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'descartada', 'hecha')),
  nota text check (nota is null or length(nota) <= 200),
  decided_at timestamptz,
  unique (day, pos)
);

alter table public.celestra_runs enable row level security;
alter table public.celestra_partes enable row level security;
alter table public.celestra_propuestas enable row level security;
revoke all on public.celestra_runs, public.celestra_partes, public.celestra_propuestas from anon, authenticated;

-- Solo el dueño (rol owner), no cualquier admin: Celestra habla solo con él
create or replace function public.celestra_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where auth_user_id = auth.uid() and role = 'owner');
$$;
revoke all on function public.celestra_is_owner() from public, anon;
grant execute on function public.celestra_is_owner() to authenticated;

-- Lo que ve la tarjeta: el parte de hoy, lo gastado este mes y lo decidido en 30 días
create or replace function public.celestra_estado()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hoy date := public.micra_today();
  mes timestamptz := (date_trunc('month', now() at time zone 'America/Bogota')) at time zone 'America/Bogota';
begin
  if not public.celestra_is_owner() then
    raise exception 'Celestra es solo para el dueño.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'hoy', hoy,
    'gastado_mes', coalesce((select sum(cost_usd) from public.celestra_runs where at >= mes), 0),
    'corridas_mes', (select count(*) from public.celestra_runs where at >= mes),
    'parte', (select jsonb_build_object('day', p.day, 'resumen', p.resumen, 'propuestas', coalesce((
        select jsonb_agg(jsonb_build_object('id', x.id, 'pos', x.pos, 'oficio', x.oficio, 'titulo', x.titulo, 'por_que', x.por_que,
          'accion', x.accion, 'estado', x.estado, 'nota', x.nota) order by x.pos)
        from public.celestra_propuestas x where x.day = p.day), '[]'::jsonb))
      from public.celestra_partes p where p.day = hoy),
    'decisiones', coalesce((select jsonb_agg(jsonb_build_object('dia', x.day, 'titulo', x.titulo, 'estado', x.estado, 'nota', x.nota)
        order by x.decided_at desc)
      from (select * from public.celestra_propuestas
             where estado <> 'pendiente' and day > hoy - 30 order by decided_at desc nulls last limit 20) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.celestra_estado() from public, anon;
grant execute on function public.celestra_estado() to authenticated;

-- Anota una corrida y, si trae parte, lo guarda con sus propuestas en la misma transacción.
-- Si ya hay parte de hoy (dos pestañas a la vez), se queda el primero.
create or replace function public.celestra_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy date := public.micra_today();
  rid bigint;
  pr jsonb;
  i int := 0;
begin
  if not public.celestra_is_owner() then
    raise exception 'Celestra es solo para el dueño.' using errcode = '42501';
  end if;
  insert into public.celestra_runs (kind, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, tools)
  values (
    case when p->>'kind' = 'parte' then 'parte' else 'pregunta' end,
    left(p->>'model', 60),
    greatest(0, coalesce((p->>'input_tokens')::int, 0)),
    greatest(0, coalesce((p->>'output_tokens')::int, 0)),
    greatest(0, coalesce((p->>'cache_read_tokens')::int, 0)),
    greatest(0, coalesce((p->>'cache_write_tokens')::int, 0)),
    greatest(0, coalesce((p->>'cost_usd')::numeric, 0)),
    coalesce((select array_agg(left(t, 40)) from jsonb_array_elements_text(coalesce(p->'tools', '[]'::jsonb)) t), '{}')
  ) returning id into rid;

  if p->>'kind' = 'parte' and p ? 'parte' then
    insert into public.celestra_partes (day, resumen, run_id)
    values (hoy, left(p->'parte'->>'resumen', 400), rid)
    on conflict (day) do nothing;
    if found then
      for pr in select * from jsonb_array_elements(coalesce(p->'parte'->'propuestas', '[]'::jsonb)) loop
        i := i + 1;
        exit when i > 3;
        insert into public.celestra_propuestas (day, pos, oficio, titulo, por_que, accion)
        values (hoy, i,
          case when pr->>'oficio' in ('estudio', 'calle', 'clientes', 'mercado', 'fincas', 'equipo') then pr->>'oficio' else 'equipo' end,
          left(pr->>'titulo', 90), left(pr->>'por_que', 260), nullif(left(pr->>'accion', 220), ''));
      end loop;
    end if;
  end if;
  return public.celestra_estado();
end;
$$;
revoke all on function public.celestra_guardar(jsonb) from public, anon;
grant execute on function public.celestra_guardar(jsonb) to authenticated;

-- El dueño decide sobre una propuesta: aprobada, descartada o hecha, con una nota opcional
create or replace function public.celestra_decidir(p_id uuid, p_estado text, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.celestra_is_owner() then
    raise exception 'Celestra es solo para el dueño.' using errcode = '42501';
  end if;
  if p_estado not in ('aprobada', 'descartada', 'hecha') then
    raise exception 'Estado no válido.' using errcode = '22023';
  end if;
  update public.celestra_propuestas
     set estado = p_estado, nota = nullif(left(btrim(coalesce(p_nota, '')), 200), ''), decided_at = now()
   where id = p_id;
  if not found then
    raise exception 'No existe esa propuesta.' using errcode = 'P0002';
  end if;
  return public.celestra_estado();
end;
$$;
revoke all on function public.celestra_decidir(uuid, text, text) from public, anon;
grant execute on function public.celestra_decidir(uuid, text, text) to authenticated;

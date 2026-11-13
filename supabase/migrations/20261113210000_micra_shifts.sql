-- Turnos de los baristas (13 nov 2026, pedido del usuario: «todo esto también debe verse en
-- tiempo real para nuestro panel de control ya que debemos analizar quién entra y sale, la
-- disponibilidad y demás»).
--
-- Cada salida a la calle es un turno: empieza con «Salí a vender» y termina con «Terminar
-- turno» (end_kind 'turno'), con la flecha ← (end_kind 'volver') o sola a la hora que escogió
-- (end_kind 'auto', se cierra en la siguiente llamada o se calcula al leer). Solo el equipo lo
-- lee, con micra_shifts_board. Sin puntos de GPS: el turno guarda horas, modo y nada más.
set lock_timeout = '5s';

create table if not exists public.micra_shifts (
  id            bigint generated always as identity primary key,
  tintero_id    uuid not null references public.tinteros(id) on delete cascade,
  started_at    timestamptz not null default now(),
  planned_until timestamptz not null,
  ended_at      timestamptz,
  end_kind      text check (end_kind in ('turno', 'volver', 'auto')),
  mode          text check (mode is null or mode in ('fijo', 'sombrilla', 'caminando'))
);
create index if not exists micra_shifts_open on public.micra_shifts (tintero_id) where ended_at is null;
create index if not exists micra_shifts_started on public.micra_shifts (started_at);
alter table public.micra_shifts enable row level security;
revoke all on public.micra_shifts from public, anon, authenticated;

-- La misma salida de siempre, con un parámetro más: p_end = 'turno' cuando el barista toca
-- «Terminar turno». Se borra la firma vieja para que la llamada sin p_end no sea ambigua.
drop function if exists public.micra_barista_out(int, numeric, numeric, uuid);
create or replace function public.micra_barista_out(p_minutes int, p_lat numeric default null, p_lng numeric default null, p_tintero_id uuid default null, p_end text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  v_until timestamptz := case when coalesce(p_minutes, 0) > 0 then now() + make_interval(mins => least(p_minutes, 360)) end;
  v_ok boolean := p_lat between 3.7 and 4.85 and p_lng between -74.5 and -73.95;
  v_mode text;
  v_shift bigint;
begin
  update public.tinteros set
    out_until = v_until,
    out_lat = case when v_until is null then null when v_ok then round(p_lat, 3) end,
    out_lng = case when v_until is null then null when v_ok then round(p_lng, 3) end
  where id = v
  returning out_mode into v_mode;

  -- Lo que se apagó solo a su hora se cierra a esa hora
  update public.micra_shifts set ended_at = planned_until, end_kind = 'auto'
  where tintero_id = v and ended_at is null and planned_until <= now();

  if v_until is not null then
    -- Salir otra vez con el turno abierto solo corre la hora de cierre
    update public.micra_shifts set planned_until = v_until, mode = coalesce(v_mode, mode)
    where tintero_id = v and ended_at is null
    returning id into v_shift;
    if v_shift is null then
      insert into public.micra_shifts (tintero_id, planned_until, mode)
      values (v, v_until, case when v_mode in ('fijo', 'sombrilla', 'caminando') then v_mode end);
    end if;
  else
    update public.micra_shifts
    set ended_at = now(), end_kind = case when p_end = 'turno' then 'turno' else 'volver' end
    where tintero_id = v and ended_at is null;
  end if;
  return jsonb_build_object('live_until', v_until);
end;
$$;
revoke all on function public.micra_barista_out(int, numeric, numeric, uuid, text) from public, anon;
grant execute on function public.micra_barista_out(int, numeric, numeric, uuid, text) to authenticated;

-- Para el panel: los turnos de los últimos p_days días (1 a 31) con el nombre de pila y las
-- tazas vendidas dentro del turno. Lo vencido sin cerrar sale cerrado a su hora ('auto').
create or replace function public.micra_shifts_board(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare d int := greatest(1, least(coalesce(p_days, 7), 31));
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo ve los turnos.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', d,
    'now', now(),
    'shifts', (select coalesce(jsonb_agg(row order by row->>'started_at' desc), '[]'::jsonb) from (
      select jsonb_build_object(
        'id', s.id,
        'tintero_id', s.tintero_id,
        'name', split_part(coalesce(t.name, 'Barista'), ' ', 1),
        'started_at', s.started_at,
        'planned_until', s.planned_until,
        'ended_at', coalesce(s.ended_at, case when s.planned_until <= now() then s.planned_until end),
        'end_kind', coalesce(s.end_kind, case when s.planned_until <= now() then 'auto' end),
        'mode', s.mode,
        'cups', (select coalesce(sum(x.qty), 0) from public.tintero_sales x
                 where x.tintero_id = s.tintero_id and x.voided_at is null
                   and x.sold_at >= s.started_at
                   and x.sold_at <= coalesce(s.ended_at, least(s.planned_until, now())))
      ) as row
      from public.micra_shifts s
      join public.tinteros t on t.id = s.tintero_id
      where s.started_at >= now() - make_interval(days => d)
    ) q)
  );
end;
$$;
revoke all on function public.micra_shifts_board(int) from public, anon;
grant execute on function public.micra_shifts_board(int) to authenticated;

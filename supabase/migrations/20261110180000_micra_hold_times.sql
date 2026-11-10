-- Tiempos del apartado y cancelaciones con motivo (pedido del usuario, 10 nov 2026, después de
-- preguntar cómo controlan Rappi y Uber su operación). Tres datos nuevos en cada apartado:
--   seen_at        cuándo el barista lo vio en su celular por primera vez
--   closed_at      cuándo dejó de esperar (entregado, no llegó o cancelado), lo pone un trigger
--   cancel_reason  por qué lo canceló el cliente, si lo dijo
-- y un resumen solo para el equipo, micra_hold_times(): medianas y peor 10 % en minutos, nunca
-- quién. Idempotente.
set lock_timeout = '5s';

alter table public.micra_holds
  add column if not exists seen_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists cancel_reason text;

do $$ begin
  alter table public.micra_holds add constraint micra_holds_cancel_reason_check
    check (cancel_reason is null or cancel_reason in ('tarde', 'no_llego', 'cambie', 'otro'));
exception when duplicate_object then null; end $$;

-- closed_at: el momento en que deja de esperar, sin tocar micra_hold_close ni micra_hold_cancel
create or replace function public.micra_holds_closed_at()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'waiting' and new.status <> 'waiting' and new.closed_at is null then
    new.closed_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists micra_holds_closed_at on public.micra_holds;
create trigger micra_holds_closed_at before update of status on public.micra_holds
  for each row execute function public.micra_holds_closed_at();

-- El cliente cancela y, si quiere, dice por qué. Se reemplaza la de dos argumentos: con el
-- motivo opcional, una app vieja que manda dos sigue funcionando.
drop function if exists public.micra_hold_cancel(text, uuid);
create or replace function public.micra_hold_cancel(p_client_ref text, p_hold_id uuid, p_reason text default null)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  with c as (
    update public.micra_holds
       set status = 'cancelled', updated_at = now(),
           cancel_reason = case when p_reason in ('tarde', 'no_llego', 'cambie', 'otro') then p_reason end
     where id = p_hold_id and client_ref = p_client_ref and status = 'waiting'
    returning 1
  ) select exists (select 1 from c);
$$;
revoke all on function public.micra_hold_cancel(text, uuid, text) from public;
grant execute on function public.micra_hold_cancel(text, uuid, text) to anon, authenticated;

-- El barista vio sus apartados: solo la primera vez cuenta
create or replace function public.micra_holds_seen(p_ids uuid[], p_tintero_id uuid default null)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v uuid := public.micra_actor(p_tintero_id); n int;
begin
  if coalesce(array_length(p_ids, 1), 0) > 50 then
    raise exception 'Demasiados apartados.' using errcode = '22023';
  end if;
  update public.micra_holds set seen_at = now()
   where id = any (p_ids) and tintero_id = v and seen_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.micra_holds_seen(uuid[], uuid) from public, anon;
grant execute on function public.micra_holds_seen(uuid[], uuid) to authenticated;

-- El resumen del equipo, de los últimos p_days días (1 a 30)
create or replace function public.micra_hold_times(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare d int := least(30, greatest(1, coalesce(p_days, 7)));
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo.' using errcode = '42501';
  end if;
  return (
    with h as (
      select status, cancel_reason,
             extract(epoch from (seen_at - created_at)) / 60 seen_min,
             extract(epoch from (closed_at - created_at)) / 60 close_min
        from public.micra_holds
       where for_day > public.micra_today() - d
    )
    select jsonb_build_object(
      'days', d,
      'n', count(*),
      'served', count(*) filter (where status = 'served'),
      'missed', count(*) filter (where status = 'missed'),
      'cancelled', count(*) filter (where status = 'cancelled'),
      'waiting', count(*) filter (where status = 'waiting'),
      'seen_n', count(seen_min),
      'seen_p50', round((percentile_cont(0.5) within group (order by seen_min))::numeric, 1),
      'seen_p90', round((percentile_cont(0.9) within group (order by seen_min))::numeric, 1),
      'served_n', count(close_min) filter (where status = 'served'),
      'served_p50', round((percentile_cont(0.5) within group (order by close_min) filter (where status = 'served'))::numeric, 1),
      'served_p90', round((percentile_cont(0.9) within group (order by close_min) filter (where status = 'served'))::numeric, 1),
      'reasons', jsonb_build_object(
        'tarde', count(*) filter (where cancel_reason = 'tarde'),
        'no_llego', count(*) filter (where cancel_reason = 'no_llego'),
        'cambie', count(*) filter (where cancel_reason = 'cambie'),
        'otro', count(*) filter (where cancel_reason = 'otro'))
    ) from h
  );
end;
$$;
revoke all on function public.micra_hold_times(int) from public, anon;
grant execute on function public.micra_hold_times(int) to authenticated;

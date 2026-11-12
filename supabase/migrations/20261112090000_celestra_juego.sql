-- El juego de Celestra (12 nov 2026, pedido del usuario): las cuentas de toda la historia
-- para los puntos, el nivel y la racha. Solo lectura sobre las tablas de Celestra; solo el dueño.
-- Sin esta función la tarjeta cuenta con lo que ve (hoy y las últimas 20 decisiones).
-- Idempotente; no altera tablas.

create or replace function public.celestra_juego()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.celestra_is_owner() then
    raise exception 'Celestra es solo para el dueño.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'partes', (select count(*) from public.celestra_partes),
    'decididas', (select count(*) from public.celestra_propuestas where estado <> 'pendiente'),
    'hechas', (select count(*) from public.celestra_propuestas where estado = 'hecha'),
    -- Días con todas sus propuestas decididas
    'plenos', (select count(*) from (
        select day from public.celestra_propuestas group by day having count(*) filter (where estado = 'pendiente') = 0) d),
    'dias', coalesce((select jsonb_agg(day order by day desc) from (
        select day from public.celestra_partes order by day desc limit 120) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.celestra_juego() from public, anon;
grant execute on function public.celestra_juego() to authenticated;

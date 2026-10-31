-- «Mi perfil» del barista en la app Micra (src/features/micra-app/Perfil.jsx).
-- Solo lectura: lo que la ficha dice de él y que micra_barista_day no trae
-- (su horario, su celular, cómo le pagan y sus permisos). Lo ve el barista de
-- la sesión, o el equipo cuando «actúa como» él (micra_actor). Sin escrituras:
-- precios, pagos y el permiso de ubicación siguen por sus funciones de siempre
-- (micra_barista_prices, micra_barista_pay_set, tintero_consent).
-- Sin la migración la app muestra lo que sí tiene (el día, la sesión, la tarjeta pública).

create or replace function public.micra_barista_profile(p_tintero_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  t public.tinteros;
begin
  select * into t from public.tinteros where id = v;
  return jsonb_build_object(
    'id', t.id, 'name', t.name,
    'referencia', coalesce(t.referencia, t.zone), 'localidad', t.localidad,
    'hora_inicio', t.hora_inicio, 'hora_fin', t.hora_fin,
    -- Su propio número (con el que entra por SMS); la app lo muestra a medias
    'phone', t.phone,
    'pay_nequi', t.pay_nequi, 'pay_daviplata', t.pay_daviplata,
    -- «Salir en el mapa público» (lo firma con el equipo) y la ubicación de «Salí a vender»
    'public', t.ad_consent, 'public_at', t.ad_consent_at,
    'consent_at', t.tracking_consent_at
  );
end;
$$;
revoke all on function public.micra_barista_profile(uuid) from public, anon;
grant execute on function public.micra_barista_profile(uuid) to authenticated;

-- El mapa público también cuenta a los tinteros que solo tienen GPS.
-- Desde 20261024120000_tintero_gps la ficha se levanta en la calle con el
-- punto del celular y la cuadra queda opcional, pero micra_street_map seguía
-- pidiendo `carrera`: con 5 tinteros registrados, la portada decía 0.
-- El punto sale redondeado a 3 decimales (unos 110 m, más o menos una cuadra)
-- y el navegador lo lleva a la cuadra más cercana (streetMap.tinteroBlock).
-- La zona cae a la localidad de la ficha cuando no hay zona.
-- Sin cambios en ventas, firma ni permisos.

create or replace function public.micra_street_map(p_days int default 90)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'days', least(greatest(coalesce(p_days, 90), 1), 365),
    'sales', coalesce((
      select jsonb_agg(jsonb_build_object('carrera', s.c, 'calle', s.k, 'cups', s.n, 'zone', s.zone) order by s.n desc)
      from (
        select round(o.place_carrera) as c, round(o.place_calle) as k,
               mode() within group (order by o.place_zone) as zone,
               sum(coalesce(i.qty, 0))::int as n
        from public.orders o
        left join (select order_id, sum(qty) as qty from public.order_items group by order_id) i on i.order_id = o.id
        where o.source = 'esspresale' and o.status = 'completed' and o.place_carrera is not null
          and o.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 365))
        group by round(o.place_carrera), round(o.place_calle)
      ) s
    ), '[]'::jsonb),
    'tinteros', coalesce((
      select jsonb_agg(jsonb_build_object('carrera', round(t.carrera), 'calle', round(t.calle),
                                          'lat', round(t.lat, 3), 'lng', round(t.lng, 3), 'stage', t.stage,
                                          'cups_per_hour', t.cups_per_hour, 'zone', coalesce(t.zone, t.localidad)) order by t.created_at)
      from public.tinteros t
      where (t.carrera is not null or t.lat is not null) and t.stage <> 'salio'
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.micra_street_map(int) from public;
grant execute on function public.micra_street_map(int) to anon, authenticated;

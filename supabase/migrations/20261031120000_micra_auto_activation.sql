-- Activación automática de Micra: nadie aprueba a mano. Las mismas reglas
-- están en src/features/micra-app/activation.js (la app las muestra).
--
-- Barista (tinteros.stage se mueve solo entre prospecto, piloto y activo):
--   · prospecto: solo la ficha del estudio;
--   · piloto: entró con su celular o su código (cuenta enlazada);
--   · activo: cuenta + permiso para salir en público + precio del tinto. Ahí
--     ya sale en el mapa y recibe apartados (micra_hold pedía lo mismo).
--   «pausa» y «salio» son a mano: el disparador no las toca.
--
-- Cliente (sin cuenta: la llave del celular de micra_holds):
--   · se activa con su primer apartado entregado;
--   · si NO llegó a sus dos últimos apartados (sin una entrega entre ellos,
--     últimos 30 días), no aparta por 7 días desde el último; vuelve solo.
--
-- micra_owner_day suma lo que necesita el resumen del equipo: si tiene
-- celular (sí/no, no el número), última actividad y los clientes en cifras.
set lock_timeout = '5s';

-- ── Barista: la etapa sigue a los requisitos ────────────────────────────
create or replace function public.micra_auto_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.stage in ('prospecto', 'piloto', 'activo') then
    new.stage := case
      when new.user_id is not null and new.ad_consent and new.tinto_price is not null then 'activo'
      when new.user_id is not null then 'piloto'
      else 'prospecto'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists micra_auto_stage on public.tinteros;
create trigger micra_auto_stage
  before insert or update of user_id, ad_consent, tinto_price, stage on public.tinteros
  for each row execute function public.micra_auto_stage();

-- Las fichas de hoy quedan en su etapa (el disparador corre en este update)
update public.tinteros set stage = stage where stage in ('prospecto', 'piloto', 'activo');

-- ── Cliente: freno por no llegar ───────────────────────────────────────
create index if not exists micra_holds_client_idx on public.micra_holds (client_ref, for_day desc);

-- Hasta qué día no aparta este celular (null: puede apartar)
create or replace function public.micra_client_paused_until(p_client_ref text)
returns date
language sql
stable
security definer
set search_path = public
as $$
  with last2 as (
    select status, for_day from public.micra_holds
    where client_ref = p_client_ref and status in ('served', 'missed')
      and for_day > public.micra_today() - 30
    order by for_day desc, updated_at desc
    limit 2
  )
  select case
    when count(*) = 2 and bool_and(status = 'missed') and max(for_day) + 7 > public.micra_today()
    then max(for_day) + 7
  end
  from last2;
$$;
-- La usa micra_owner_day (security invoker, el equipo); solo devuelve una fecha
revoke all on function public.micra_client_paused_until(text) from public, anon;
grant execute on function public.micra_client_paused_until(text) to authenticated;

-- micra_hold igual que en 20261026210000_micra_app.sql, más el freno
create or replace function public.micra_hold(p_tintero_id uuid, p_client_ref text, p_name text, p_items jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t public.tinteros;
  v_items jsonb := '[]'::jsonb;
  v_cups int := 0;
  v_total numeric := 0;
  v_price numeric;
  v_row public.micra_holds;
  v_until date;
  it record;
begin
  select * into t from public.tinteros
  where id = p_tintero_id and ad_consent and stage <> 'salio' and user_id is not null;
  if t.id is null then
    raise exception 'Este barista todavía no recibe apartados en Micra.' using errcode = 'P0002';
  end if;
  v_until := public.micra_client_paused_until(p_client_ref);
  if v_until is not null then
    raise exception 'No llegaste a tus dos últimos apartados. Vuelves a apartar el %; mientras, búscalo en la calle.',
      to_char(v_until, 'DD/MM') using errcode = '42501';
  end if;
  if coalesce(char_length(btrim(p_name)), 0) not between 1 and 40 then
    raise exception 'Escribe tu nombre (el barista te llama por él).' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Elige qué quieres apartar.' using errcode = '22023';
  end if;
  for it in
    select x->>'product' as product, sum((x->>'qty')::int) as qty
    from jsonb_array_elements(p_items) x
    group by 1
  loop
    if it.qty is null or it.qty < 1 then continue; end if;
    v_price := public.micra_price(t, it.product);
    if v_price is null then
      raise exception 'Este barista no tiene precio para «%».', it.product using errcode = '22023';
    end if;
    v_items := v_items || jsonb_build_object('product', it.product, 'qty', it.qty, 'unit_price', v_price);
    v_cups := v_cups + it.qty;
    v_total := v_total + v_price * it.qty;
  end loop;
  if v_cups not between 1 and 6 then
    raise exception 'Se apartan de 1 a 6 tazas.' using errcode = '22023';
  end if;
  -- Freno a los apartados falsos: un barista no recibe más de 60 al día
  if (select count(*) from public.micra_holds where tintero_id = t.id and for_day = public.micra_today() and client_ref <> p_client_ref) >= 60 then
    raise exception 'Hoy % ya tiene muchos apartados. Búscalo en la calle.', split_part(t.name, ' ', 1) using errcode = '54000';
  end if;

  insert into public.micra_holds (tintero_id, client_ref, name, items, cups, total, for_day)
  values (t.id, p_client_ref, btrim(p_name), v_items, v_cups, v_total, public.micra_today())
  on conflict (tintero_id, client_ref, for_day) do update
    set name = excluded.name, items = excluded.items, cups = excluded.cups, total = excluded.total,
        status = 'waiting', updated_at = now()
    where public.micra_holds.status in ('waiting', 'cancelled')
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Ese apartado ya se entregó hoy.' using errcode = '22023';
  end if;
  return jsonb_build_object('id', v_row.id, 'tintero_id', v_row.tintero_id, 'items', v_row.items, 'cups', v_row.cups,
    'total', v_row.total, 'status', v_row.status, 'for_day', v_row.for_day);
end;
$$;
revoke all on function public.micra_hold(uuid, text, text, jsonb) from public;
grant execute on function public.micra_hold(uuid, text, text, jsonb) to anon, authenticated;

-- ── Equipo: el día de todos + lo que pide el resumen ───────────────────
create or replace function public.micra_owner_day()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare d date := public.micra_today();
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo ve el resumen.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'day', d,
    'baristas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'stage', t.stage, 'localidad', t.localidad, 'referencia', coalesce(t.referencia, t.zone),
        'public', t.ad_consent, 'linked', t.user_id is not null, 'invite_code', case when t.invite_expires_at > now() then t.invite_code end,
        'live_until', case when t.out_until > now() then t.out_until end,
        'has_prices', t.tinto_price is not null,
        'has_phone', t.phone is not null, 'has_gps', t.lat is not null,
        'created_at', t.created_at,
        'last_active_at', greatest(a.last_sale, a.last_hold),
        'cups', coalesce(s.cups, 0), 'total', coalesce(s.total, 0), 'fiado', coalesce(s.fiado, 0),
        'waiting', coalesce(h.waiting, 0), 'served', coalesce(h.served, 0)
      ) order by (t.out_until > now()) desc nulls last, coalesce(s.cups, 0) desc, t.name), '[]'::jsonb)
      from public.tinteros t
      left join (select tintero_id, sum(qty) cups, sum(total) total, sum(total) filter (where fiado_name is not null) fiado
                 from public.tintero_sales where voided_at is null and (sold_at at time zone 'America/Bogota')::date = d group by 1) s on s.tintero_id = t.id
      left join (select tintero_id, count(*) filter (where status = 'waiting') waiting, count(*) filter (where status = 'served') served
                 from public.micra_holds where for_day = d group by 1) h on h.tintero_id = t.id
      left join lateral (select (select max(sold_at) from public.tintero_sales x where x.tintero_id = t.id and x.voided_at is null) last_sale,
                                (select max(updated_at) from public.micra_holds y where y.tintero_id = t.id and y.status = 'served') last_hold) a on true
      where t.stage <> 'salio'),
    'week', (select coalesce(jsonb_agg(jsonb_build_object('day', g.day::date, 'cups', coalesce(w.cups, 0), 'total', coalesce(w.total, 0), 'holds', coalesce(x.n, 0)) order by g.day), '[]'::jsonb)
             from generate_series(d - 6, d, interval '1 day') g(day)
             left join (select (sold_at at time zone 'America/Bogota')::date dd, sum(qty) cups, sum(total) total
                        from public.tintero_sales where voided_at is null and sold_at > now() - interval '8 days' group by 1) w on w.dd = g.day::date
             left join (select for_day, count(*) n from public.micra_holds where for_day > d - 7 and status <> 'cancelled' group by 1) x on x.for_day = g.day::date),
    -- Clientes en cifras (nunca nombres ni llaves): últimos 30 días
    'clients', (
      with c as (
        select client_ref,
               min(for_day) first_day,
               count(*) filter (where status = 'served') served,
               count(*) filter (where status = 'missed') missed
        from public.micra_holds
        where for_day > d - 30 and status <> 'cancelled'
        group by 1
      )
      select jsonb_build_object(
        'total', count(*),
        'new_7d', count(*) filter (where first_day > d - 7),
        'active', count(*) filter (where served >= 1),
        'frequent', count(*) filter (where served >= 3),
        'paused', count(*) filter (where public.micra_client_paused_until(client_ref) is not null),
        'missed', coalesce(sum(missed), 0)
      ) from c)
  );
end;
$$;
revoke all on function public.micra_owner_day() from public, anon;
grant execute on function public.micra_owner_day() to authenticated;

-- «¿Cómo te fue?» (10 nov 2026, «Micra en tres toques», tanda 2, aprobada por el usuario).
-- Después de la entrega, el cliente califica de 1 a 5 granos y dice cuánto pagó.
-- Es el dato que le faltaba al estudio: el precio real que se paga en la calle
-- y si la gente vuelve contenta, ligado a un apartado que el barista sí entregó.
--
-- Freno: solo se califica un apartado entregado, con la llave del celular que lo
-- apartó, hasta el día siguiente. Para inflar la nota de alguien habría que
-- apartarle y que él marque «Entregado» cada vez, así que no hace falta freno
-- por red (y no depende de 20261108120000).
set lock_timeout = '5s';

alter table public.micra_holds add column if not exists rating smallint;
alter table public.micra_holds add column if not exists paid_total numeric;
alter table public.micra_holds add column if not exists rated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'micra_holds_rating_check') then
    alter table public.micra_holds add constraint micra_holds_rating_check check (rating is null or rating between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'micra_holds_paid_check') then
    -- Seis tazas a lo sumo: $60.000 es un techo holgado
    alter table public.micra_holds add constraint micra_holds_paid_check check (paid_total is null or paid_total between 0 and 60000);
  end if;
end $$;

-- Los apartados de hoy de este celular, ahora con su nota y lo pagado
create or replace function public.micra_my_holds(p_client_ref text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'tintero_id', h.tintero_id, 'name', h.name, 'items', h.items,
    'cups', h.cups, 'total', h.total, 'status', h.status, 'for_day', h.for_day,
    'rating', h.rating, 'paid_total', h.paid_total) order by h.created_at), '[]'::jsonb)
  from public.micra_holds h
  where h.client_ref = p_client_ref and char_length(p_client_ref) >= 8 and h.for_day = public.micra_today();
$$;
revoke all on function public.micra_my_holds(text) from public;
grant execute on function public.micra_my_holds(text) to anon, authenticated;

-- Califica (o cambia la nota de) un apartado entregado. p_paid es opcional.
create or replace function public.micra_hold_rate(p_client_ref text, p_hold_id uuid, p_rating int, p_paid numeric default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare n int;
begin
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'La nota va de 1 a 5 granos.' using errcode = '22023';
  end if;
  if p_paid is not null and (p_paid < 0 or p_paid > 60000) then
    raise exception 'Ese valor no parece de café.' using errcode = '22023';
  end if;
  update public.micra_holds
     set rating = p_rating, paid_total = round(p_paid), rated_at = now(), updated_at = now()
   where id = p_hold_id and client_ref = p_client_ref and char_length(p_client_ref) >= 8
     and status = 'served' and for_day >= public.micra_today() - 1;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.micra_hold_rate(text, uuid, int, numeric) from public;
grant execute on function public.micra_hold_rate(text, uuid, int, numeric) to anon, authenticated;

-- Lo que el barista ve de sus notas: promedio y cuántas, últimos 30 días. Nunca quién.
create or replace function public.micra_barista_rating(p_tintero_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('n', count(*), 'avg', round(avg(h.rating), 1))
  from public.micra_holds h
  where h.tintero_id = public.micra_actor(p_tintero_id)
    and h.rating is not null and h.for_day > public.micra_today() - 30;
$$;
revoke all on function public.micra_barista_rating(uuid) from public, anon;
grant execute on function public.micra_barista_rating(uuid) to authenticated;

-- El equipo: por barista, nota y precio pagado por taza (mediana), últimos 30 días
create or replace function public.micra_hold_ratings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', r.tintero_id, 'name', r.name, 'n', r.n, 'avg', r.avg,
      'paid_n', r.paid_n, 'paid_cup', r.paid_cup, 'listed_cup', r.listed_cup) order by r.n desc, r.name), '[]'::jsonb)
    from (
      select h.tintero_id, t.name, count(*) n, round(avg(h.rating), 1) avg,
             count(h.paid_total) paid_n,
             round(percentile_cont(0.5) within group (order by h.paid_total / h.cups) filter (where h.paid_total is not null)) paid_cup,
             round(percentile_cont(0.5) within group (order by h.total / h.cups)) listed_cup
      from public.micra_holds h join public.tinteros t on t.id = h.tintero_id
      where h.rating is not null and h.for_day > public.micra_today() - 30
      group by h.tintero_id, t.name
    ) r
  );
end;
$$;
revoke all on function public.micra_hold_ratings() from public, anon;
grant execute on function public.micra_hold_ratings() to authenticated;

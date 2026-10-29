-- Micra: tarjeta de sellos del cliente y pago con Nequi / Daviplata al barista.
--
-- Sellos: cada taza entregada de un apartado es un sello del celular que apartó
-- (client_ref, sin cuenta). Cada 10 sellos, un tinto gratis que el barista
-- canjea al entregar. Los sellos salen de micra_holds (no hay que contar dos
-- veces); los canjes quedan en micra_rewards, con su precio, para saber cuánto
-- se regaló y a quién reconocérselo.
--
-- Pago: el barista pone su Nequi y/o Daviplata; el cliente los ve en su tarjeta
-- (solo baristas públicos) para pagarle directo. El dinero no pasa por Micra.

set lock_timeout = '5s';

-- ── Pago al barista ────────────────────────────────────────────────────
alter table public.tinteros
  add column if not exists pay_nequi text,
  add column if not exists pay_daviplata text;
alter table public.tinteros drop constraint if exists tinteros_pay_check;
alter table public.tinteros add constraint tinteros_pay_check check (
  (pay_nequi is null or pay_nequi ~ '^3[0-9]{9}$') and (pay_daviplata is null or pay_daviplata ~ '^3[0-9]{9}$')
);

create or replace function public.micra_barista_pay_set(p_nequi text, p_daviplata text, p_tintero_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  n text := nullif(regexp_replace(coalesce(p_nequi, ''), '[^0-9]', '', 'g'), '');
  d text := nullif(regexp_replace(coalesce(p_daviplata, ''), '[^0-9]', '', 'g'), '');
begin
  if (n is not null and n !~ '^3[0-9]{9}$') or (d is not null and d !~ '^3[0-9]{9}$') then
    raise exception 'El número es un celular de 10 dígitos que empieza por 3.' using errcode = '22023';
  end if;
  update public.tinteros set pay_nequi = n, pay_daviplata = d where id = v;
  return jsonb_build_object('nequi', n, 'daviplata', d);
end;
$$;
revoke all on function public.micra_barista_pay_set(text, text, uuid) from public, anon;
grant execute on function public.micra_barista_pay_set(text, text, uuid) to authenticated;

-- Cómo pagarle a un barista: solo los públicos (los mismos que salen en el mapa)
create or replace function public.micra_barista_pay(p_tintero_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('nequi', t.pay_nequi, 'daviplata', t.pay_daviplata)
  from public.tinteros t
  where t.id = p_tintero_id and t.ad_consent and t.stage <> 'salio' and t.user_id is not null;
$$;
revoke all on function public.micra_barista_pay(uuid) from public;
grant execute on function public.micra_barista_pay(uuid) to anon, authenticated;

-- ── Sellos ─────────────────────────────────────────────────────────────
create table if not exists public.micra_rewards (
  id          uuid primary key default gen_random_uuid(),
  client_ref  text not null check (char_length(client_ref) between 8 and 64),
  tintero_id  uuid not null references public.tinteros(id) on delete cascade,
  -- Un canje por entrega: reintentar no regala dos
  hold_id     uuid not null unique references public.micra_holds(id) on delete cascade,
  value       numeric not null check (value >= 0),
  redeemed_at timestamptz not null default now()
);
create index if not exists micra_rewards_client_idx on public.micra_rewards (client_ref);
alter table public.micra_rewards enable row level security;
drop policy if exists "el equipo ve los canjes" on public.micra_rewards;
create policy "el equipo ve los canjes" on public.micra_rewards for select using (public.is_admin());

-- Sellos de un celular: tazas entregadas, canjes hechos y lo que tiene para canjear
create or replace function public.micra_stamps_of(p_client_ref text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select coalesce(sum(cups), 0)::int as cups from public.micra_holds where client_ref = p_client_ref and status = 'served'
  ), r as (
    select count(*)::int as used from public.micra_rewards where client_ref = p_client_ref
  )
  select jsonb_build_object('per', 10, 'cups', s.cups, 'used', r.used,
                            'available', greatest(0, s.cups / 10 - r.used), 'toward', s.cups % 10)
  from s, r;
$$;
revoke all on function public.micra_stamps_of(text) from public, anon;

-- El cliente consulta los suyos con el identificador de su celular
create or replace function public.micra_my_stamps(p_client_ref text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$ select public.micra_stamps_of(p_client_ref); $$;
revoke all on function public.micra_my_stamps(text) from public;
grant execute on function public.micra_my_stamps(text) to anon, authenticated;

-- El barista ve, para los apartados de hoy, quién tiene un tinto gratis por canjear
create or replace function public.micra_hold_rewards(p_tintero_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v uuid := public.micra_actor(p_tintero_id);
begin
  return coalesce((
    select jsonb_object_agg(h.id, (public.micra_stamps_of(h.client_ref)->>'available')::int)
    from public.micra_holds h
    where h.tintero_id = v and h.for_day = (now() at time zone 'America/Bogota')::date and h.status = 'waiting'
  ), '{}'::jsonb);
end;
$$;
revoke all on function public.micra_hold_rewards(uuid) from public, anon;
grant execute on function public.micra_hold_rewards(uuid) to authenticated;

-- Canjear al entregar: un tinto gratis (al precio del tinto de su ficha) de ese apartado
create or replace function public.micra_reward_redeem(p_hold_id uuid, p_tintero_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  h public.micra_holds;
  done public.micra_rewards;
  price numeric;
begin
  select * into h from public.micra_holds where id = p_hold_id and tintero_id = v for update;
  if h.id is null then raise exception 'No existe ese apartado.' using errcode = 'P0002'; end if;
  select * into done from public.micra_rewards where hold_id = h.id;
  if done.id is not null then return jsonb_build_object('id', done.id, 'replay', true); end if;
  if (public.micra_stamps_of(h.client_ref)->>'available')::int < 1 then
    raise exception 'Este cliente aún no tiene un tinto gratis.' using errcode = '22023';
  end if;
  select coalesce(tinto_price, 0) into price from public.tinteros where id = v;
  insert into public.micra_rewards (client_ref, tintero_id, hold_id, value) values (h.client_ref, v, h.id, price)
  returning * into done;
  return jsonb_build_object('id', done.id, 'value', done.value, 'replay', false);
end;
$$;
revoke all on function public.micra_reward_redeem(uuid, uuid) from public, anon;
grant execute on function public.micra_reward_redeem(uuid, uuid) to authenticated;

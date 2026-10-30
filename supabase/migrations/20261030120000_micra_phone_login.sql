-- Micra: el barista entra con su celular y un código por SMS (Supabase Auth,
-- proveedor Phone) y cae directo en su perfil, sin código de invitación.
--
--   micra_co_phone(text): cualquier forma de un celular colombiano
--     («300 123 4567», «+57 300…», «573001234567») → '+573001234567'; si no
--     lo es, null. La misma regla que normalizeCoPhone (micra-app/phone.js).
--   tintero_claim_phone(): enlaza la cuenta de la sesión con la ficha que
--     tiene su número. El número sale de auth.users (verificado por el SMS),
--     nunca de un parámetro del celular. Si el número está en dos fichas no
--     enlaza ninguna: lo resuelve el equipo.
--   micra_barista_phones() / micra_barista_phone_set(): el equipo ve y pone
--     el celular de cada barista (Equipo › Baristas).
--
-- tinteros.phone se guarda solo con números y el 57 delante (como wa.me y
-- auth.users.phone); la ficha del estudio ya lo manda así (fichaFlow.js).
set lock_timeout = '5s';

create or replace function public.micra_co_phone(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when d ~ '^3[0-9]{9}$' then '+57' || d
    when d ~ '^573[0-9]{9}$' then '+' || d
    when d ~ '^00573[0-9]{9}$' then '+' || substr(d, 3)
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x;
$$;
-- Pura y sin datos: la puede llamar cualquiera (la usa el índice de abajo al insertar)

-- Los celulares que ya estén guardados de otra forma («3001234567») quedan como los demás
update public.tinteros
set phone = substr(public.micra_co_phone(phone), 2)
where public.micra_co_phone(phone) is not null
  and phone is distinct from substr(public.micra_co_phone(phone), 2);

-- Buscar por número sin recorrer toda la tabla
create index if not exists tinteros_co_phone_idx on public.tinteros (public.micra_co_phone(phone));

-- ── Barista: entrar con el celular ─────────────────────────────────────
create or replace function public.tintero_claim_phone()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Entra con tu número de celular primero.' using errcode = '42501';
  end if;
  -- Ya enlazado (por SMS o con el código): no hay nada que buscar
  if public.my_tintero_id() is not null then
    return public.tintero_me();
  end if;
  select public.micra_co_phone(u.phone) into v_phone
  from auth.users u
  where u.id = auth.uid() and u.phone_confirmed_at is not null;
  if v_phone is null then
    raise exception 'Entra con tu número de celular para buscar tu perfil de barista.' using errcode = '42501';
  end if;

  select array_agg(id order by id) into v_ids from (
    select id from public.tinteros
    where public.micra_co_phone(phone) = v_phone and stage <> 'salio' and user_id is null
    for update
  ) s;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    if exists (select 1 from public.tinteros where public.micra_co_phone(phone) = v_phone and stage <> 'salio') then
      raise exception 'Ese número ya está enlazado a otra cuenta. Escríbele al equipo de Micra por WhatsApp.' using errcode = '23505';
    end if;
    raise exception 'Tu número no está registrado en Micra. Escríbele al equipo por WhatsApp para que lo agreguen, o entra con el código de seis letras que te dieron.' using errcode = 'P0002';
  end if;
  if array_length(v_ids, 1) > 1 then
    raise exception 'Tu número aparece en más de un perfil. Escríbele al equipo de Micra por WhatsApp para enlazarte.' using errcode = '21000';
  end if;

  update public.tinteros set user_id = auth.uid(), invite_code = null, invite_expires_at = null where id = v_ids[1];
  return public.tintero_me();
end;
$$;
revoke all on function public.tintero_claim_phone() from public, anon;
grant execute on function public.tintero_claim_phone() to authenticated;

-- ── Equipo: el celular de cada barista ─────────────────────────────────
create or replace function public.micra_barista_phones()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo ve los celulares.' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_object_agg(id, phone), '{}'::jsonb)
          from public.tinteros where stage <> 'salio' and phone is not null);
end;
$$;
revoke all on function public.micra_barista_phones() from public, anon;
grant execute on function public.micra_barista_phones() to authenticated;

-- Vacío lo borra. Solo celulares colombianos: es el número con el que entra por SMS.
create or replace function public.micra_barista_phone_set(p_tintero_id uuid, p_phone text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_e164 text := public.micra_co_phone(p_phone);
  v_phone text;
  v_other text;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo cambia el celular de un barista.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_phone, '')), '') is not null and v_e164 is null then
    raise exception 'El celular es de 10 dígitos y empieza por 3.' using errcode = '22023';
  end if;
  v_phone := substr(v_e164, 2);
  if v_phone is not null then
    select name into v_other from public.tinteros
    where id <> p_tintero_id and stage <> 'salio' and public.micra_co_phone(phone) = v_e164
    limit 1;
    if v_other is not null then
      raise exception 'Ese número ya lo tiene %. Un número es de un solo barista.', v_other using errcode = '23505';
    end if;
  end if;
  update public.tinteros set phone = v_phone where id = p_tintero_id;
  if not found then
    raise exception 'No existe ese barista.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', p_tintero_id, 'phone', v_phone);
end;
$$;
revoke all on function public.micra_barista_phone_set(uuid, text) from public, anon;
grant execute on function public.micra_barista_phone_set(uuid, text) to authenticated;

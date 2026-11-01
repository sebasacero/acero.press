-- Avisos por WhatsApp al barista cuando le apartan (31 oct 2026).
--  · El barista los activa él mismo en Mi perfil › Permisos (Ley 1581): wa_alerts.
--  · La app anota cuándo la vio abierta (app_seen_at, cada 20 s con la app a la
--    vista): si la tiene abierta, basta el globito y no se manda WhatsApp.
--  · Al entrar un apartado, la base llama a la Edge Function micra-notify
--    (pg_net), que relee todo y decide (supabase/functions/micra-notify/rules.js).
--    Un aviso nunca frena el apartado: si la llamada falla, el apartado queda.
--  · micra_notify_log: uno por apartado (no se avisa dos veces) y para ver qué
--    pasó, sin el celular ni el texto del mensaje.
-- Idempotente.
set lock_timeout = '5s';

create extension if not exists pg_net;

alter table public.tinteros add column if not exists wa_alerts boolean not null default false;
alter table public.tinteros add column if not exists wa_alerts_at timestamptz;
alter table public.tinteros add column if not exists app_seen_at timestamptz;

create table if not exists public.micra_notify_log (
  id          uuid primary key default gen_random_uuid(),
  hold_id     uuid not null unique references public.micra_holds(id) on delete cascade,
  tintero_id  uuid not null references public.tinteros(id) on delete cascade,
  channel     text not null default 'whatsapp',
  status      text not null,
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists micra_notify_log_sent_idx on public.micra_notify_log (tintero_id, created_at desc) where status = 'sent';
alter table public.micra_notify_log enable row level security;
revoke all on table public.micra_notify_log from anon, authenticated;

-- ── El barista activa o apaga sus avisos (p_on null: solo leer) ─────────
create or replace function public.micra_barista_alerts(p_on boolean default null, p_tintero_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid := public.micra_actor(p_tintero_id);
  t public.tinteros;
begin
  -- El permiso lo da el barista desde su celular, no el equipo «actuando como»
  if p_on is not null and v is distinct from public.my_tintero_id() then
    raise exception 'El barista activa sus avisos desde su propio celular.' using errcode = '42501';
  end if;
  if p_on is not null then
    update public.tinteros set wa_alerts = p_on, wa_alerts_at = now() where id = v;
  end if;
  select * into t from public.tinteros where id = v;
  return jsonb_build_object('on', t.wa_alerts, 'since', t.wa_alerts_at, 'has_phone', t.phone ~ '^573[0-9]{9}$');
end;
$$;
revoke all on function public.micra_barista_alerts(boolean, uuid) from public, anon;
grant execute on function public.micra_barista_alerts(boolean, uuid) to authenticated;

-- ── «Tengo Micra abierta» (la app lo dice cada 20 s con la pantalla a la vista) ──
create or replace function public.micra_barista_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.tinteros set app_seen_at = now() where id = public.my_tintero_id();
$$;
revoke all on function public.micra_barista_seen() from public, anon;
grant execute on function public.micra_barista_seen() to authenticated;

-- ── Al entrar un apartado: llamar a micra-notify ────────────────────────
-- La URL es la del proyecto (pública, la misma del navegador). Si pg_net o la
-- función fallan, el apartado igual queda guardado.
create or replace function public.micra_hold_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://tylylfrabjkaiukuilem.supabase.co/functions/v1/micra-notify',
    body := jsonb_build_object('hold_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new;
end;
$$;
revoke all on function public.micra_hold_notify() from public, anon, authenticated;

drop trigger if exists micra_holds_notify on public.micra_holds;
create trigger micra_holds_notify
  after insert on public.micra_holds
  for each row
  when (new.status = 'waiting')
  execute function public.micra_hold_notify();

// Aviso por WhatsApp al barista cuando le apartan (POST { hold_id }).
//
// Lo llama la base al entrar un apartado (trigger micra_holds_notify,
// 20261031210000_micra_whatsapp_alerts.sql). No confía en lo que llega: relee
// el apartado y al barista con la llave de servicio, y solo escribe si el
// apartado es nuevo (menos de 10 min) y aún no se avisó (micra_notify_log,
// uno por apartado). Las reglas (si pidió avisos, si tiene Micra abierta, uno
// cada 10 min) están en rules.js.
//
// Secrets (Supabase › Edge Functions › Secrets; SETUP.md §10.6):
//   WHATSAPP_TOKEN       token permanente del usuario del sistema de Meta
//   WHATSAPP_PHONE_ID    id del número de WhatsApp Business (no el número)
//   WHATSAPP_TEMPLATE    plantilla aprobada (por defecto micra_nuevo_apartado)
//   WHATSAPP_LANG        idioma de la plantilla (por defecto es)
// Sin WHATSAPP_TOKEN o WHATSAPP_PHONE_ID no manda nada y lo deja anotado.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { decide, templatePayload, waPhone, DEFAULT_LANG, DEFAULT_TEMPLATE } from "./rules.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const ok = (body: unknown = { ok: true }, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok({ ok: false }, 405);
  let holdId = "";
  try { holdId = String((await req.json())?.hold_id ?? ""); } catch { /* sin cuerpo */ }
  if (!/^[0-9a-f-]{36}$/i.test(holdId)) return ok({ ok: false }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: hold } = await db.from("micra_holds")
    .select("id, tintero_id, name, items, status, created_at").eq("id", holdId).maybeSingle();
  if (!hold) return ok({ ok: false }, 404);

  // Uno por apartado: si ya hay fila, otro llamado ya lo atendió
  const { error: dup } = await db.from("micra_notify_log")
    .insert({ hold_id: hold.id, tintero_id: hold.tintero_id, status: "sending" });
  if (dup) return ok();
  const mark = (status: string, detail: string | null = null) =>
    db.from("micra_notify_log").update({ status, detail }).eq("hold_id", hold.id);

  try {
    const { data: barista } = await db.from("tinteros")
      .select("id, phone, wa_alerts, app_seen_at").eq("id", hold.tintero_id).maybeSingle();
    const { data: last } = await db.from("micra_notify_log")
      .select("created_at").eq("tintero_id", hold.tintero_id).eq("status", "sent")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const token = Deno.env.get("WHATSAPP_TOKEN");
    const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
    const d = decide({ hold, barista, lastSentAt: last?.created_at ?? null, now: Date.now(), configured: !!(token && phoneId) });
    if (!d.send) { await mark(`skipped_${d.reason}`); return ok(); }

    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(templatePayload({
        to: waPhone(barista!.phone)!,
        hold,
        template: Deno.env.get("WHATSAPP_TEMPLATE") || DEFAULT_TEMPLATE,
        lang: Deno.env.get("WHATSAPP_LANG") || DEFAULT_LANG,
      })),
    });
    const out = await res.json().catch(() => ({}));
    // Solo el id del mensaje o el error de Meta: nunca el celular ni el texto
    await mark(res.ok ? "sent" : "failed", res.ok ? out?.messages?.[0]?.id ?? null : JSON.stringify(out?.error ?? out).slice(0, 300));
    return ok();
  } catch (e) {
    await mark("failed", e instanceof Error ? e.message.slice(0, 300) : "error");
    return ok({ ok: false }, 500);
  }
});

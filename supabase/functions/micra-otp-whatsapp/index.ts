// El código para entrar a Micra por WhatsApp en vez de SMS.
//
// Es el «Send SMS Hook» de Supabase Auth (Authentication › Hooks): cuando la
// app pide el código (signInWithOtp con el celular), Supabase no usa Twilio,
// llama a esta función con el número y el código, y ella lo manda con la
// plantilla de autenticación de la Cloud API de Meta (el mismo número de
// WhatsApp de los avisos, SETUP.md §10.7). La app no cambia: verifyOtp igual.
//
// Solo acepta llamadas firmadas por Supabase (standardwebhooks) y solo
// celulares de Colombia. No guarda ni escribe en logs el número ni el código.
//
// Secrets (Supabase › Edge Functions › Secrets; SETUP.md §1.6):
//   SEND_SMS_HOOK_SECRET  el secreto que da el dashboard al crear el hook
//   WHATSAPP_TOKEN        token permanente (el mismo de micra-notify)
//   WHATSAPP_PHONE_ID     id del número de WhatsApp Business
//   WHATSAPP_OTP_TEMPLATE opcional; por defecto micra_codigo
//   WHATSAPP_LANG         opcional; por defecto es
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { otpPhone, otpCode, otpPayload, hookError, hookSecret, DEFAULT_LANG, DEFAULT_TEMPLATE } from "./otp.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(hookError("Método no permitido", 405), 405);
  const raw = await req.text();

  let event: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    event = new Webhook(hookSecret(Deno.env.get("SEND_SMS_HOOK_SECRET"))).verify(
      raw, Object.fromEntries(req.headers),
    ) as typeof event;
  } catch {
    return json(hookError("Firma inválida", 401), 401);
  }

  const to = otpPhone(event.user?.phone);
  const code = otpCode(event.sms?.otp);
  if (!to) return json(hookError("Por ahora Micra solo manda el código a celulares de Colombia."));
  if (!code) return json(hookError("Código inválido"));

  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  if (!token || !phoneId) return json(hookError("La entrada por WhatsApp todavía no está activa.", 500), 500);

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(otpPayload({
      to, code,
      template: Deno.env.get("WHATSAPP_OTP_TEMPLATE") || DEFAULT_TEMPLATE,
      lang: Deno.env.get("WHATSAPP_LANG") || DEFAULT_LANG,
    })),
  });
  if (res.ok) return json({});
  // Solo el error de Meta, sin el número ni el código
  const out = await res.json().catch(() => ({}));
  console.error("micra-otp-whatsapp", JSON.stringify(out?.error ?? out).slice(0, 300));
  return json(hookError("No se pudo mandar el código por WhatsApp. Vuelve a intentar.", 502), 502);
});

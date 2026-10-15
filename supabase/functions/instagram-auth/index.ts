// Asistente de conexión de Instagram (lo usa la pantalla "Instagram" del panel).
//
// POST { action: "status" }            → estado de la conexión (sin el token)
// POST { action: "connect", token }    → valida un token pegado desde Meta, lo
//                                        convierte en uno largo y lo guarda
// POST { action: "refresh" }           → renueva ya el token (Instagram Login)
//
// Solo tu cuenta owner puede llamarla (se verifica el JWT de la sesión).
import {
  adminClient, connectToken, corsHeaders, getConnection, graph, HttpError, json,
  refreshInstagramToken, requireOwner,
} from "../_shared/instagram.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  try {
    await requireOwner(req, admin);
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "status";

    if (action === "connect") {
      if (typeof body.token !== "string" || body.token.trim().length < 20) {
        throw new HttpError(400, "Pega el token completo de Meta for Developers.");
      }
      const row = await connectToken(body.token);
      const now = new Date().toISOString();
      const { error } = await admin.from("integration_tokens").upsert({
        provider: "instagram",
        ...row,
        refreshed_at: now,
        last_error: null,
        updated_at: now,
      });
      if (error) throw new HttpError(500, error.message);
      return json({ ok: true, status: publicStatus({ ...row, refreshed_at: now, last_error: null }) });
    }

    if (action === "refresh") {
      const { data: row } = await admin.from("integration_tokens").select("*").eq("provider", "instagram").maybeSingle();
      if (!row) throw new HttpError(409, "Primero conecta Instagram.");
      if (row.token_kind !== "instagram_login") {
        return json({ ok: true, status: publicStatus(row), note: "El token de Página de Facebook no vence: no hace falta renovarlo." });
      }
      const fresh = await refreshInstagramToken(row.access_token);
      const now = new Date().toISOString();
      await admin.from("integration_tokens").update({
        access_token: fresh.access_token,
        expires_at: fresh.expires_at,
        refreshed_at: now,
        last_error: null,
        updated_at: now,
      }).eq("provider", "instagram");
      return json({ ok: true, status: publicStatus({ ...row, expires_at: fresh.expires_at, refreshed_at: now, last_error: null }) });
    }

    // status: prueba el token contra Meta para saber si de verdad funciona.
    const { data: row } = await admin.from("integration_tokens").select("*").eq("provider", "instagram").maybeSingle();
    let live: { ok: boolean; error?: string; username?: string; followers_count?: number } = { ok: false };
    let legacy = false;
    try {
      const conn = await getConnection(admin);
      legacy = !row;
      const target = conn.kind === "facebook_login" ? conn.accountId : "me";
      const me = await graph(`${conn.base}/${target}?fields=username,followers_count&access_token=${encodeURIComponent(conn.token)}`);
      live = { ok: true, username: me.username, followers_count: me.followers_count };
    } catch (err) {
      live = { ok: false, error: (err as Error).message };
    }
    return json({
      ok: true,
      status: row ? publicStatus(row) : null,
      legacy_secrets: legacy,
      live,
      app_configured: {
        meta_app_id: !!Deno.env.get("META_APP_ID"),
        meta_app_secret: !!Deno.env.get("META_APP_SECRET"),
        ig_app_secret: !!Deno.env.get("IG_APP_SECRET"),
      },
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return json({ ok: false, error: (err as Error).message }, status);
  }
});

function publicStatus(row: Record<string, any>) {
  return {
    username: row.username ?? null,
    account_id: row.account_id ?? null,
    token_kind: row.token_kind,
    expires_at: row.expires_at ?? null,
    refreshed_at: row.refreshed_at ?? null,
    last_error: row.last_error ?? null,
  };
}

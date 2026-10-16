// Feed público de Instagram para el sitio (GET ?limit=9, máx. 25).
//
// Usa la misma conexión que el panel (integration_tokens), que se renueva
// sola cada semana; si aún no existe, la crea desde los Secrets
// INSTAGRAM_TOKEN / INSTAGRAM_USER_ID. Así el feed no se cae a los 60 días.
import { adminClient, corsHeaders, getConnection, graph } from "../_shared/instagram.ts";

const FIELDS = "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "9") || 9, 1), 25);

    const conn = await getConnection(adminClient());
    const res = await graph(
      `${conn.base}/${conn.accountId}/media?fields=${FIELDS}&limit=${limit}&access_token=${encodeURIComponent(conn.token)}`,
    );

    return new Response(JSON.stringify({ success: true, data: res.data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

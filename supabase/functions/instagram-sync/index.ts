// Trae las métricas reales de Instagram a Supabase (ig_media, ig_account_daily)
// para el dashboard y el agente de crecimiento.
//
// POST {}  → sincroniza los últimos 30 posts y los seguidores de hoy.
// Solo tu cuenta owner puede llamarla.
import { adminClient, corsHeaders, getConnection, graph, HttpError, json, requireOwner } from "../_shared/instagram.ts";

const MEDIA_FIELDS = "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  try {
    await requireOwner(req, admin);
    const conn = await getConnection(admin);
    const t = encodeURIComponent(conn.token);
    const target = conn.kind === "facebook_login" ? conn.accountId : "me";

    // Cuenta: seguidores y número de posts (una fila por día).
    const account = await graph(`${conn.base}/${target}?fields=username,followers_count,media_count&access_token=${t}`);
    await admin.from("ig_account_daily").upsert({
      day: new Date().toISOString().slice(0, 10),
      followers_count: account.followers_count ?? null,
      media_count: account.media_count ?? null,
      fetched_at: new Date().toISOString(),
    });

    // Posts recientes con sus métricas.
    const media = await graph(`${conn.base}/${conn.accountId}/media?fields=${MEDIA_FIELDS}&limit=30&access_token=${t}`);
    const rows = [];
    for (const m of media.data ?? []) {
      const insights = await mediaInsights(conn.base, m.id, t);
      rows.push({
        id: m.id,
        media_type: m.media_type,
        media_product: m.media_product_type ?? null,
        caption: m.caption ?? null,
        permalink: m.permalink ?? null,
        thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
        posted_at: m.timestamp ?? null,
        like_count: m.like_count ?? null,
        comments_count: m.comments_count ?? null,
        reach: insights.reach ?? null,
        views: insights.views ?? null,
        saved: insights.saved ?? null,
        shares: insights.shares ?? null,
        fetched_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await admin.from("ig_media").upsert(rows);
      if (error) throw new HttpError(500, error.message);
      // Enlaza cada post con la publicación (y la venta) que lo originó.
      const { data: pubs } = await admin.from("publications").select("id, ig_media_id").not("ig_media_id", "is", null);
      for (const p of pubs ?? []) {
        await admin.from("ig_media").update({ publication_id: p.id }).eq("id", p.ig_media_id);
      }
    }

    return json({ ok: true, username: account.username, followers: account.followers_count, synced: rows.length });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return json({ ok: false, error: (err as Error).message }, status);
  }
});

/** Métricas de un post. Meta cambia los nombres seguido: si falla el set completo, intenta uno mínimo. */
async function mediaInsights(base: string, id: string, token: string) {
  for (const metrics of ["reach,saved,shares,views", "reach,saved"]) {
    try {
      const r = await graph(`${base}/${id}/insights?metric=${metrics}&access_token=${token}`);
      const out: Record<string, number> = {};
      for (const item of r.data ?? []) {
        out[item.name] = item.values?.[0]?.value ?? item.total_value?.value ?? null;
      }
      return out;
    } catch {
      // siguiente intento
    }
  }
  return {};
}

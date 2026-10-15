// Publica contenido en Instagram, TikTok y YouTube.
//
// POST {
//   media_url | video_url: string,          // URL pública (Supabase Storage)
//   media_kind?: "reel" | "image" | "story", // default "reel" (compatibilidad)
//   caption?: string,
//   platforms: { ig?: boolean, tk?: boolean, yt?: boolean },
//   schedule_at?: string | null,            // solo Reels/TikTok/YouTube
//   publication_id?: number,                // si ya existe la fila en publications
// }
//
// Solo tu cuenta owner puede publicar (antes bastaba la anon key pública).
// Instagram usa la conexión del asistente (integration_tokens) y cae a los
// Secrets IG_ACCESS_TOKEN / IG_USER_ID mientras no se conecte.
import {
  adminClient, corsHeaders, getConnection, HttpError, json, publishMedia, requireOwner,
} from "../_shared/instagram.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  try {
    await requireOwner(req, supabase);

    const tkToken = Deno.env.get("TIKTOK_ACCESS_TOKEN");
    const ytToken = Deno.env.get("YOUTUBE_ACCESS_TOKEN");

    const body = await req.json();
    const mediaUrl = (body.media_url ?? body.video_url) as string;
    const mediaKind = (body.media_kind ?? "reel") as "reel" | "image" | "story";
    const caption = (body.caption as string) || "";
    const platforms = (body.platforms ?? {}) as Record<string, boolean>;
    const scheduleAt = (body.schedule_at as string | null) ?? null;
    const publicationId = body.publication_id as number | undefined;

    if (!mediaUrl) throw new HttpError(400, "No se recibió media_url");
    if (!["reel", "image", "story"].includes(mediaKind)) throw new HttpError(400, "media_kind inválido");

    const results: Record<string, any> = {};

    // ── INSTAGRAM ───────────────────────────────────────────
    if (platforms.ig) {
      try {
        const conn = await getConnection(supabase);
        if (scheduleAt && mediaKind === "reel") {
          // Programado: Instagram lo publica solo en la fecha indicada.
          const res = await fetch(`${conn.base}/${conn.accountId}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              media_type: "REELS",
              video_url: mediaUrl,
              caption,
              access_token: conn.token,
              published: false,
              scheduled_publish_time: Math.floor(new Date(scheduleAt).getTime() / 1000),
            }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          results.instagram = { success: true, scheduled: true, container_id: data.id };
        } else {
          const r = await publishMedia(conn, { kind: mediaKind, url: mediaUrl, caption });
          results.instagram = r.pending
            ? { success: false, pending: true, container_id: r.container_id, error: "Instagram aún está procesando el video. Intenta publicarlo de nuevo en un minuto." }
            : { success: true, post_id: r.media_id };
        }
      } catch (err) {
        results.instagram = { success: false, error: (err as Error).message };
      }
    }

    // ── TIKTOK (sin cambios) ────────────────────────────────
    if (platforms.tk) {
      if (!tkToken) {
        results.tiktok = { success: false, error: "TIKTOK_ACCESS_TOKEN no configurado en Secrets" };
      } else {
        try {
          const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
            method: "POST",
            headers: { Authorization: `Bearer ${tkToken}`, "Content-Type": "application/json; charset=UTF-8" },
            body: JSON.stringify({
              post_info: {
                title: caption.slice(0, 150) || "Acero.press",
                privacy_level: "PUBLIC_TO_EVERYONE",
                disable_duet: false,
                disable_comment: false,
                disable_stitch: false,
                video_cover_timestamp_ms: 1000,
              },
              source_info: { source: "PULL_FROM_URL", video_url: mediaUrl },
            }),
          });
          const tkData = await initRes.json();
          if (tkData.error?.code && tkData.error.code !== "ok") throw new Error(tkData.error.message || "TikTok API error");
          results.tiktok = { success: true, publish_id: tkData.data?.publish_id };
        } catch (err) {
          results.tiktok = { success: false, error: (err as Error).message };
        }
      }
    }

    // ── YOUTUBE (sin cambios) ───────────────────────────────
    if (platforms.yt) {
      if (!ytToken) {
        results.youtube = { success: false, error: "YOUTUBE_ACCESS_TOKEN no configurado en Secrets" };
      } else {
        try {
          const initRes = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ytToken}`,
              "Content-Type": "application/json",
              "X-Upload-Content-Type": "video/mp4",
            },
            body: JSON.stringify({
              snippet: {
                title: caption.slice(0, 100) || "Acero.press — AeroPress",
                description: caption,
                tags: ["aeropress", "cafe", "aceropress50k", "cafedeespecialidad"],
                categoryId: "26",
              },
              status: {
                privacyStatus: scheduleAt ? "private" : "public",
                publishAt: scheduleAt || undefined,
                selfDeclaredMadeForKids: false,
              },
            }),
          });
          const uploadUrl = initRes.headers.get("Location");
          if (!uploadUrl) throw new Error("YouTube no devolvió upload URL");
          const videoRes = await fetch(mediaUrl);
          if (!videoRes.ok) throw new Error("No se pudo descargar el video desde Storage");
          const videoBytes = await videoRes.arrayBuffer();
          const ytUploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "video/mp4", "Content-Length": String(videoBytes.byteLength) },
            body: videoBytes,
          });
          const ytData = await ytUploadRes.json();
          if (ytData.error) throw new Error(ytData.error.message);
          results.youtube = { success: true, video_id: ytData.id };
        } catch (err) {
          results.youtube = { success: false, error: (err as Error).message };
        }
      }
    }

    // ── Historial en publications ───────────────────────────
    const igMediaId = results.instagram?.success ? results.instagram.post_id ?? null : null;
    const anySuccess = Object.values(results).some((r: any) => r?.success);
    const patch = {
      platforms,
      results,
      scheduled_at: scheduleAt,
      media_kind: mediaKind,
      ...(igMediaId ? { ig_media_id: igMediaId } : {}),
      ...(anySuccess && !scheduleAt ? { published: true } : {}),
    };
    const { error: dbError } = publicationId
      ? await supabase.from("publications").update(patch).eq("id", publicationId)
      : await supabase.from("publications").insert({
          video_url: mediaUrl,
          caption,
          created_at: new Date().toISOString(),
          ...patch,
        });
    if (dbError) console.error("[publish-content] DB error:", dbError.message);

    return json({ success: true, results });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    console.error("[publish-content] Fatal:", (err as Error).message);
    return json({ error: (err as Error).message }, status);
  }
});

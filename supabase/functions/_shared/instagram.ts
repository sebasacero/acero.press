// Utilidades compartidas por las Edge Functions de Instagram.
//
// Soporta los dos tipos de token de Meta y los detecta por su prefijo:
//  - IGAA…  "Instagram API with Instagram Login" → graph.instagram.com.
//           Se renueva con ig_refresh_token (sin App Secret) cada vez que se
//           usa y lleva más de 7 días, así que no vence mientras se use.
//  - EAA…   "Instagram API with Facebook Login" → graph.facebook.com. Se
//           cambia por un token de larga duración (META_APP_ID/SECRET) y de
//           ahí sale el token de la Página, que no vence.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export const GRAPH_VERSION = "v21.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type TokenKind = "instagram_login" | "facebook_login";

export interface IgConnection {
  token: string;
  accountId: string;
  kind: TokenKind;
  base: string;
  username?: string | null;
}

export const kindOf = (token: string): TokenKind =>
  token.startsWith("EAA") ? "facebook_login" : "instagram_login";

export const baseOf = (kind: TokenKind) =>
  kind === "facebook_login"
    ? `https://graph.facebook.com/${GRAPH_VERSION}`
    : `https://graph.instagram.com/${GRAPH_VERSION}`;

/** Primer Secret definido de la lista (se aceptan los nombres que ya existen en el proyecto). */
export const envAny = (...names: string[]) => names.map((n) => Deno.env.get(n)).find((v) => !!v) ?? null;

// Nombres de Secrets que ya usa el proyecto (instagram-proxy) primero, luego alias.
export const SECRET_NAMES = {
  token: ["INSTAGRAM_TOKEN", "IG_ACCESS_TOKEN", "INSTAGRAM_ACCESS_TOKEN"],
  userId: ["INSTAGRAM_USER_ID", "IG_USER_ID", "INSTAGRAM_ID"],
  appId: ["META_APP_ID", "INSTAGRAM_APP_ID", "FACEBOOK_APP_ID"],
  appSecret: ["META_APP_SECRET", "INSTAGRAM_APP_SECRET", "FACEBOOK_APP_SECRET"],
  igAppSecret: ["IG_APP_SECRET", "INSTAGRAM_APP_SECRET"],
};

/** Qué Secrets están definidos (solo nombres, nunca valores). */
export function secretsPresent() {
  const out: Record<string, string | null> = {};
  for (const [key, names] of Object.entries(SECRET_NAMES)) {
    out[key] = names.find((n) => !!Deno.env.get(n)) ?? null;
  }
  return out;
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Solo tu cuenta (admin_users.role = 'owner') puede usar estas funciones. */
export async function requireOwner(req: Request, admin: SupabaseClient) {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) throw new HttpError(401, "Falta la sesión.");
  const { data: userData, error } = await admin.auth.getUser(jwt);
  if (error || !userData?.user) throw new HttpError(401, "Sesión inválida.");
  const { data: adminRow } = await admin
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (adminRow?.role !== "owner") throw new HttpError(403, "Solo el dueño puede hacer esto.");
  return userData.user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** GET/POST a la Graph API; lanza con el mensaje de Meta si responde error. */
export async function graph(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const msg = data?.error?.message ?? `Meta respondió ${res.status}`;
    throw new HttpError(502, msg);
  }
  return data;
}

const DAY = 86_400_000;

/**
 * Valida un token pegado desde Meta for Developers, lo convierte en uno de
 * larga duración y encuentra la cuenta de Instagram. Devuelve lo que se
 * guarda en integration_tokens.
 */
export async function connectToken(rawToken: string) {
  const token = rawToken.trim();
  const kind = kindOf(token);

  if (kind === "instagram_login") {
    let longToken = token;
    let expiresIn: number | null = null;
    // Los tokens generados en el panel de Meta ya duran 60 días; si fuera uno
    // corto (de un login OAuth), se cambia por uno largo con el App Secret.
    // Ojo: en "Instagram API with Instagram Login" el secreto es el
    // "Instagram app secret" (Instagram → Configuración de la API), no el de la app de Meta.
    const secret = envAny(...SECRET_NAMES.igAppSecret, ...SECRET_NAMES.appSecret);
    if (secret) {
      try {
        const ex = await graph(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(token)}`,
        );
        longToken = ex.access_token ?? token;
        expiresIn = ex.expires_in ?? null;
      } catch {
        // Ya era de larga duración: Meta rechaza el intercambio. Se intenta renovar abajo.
      }
    }
    if (!expiresIn) {
      try {
        const r = await graph(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(longToken)}`,
        );
        longToken = r.access_token ?? longToken;
        expiresIn = r.expires_in ?? null;
      } catch {
        // Un token recién creado (< 24 h) no se puede renovar todavía; se acepta tal cual.
      }
    }
    const me = await graph(`${baseOf(kind)}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(longToken)}`);
    return {
      access_token: longToken,
      account_id: String(me.user_id ?? me.id),
      username: me.username ?? null,
      token_kind: kind,
      expires_at: new Date(Date.now() + (expiresIn ?? 60 * 86_400) * 1000).toISOString(),
    };
  }

  // Facebook Login: token de usuario → token largo → token de la Página con la cuenta de IG.
  const appId = envAny(...SECRET_NAMES.appId);
  const appSecret = envAny(...SECRET_NAMES.appSecret);
  if (!appId || !appSecret) {
    throw new HttpError(400, "Este token es de Facebook Login: faltan META_APP_ID y META_APP_SECRET en los Secrets de Supabase.");
  }
  const long = await graph(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(token)}`,
  );
  const pages = await graph(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(long.access_token)}`,
  );
  const page = (pages.data ?? []).find((p: any) => p.instagram_business_account?.id);
  if (!page) {
    throw new HttpError(400, "Ninguna Página de Facebook de este usuario tiene una cuenta de Instagram profesional vinculada.");
  }
  return {
    access_token: page.access_token, // token de Página derivado de uno largo: no vence
    account_id: page.instagram_business_account.id,
    username: page.instagram_business_account.username ?? null,
    token_kind: kind,
    expires_at: null,
  };
}

/** Renueva un token de Instagram Login (60 días más). */
export async function refreshInstagramToken(token: string) {
  const r = await graph(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
  );
  return {
    access_token: r.access_token as string,
    expires_at: new Date(Date.now() + (r.expires_in ?? 60 * 86_400) * 1000).toISOString(),
  };
}

/**
 * Devuelve la conexión activa. Si el token es de Instagram Login y lleva más
 * de 7 días sin renovarse, lo renueva antes de usarlo.
 *
 * Si la tabla está vacía, toma el token de los Secrets que ya existen
 * (INSTAGRAM_TOKEN / INSTAGRAM_USER_ID) y lo copia a integration_tokens: así
 * las renovaciones quedan guardadas y el token no vence a los 60 días (un
 * Secret no se puede reescribir desde una función).
 */
export async function getConnection(admin: SupabaseClient): Promise<IgConnection> {
  let { data: row } = await admin.from("integration_tokens").select("*").eq("provider", "instagram").maybeSingle();

  if (!row) {
    const token = envAny(...SECRET_NAMES.token);
    const accountId = envAny(...SECRET_NAMES.userId);
    if (!token || !accountId) throw new HttpError(409, "Instagram no está conectado: faltan INSTAGRAM_TOKEN e INSTAGRAM_USER_ID en los Secrets.");
    const kind = kindOf(token);
    const seed = {
      provider: "instagram",
      access_token: token,
      account_id: accountId,
      token_kind: kind,
      // Fecha vieja a propósito: se renueva en este mismo uso.
      refreshed_at: new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin.from("integration_tokens").insert(seed);
    if (error) return { token, accountId, kind, base: baseOf(kind) };
    row = seed as typeof row;
  }

  const kind = row.token_kind as TokenKind;
  let token = row.access_token as string;
  const stale = Date.now() - new Date(row.refreshed_at).getTime() > 7 * DAY;
  if (kind === "instagram_login" && stale) {
    try {
      const fresh = await refreshInstagramToken(token);
      token = fresh.access_token;
      await admin.from("integration_tokens").update({
        access_token: token,
        expires_at: fresh.expires_at,
        refreshed_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("provider", "instagram");
    } catch (err) {
      await admin.from("integration_tokens").update({
        last_error: `No se pudo renovar: ${(err as Error).message}`,
        updated_at: new Date().toISOString(),
      }).eq("provider", "instagram");
      // Se sigue con el token actual: puede seguir siendo válido.
    }
  }
  return { token, accountId: row.account_id, kind, base: baseOf(kind), username: row.username };
}

/**
 * Publica una imagen (feed o historia) o un video (reel) y espera a que
 * Instagram termine de procesarlo. Devuelve el id del post.
 */
export async function publishMedia(
  conn: IgConnection,
  opts: { kind: "image" | "story" | "reel" | "story_video"; url: string; caption?: string },
) {
  const params: Record<string, string> = { access_token: conn.token };
  if (opts.kind === "reel") {
    params.media_type = "REELS";
    params.video_url = opts.url;
  } else if (opts.kind === "story_video") {
    params.media_type = "STORIES";
    params.video_url = opts.url;
  } else {
    params.image_url = opts.url;
    if (opts.kind === "story") params.media_type = "STORIES";
  }
  // Las historias no llevan texto: Instagram ignora/rechaza el caption.
  if (opts.caption && opts.kind !== "story" && opts.kind !== "story_video") params.caption = opts.caption;

  const container = await graph(`${conn.base}/${conn.accountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  // Imágenes: casi inmediato. Videos: hasta ~45 s (límite de la Edge Function).
  const isVideo = opts.kind === "reel" || opts.kind === "story_video";
  const attempts = isVideo ? 9 : 6;
  const wait = isVideo ? 5000 : 1500;
  let status = "IN_PROGRESS";
  for (let i = 0; i < attempts && status !== "FINISHED"; i++) {
    const s = await graph(`${conn.base}/${container.id}?fields=status_code&access_token=${encodeURIComponent(conn.token)}`);
    status = s.status_code ?? "FINISHED";
    if (status === "ERROR") throw new HttpError(502, "Instagram rechazó el archivo (revisa formato y tamaño).");
    if (status !== "FINISHED") await new Promise((r) => setTimeout(r, wait));
  }
  if (status !== "FINISHED") {
    return { pending: true, container_id: container.id as string };
  }

  const published = await graph(`${conn.base}/${conn.accountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: conn.token }),
  });
  return { pending: false, media_id: published.id as string };
}

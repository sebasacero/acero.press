// Las publicaciones de los baristas en Hoy (20261031160000_micra_barista_posts.sql):
// qué archivo se acepta, dónde se guarda, el texto y cómo sale en el muro. Lógica
// pura con tests; la subida y las funciones de la base están en api.js.

export const MAX_VIDEO_MB = 25;
export const MAX_PHOTO_MB = 20; // antes de achicarla en el celular
export const MAX_CAPTION = 280;

const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
};

/** Foto o video según el tipo del archivo; lo demás no se acepta. */
export function postKind(file) {
  const t = String(file?.type ?? '');
  if (!EXT[t]) return null;
  return t.startsWith('image/') ? 'foto' : 'video';
}

/** Lo que impide enviarlo, o null si se puede. */
export function mediaError(file) {
  const kind = postKind(file);
  if (!kind) return 'Escoge una foto (JPG, PNG o WebP) o un video (MP4, MOV o WebM).';
  const mb = (file.size ?? 0) / 1048576;
  if (kind === 'video' && mb > MAX_VIDEO_MB) return `El video pesa ${Math.ceil(mb)} MB: el máximo es ${MAX_VIDEO_MB} MB. Grábalo más corto.`;
  if (kind === 'foto' && mb > MAX_PHOTO_MB) return `La foto pesa ${Math.ceil(mb)} MB: el máximo es ${MAX_PHOTO_MB} MB.`;
  return null;
}

/** Dónde se guarda: la carpeta del barista y un nombre que no se repite. */
export function postPath(tinteroId, type, now = Date.now(), rand = Math.random) {
  const ext = EXT[type];
  if (!tinteroId || !ext) return null;
  const r = Math.floor(rand() * 36 ** 8).toString(36).padStart(8, '0');
  return `${tinteroId}/p-${now.toString(36)}-${r}.${ext}`;
}

/** El texto: sin espacios de más y hasta 280 letras. */
export const cleanCaption = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CAPTION);

export const STATUS_LABEL = { pending: 'En revisión', approved: 'Publicada', rejected: 'No salió', removed: 'Quitada' };

const bogotaDay = (iso) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};

/**
 * Las filas de micra_posts_feed como publicaciones del muro, con la URL firmada
 * de cada archivo (`urls`: ruta → URL). Sin URL o con datos raros, no sale.
 */
export function postsToFeed(rows, urls = {}) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.id && r.tintero_id && (r.kind === 'foto' || r.kind === 'video') && urls[r.media_path])
    .map((r) => ({
      id: `post-${r.id}`, kind: 'publicaciones', postId: r.id, baristaId: r.tintero_id,
      by: String(r.name ?? '').trim() || 'Barista', where: r.referencia || null,
      media: { kind: r.kind, url: urls[r.media_path] }, text: cleanCaption(r.caption) || null,
      date: bogotaDay(r.created_at),
    }));
}

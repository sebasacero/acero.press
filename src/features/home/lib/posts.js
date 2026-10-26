// Publicaciones de Instagram para la portada: de la respuesta de instagram-proxy a tarjetas.

const MAX_CAPTION = 90;

/** Primera línea del texto, sin hashtags sueltos al final y cortada a ~90 caracteres. */
export function shortCaption(caption = '') {
  const first = String(caption ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const clean = first.replace(/(\s+#[\p{L}\p{N}_]+)+\s*$/u, '').trim();
  if (clean.length <= MAX_CAPTION) return clean;
  return `${clean.slice(0, MAX_CAPTION).replace(/\s+\S*$/, '')}…`;
}

/**
 * Tarjetas listas para pintar: solo las que tienen imagen y enlace. En un video la imagen es su
 * portada (thumbnail_url); en una foto o carrusel, la foto.
 */
export function shapePosts(list, max = 6) {
  if (!Array.isArray(list)) return [];
  return list
    .map((m) => {
      const isVideo = m?.media_type === 'VIDEO';
      const image = isVideo ? m.thumbnail_url : m?.media_url || m?.thumbnail_url;
      return { id: m?.id, href: m?.permalink, image, isVideo, caption: shortCaption(m?.caption), date: m?.timestamp ?? null };
    })
    .filter((p) => p.id && p.href && p.image && /^https:\/\//.test(p.href) && /^https:\/\//.test(p.image))
    .slice(0, max);
}

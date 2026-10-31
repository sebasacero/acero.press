// Anuncios «Patrocinado», etapa 1 (20261031190000_micra_ads.sql): cuál sale y
// dónde (publicación en Hoy o historia), una vista por celular al día, el
// formulario del equipo y la cuenta de toques. Lógica pura con tests.

export const AD_SEEN_KEY = 'micra_ads_seen_v1';
export const PLACEMENTS = [['feed', 'Publicación en Hoy'], ['story', 'Historia']];
export const AUDIENCES = [['all', 'Todos'], ['client', 'Clientes'], ['barista', 'Baristas']];

const https = (u) => typeof u === 'string' && /^https:\/\/\S+$/.test(u);

/** La hora en Bogotá (0–23). */
export const bogotaHour = (date = new Date()) => Number(date.toLocaleString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false })) % 24;

/** Los anuncios de un formato que van a esta hora; sin franja, todo el día. */
export function adsFor(rows, { placement = 'feed', hour = bogotaHour() } = {}) {
  return (Array.isArray(rows) ? rows : []).filter((a) => a && a.id && a.title && https(a.cta_url)
    && a.placement === placement
    && (a.hour_from == null || a.hour_to == null || (hour >= a.hour_from && hour < a.hour_to)));
}

/**
 * El muro con los anuncios metidos como en Instagram: el primero después de
 * `first` publicaciones y luego uno cada `every`. Cada anuncio sale una vez.
 */
export function withAds(items, ads, { first = 3, every = 5 } = {}) {
  const list = [...(items ?? [])];
  const out = [];
  let next = first;
  let i = 0;
  list.forEach((item, n) => {
    out.push(item);
    if (n + 1 === next && i < (ads ?? []).length) {
      out.push({ ...ads[i], id: `ad-${ads[i].id}`, adId: ads[i].id, kind: 'patrocinado' });
      i += 1;
      next += every;
    }
  });
  return out;
}

/** ¿Este celular ya contó la vista de hoy? (una por anuncio al día) */
export function seenToday(store, id, day) {
  try {
    const s = JSON.parse(store?.getItem(AD_SEEN_KEY) ?? 'null');
    return !!s && s.day === day && Array.isArray(s.ids) && s.ids.includes(id);
  } catch { return false; }
}

export function markSeen(store, id, day) {
  try {
    const s = JSON.parse(store?.getItem(AD_SEEN_KEY) ?? 'null');
    const ids = s?.day === day && Array.isArray(s.ids) ? s.ids : [];
    if (!ids.includes(id)) store?.setItem(AD_SEEN_KEY, JSON.stringify({ day, ids: [...ids, id].slice(-100) }));
  } catch { /* sin memoria */ }
}

/** Toques por cada 100 vistas, «3,2 %»; sin vistas, «—». */
export function ctr(views, taps) {
  if (!views) return '—';
  return `${(Math.round((taps / views) * 1000) / 10).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
}

/**
 * El formulario del equipo → lo que va a micra_ad_save, o el error. El enlace
 * va con https:// (o un número de WhatsApp, que se vuelve wa.me).
 */
export function adDraft(f, today) {
  const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const advertiser = t(f.advertiser, 60);
  const title = t(f.title, 80);
  let cta = String(f.cta_url ?? '').trim();
  const digits = cta.replace(/\D/g, '');
  if (!/^https?:\/\//i.test(cta) && /^(57)?3\d{9}$/.test(digits)) cta = `https://wa.me/${digits.length === 10 ? `57${digits}` : digits}`;
  if (advertiser.length < 2) return { error: 'Falta el nombre del anunciante.' };
  if (title.length < 2) return { error: 'Falta el título.' };
  if (!https(cta)) return { error: 'El enlace va con https:// (o pon un celular de WhatsApp).' };
  if (f.image_url && !https(f.image_url)) return { error: 'La imagen va con https://.' };
  const starts = /^\d{4}-\d{2}-\d{2}$/.test(f.starts_on ?? '') ? f.starts_on : today;
  const ends = /^\d{4}-\d{2}-\d{2}$/.test(f.ends_on ?? '') ? f.ends_on : null;
  if (!ends) return { error: 'Falta hasta cuándo sale.' };
  if (ends < starts) return { error: 'La fecha final va después de la inicial.' };
  const from = f.hour_from === '' || f.hour_from == null ? null : Number(f.hour_from);
  const to = f.hour_to === '' || f.hour_to == null ? null : Number(f.hour_to);
  if ((from == null) !== (to == null) || (from != null && !(from >= 0 && to <= 24 && to > from))) return { error: 'La franja va de una hora a otra mayor (por ejemplo, 6 a 11).' };
  return {
    ad: {
      advertiser, title, body: t(f.body, 240) || null, image_url: f.image_url || null,
      cta_label: t(f.cta_label, 24) || 'Ver más', cta_url: cta,
      placement: PLACEMENTS.some(([id]) => id === f.placement) ? f.placement : 'feed',
      audience: AUDIENCES.some(([id]) => id === f.audience) ? f.audience : 'all',
      hour_from: from, hour_to: to, starts_on: starts, ends_on: ends, active: f.active !== false,
    },
  };
}

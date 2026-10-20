// Textos para redes y utilidades de Micra (puro, sin DOM).

export const PAY_METHODS = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
  { id: 'card', label: 'Tarjeta' },
];

export const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
export const moneyShort = (n) => (n >= 1000 ? `$ ${Math.round(n / 1000)}k` : money(n));

export const slug = (s) => String(s || 'tarjeta').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tarjeta';

/** Número de WhatsApp: si escriben un celular colombiano de 10 dígitos, le agrega el 57. */
export function waDigits(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length === 10 && d.startsWith('3') ? `57${d}` : d;
}

export const PUBLISH_LABEL = { image: 'Feed', story: 'Historia', reel: 'Reel', story_video: 'Historia en video' };
export const PUBLISH_DONE = { image: 'Post publicado en el feed', story: 'Historia publicada', reel: 'Reel publicado', story_video: 'Historia en video publicada' };
export const PUBLISH_ARIA = { image: 'Publicar en Instagram en el feed', story: 'Publicar en Instagram como historia', reel: 'Publicar en Instagram como Reel', story_video: 'Publicar en Instagram como historia en video' };
export const HASHTAGS = '#cafédeespecialidad #aeropress #bogotá #aceropress';

/** Pie de foto automático (el mismo de la consola de Micra). */
export function buildCaption({ kind, preset, text, variety, weather, now = new Date() }) {
  const tempStr = weather?.tempC !== null && weather?.tempC !== undefined ? `${weather.tempC}°C` : '—';
  const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const where = `${weather?.icon ?? ''} ${tempStr} en Bogotá · ${timeStr}`;
  if (kind === 'invite' && preset) {
    return `☕ ${preset.name}${text ? ` — ${preset.textLabel.toLowerCase()}: ${text}` : ''} · AceroPress\n\n${preset.note}\n\n📍 Chapinero, Bogotá · ${where}`;
  }
  if (kind === 'announce' && preset) {
    const coffee = preset.usesVariety && variety ? `: ${variety.name}` : '';
    return `📣 ${preset.name}${coffee} — AceroPress\n\n${text || 'Más información en la barra o por WhatsApp.'}\n\n${where}`;
  }
  return `☕ ${variety?.name ?? ''} — AceroPress\n\n${variety?.recipe_text ?? ''}\n\n${where}`;
}

/** Pie de foto según el destino: WhatsApp va sin etiquetas y con la frase para el cliente. */
export function captionFor(dest, base, hashtags) {
  if (dest === 'whatsapp') return `${base}\n\nTe compartimos la tarjeta de tu preparación 👇`;
  return hashtags ? `${base}\n\n${HASHTAGS}` : base;
}

// Botón rápido: Instagram en sus formatos; en TikTok, Shorts y 16:9, compartir o descargar
const IG_FORMATS = ['feed', 'portrait', 'square', 'story', 'reel'];
export function primaryDest(format, canShareFiles) {
  if (IG_FORMATS.includes(format)) return 'ig';
  return canShareFiles ? 'share' : 'download';
}

export const fileNameFor = ({ name, ext }) => `micra-${slug(name)}.${ext}`;

/** Descripción de la tarjeta para lectores de pantalla. */
export function buildAltText({ formatLabel, title, recipe }) {
  const r = recipe || {};
  const parts = [`Tarjeta de ACERO.press en formato ${formatLabel}: ${title}.`];
  if (r.dose && r.water) parts.push(`Receta AeroPress: ${r.dose} g de café, ${r.water} ml de agua${r.temp ? ` a ${r.temp} °C` : ''}${r.time ? `, ${r.time}` : ''}.`);
  return parts.join(' ');
}

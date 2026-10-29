// La ficha rápida del estudio de calle (FichaFlow): lo primero es poner a la
// persona en el mapa (foto + GPS, diez segundos); todo lo demás es opcional y
// viene después, si hay tiempo y ganas. Puro, sin DOM ni red.

import { gpsPatch } from './study.js';
import { isLocalidad } from '../admin/micra/place.js';
import { TINTERO_OPTIONS } from '../admin/micra/tinteroForm.js';
import { waDigits } from '../admin/micra/captions.js';

/** Pantallas del recorrido, en orden; «detalle» y «encuesta» solo si se piden. */
export const STEPS = ['foto', 'quien', 'extras'];

export const EMPTY_FICHA = {
  name: '', photo_consent: false, ad_consent: false, referencia: '', phone: '', localidad: null,
  formato: null, recorrido: null, products: [], tinto_price: '', perico_price: '', aromatica_price: '', termos: '', hora_inicio: null, hora_fin: null, notes: '',
};

const shortWhen = (at, tz = 'America/Bogota') => new Date(at).toLocaleString('es-CO', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * El nombre cuando no se escribió ninguno: la ficha necesita uno para existir,
 * y en la calle casi nunca da tiempo de preguntarlo. Se arma con lo que haya.
 */
export function autoName({ referencia, localidad, at = Date.now() }) {
  const ref = String(referencia || '').trim();
  if (ref) return `Puesto · ${ref}`.slice(0, 80);
  if (localidad) return `Puesto · ${localidad} · ${shortWhen(at)}`.slice(0, 80);
  return `Puesto · ${shortWhen(at)}`.slice(0, 80);
}

// Precios y termos son enteros: «1.500» es mil quinientos (el punto de miles), no uno y medio
const num = (v, min, max) => {
  if (v === '' || v == null) return null;
  const digits = String(v).replace(/[^\d]/g, '');
  if (!digits) return undefined;
  const n = Number(digits);
  return n >= min && n <= max ? n : undefined;
};

/**
 * Lo que viaja a la API (POST /bi/tinteros) desde el formulario y el punto de GPS.
 * Nada es obligatorio: sin nombre se inventa uno; sin GPS o sin localidad, la ficha
 * queda pendiente en Estudio. Devuelve { body } o { error } (solo por un valor inválido).
 */
export function quickBody(form, gps = null, { now = Date.now() } = {}) {
  const name = String(form.name ?? '').trim().slice(0, 80);
  const body = {
    name: name.length >= 2 ? name : autoName({ referencia: form.referencia, localidad: form.localidad, at: now }),
    photo_consent: !!form.photo_consent,
    ad_consent: !!form.ad_consent,
  };
  const ref = String(form.referencia ?? '').trim();
  if (ref) body.referencia = ref.slice(0, 80);
  const phone = waDigits(form.phone ?? '');
  if (phone) {
    if (!/^[0-9]{7,15}$/.test(phone)) return { error: 'El WhatsApp no se entiende: solo números, con el indicativo si no es de Colombia.' };
    body.phone = phone;
  }
  if (form.localidad) {
    if (!isLocalidad(form.localidad)) return { error: 'Esa localidad no está en el estudio.' };
    body.localidad = form.localidad;
  }
  if (gps && !gps.error) Object.assign(body, gps);
  const opt = (key, v) => { if (v !== null && v !== undefined) body[key] = v; };
  if (form.formato && TINTERO_OPTIONS.formato.some(([v]) => v === form.formato)) opt('formato', form.formato);
  if (form.recorrido && TINTERO_OPTIONS.recorrido.some(([v]) => v === form.recorrido)) opt('recorrido', form.recorrido);
  if (form.products?.length) opt('products', form.products.filter((p) => TINTERO_OPTIONS.products.some(([v]) => v === p)).slice(0, 10));
  for (const [key, label] of [['tinto_price', 'el tinto'], ['perico_price', 'el perico'], ['aromatica_price', 'la aromática']]) {
    const n = num(form[key], 0, 50000);
    if (n === undefined) return { error: `El precio de ${label} no se entiende (hasta $50.000).` };
    opt(key, n);
  }
  const termos = num(form.termos, 0, 20);
  if (termos === undefined) return { error: 'Termos: entre 0 y 20.' };
  opt('termos', termos == null ? null : Math.round(termos));
  if (form.hora_inicio != null) opt('hora_inicio', form.hora_inicio);
  if (form.hora_fin != null) opt('hora_fin', form.hora_fin);
  const notes = String(form.notes ?? '').trim();
  if (notes) body.notes = notes.slice(0, 500);
  return { body };
}

/** El punto del celular → los campos de la ficha ({ lat, lng, gps_accuracy_m, located_at } o { error }). */
export const gpsFields = (pos) => gpsPatch(pos);

/** Qué tan bueno es el punto, para el aviso de la cámara. */
export function gpsBadge(gps, searching) {
  if (gps && !gps.error) return { text: gps.gps_accuracy_m != null ? `GPS ±${gps.gps_accuracy_m} m` : 'GPS listo', tone: gps.gps_accuracy_m == null || gps.gps_accuracy_m <= 50 ? 'ok' : 'warn' };
  if (searching) return { text: 'Buscando el GPS…', tone: 'wait' };
  return { text: 'Sin GPS', tone: 'warn' };
}

/** Lo que se le dice al equipo cuando la ficha quedó guardada. */
export function savedSummary(body, { photo = false, uploaded = false } = {}) {
  const parts = [];
  parts.push(photo ? (uploaded ? 'Foto guardada' : 'Foto sin permiso: no se subió') : 'Sin foto');
  parts.push(body.lat != null ? `GPS ±${body.gps_accuracy_m ?? '?'} m` : 'Sin GPS: márcalo después en Estudio');
  if (body.localidad) parts.push(body.localidad);
  return parts;
}

/** Lo opcional, después de mapear: cada uno abre su camino. */
export const EXTRAS = [
  { id: 'encuesta', label: 'Encuesta', sub: '2 min · si tiene tiempo', needsConsent: false },
  { id: 'video', label: 'Video con filtro', sub: 'preparación o saludo, para las redes', needsConsent: true },
  { id: 'tarjeta', label: 'Su tarjeta', sub: 'foto «Tintero aliado»', needsConsent: true },
  { id: 'recorrido', label: 'Su recorrido', sub: 'por dónde pasa el carrito', needsConsent: false },
  { id: 'ticket', label: 'Ticket', sub: 'le vendí algo', needsConsent: false },
];

// ── Cola sin señal: la ficha se guarda en el celular y sube cuando vuelva la red ──
const QUEUE_KEY = 'micra_ficha_queue_v1';

export function readQueue(storage) {
  try {
    const q = JSON.parse(storage?.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(q) ? q.filter((x) => x && x.ref && x.body) : [];
  } catch { return []; }
}
export function writeQueue(storage, items) {
  try { storage?.setItem(QUEUE_KEY, JSON.stringify(items)); } catch { /* sin memoria */ }
}
export function enqueue(storage, item) {
  const q = readQueue(storage).filter((x) => x.ref !== item.ref);
  q.push({ ref: item.ref, body: item.body, at: item.at ?? Date.now() });
  writeQueue(storage, q);
  return q;
}
export function dequeue(storage, ref) {
  const q = readQueue(storage).filter((x) => x.ref !== ref);
  writeQueue(storage, q);
  return q;
}

/** ¿El error de red es de «sin señal» (y vale la pena encolar) o de la API (y hay que corregir)? */
export const isOffline = (e) => /Failed to fetch|NetworkError|Load failed|network|timeout|abort/i.test(String(e?.message || e || ''));

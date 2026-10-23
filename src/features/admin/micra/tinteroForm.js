// Ficha de campo de un tintero (estudio de calle), lista para la API de BI.
// Lógica pura: lo que se teclea en la calle → lo que se guarda, con las
// mismas reglas que la base (migraciones micra_street_study y
// tintero_ficha_estudio).
//
// Los campos salen del estudio de mercado y de la visión de Micra: el foco es
// el tintero que ya recorre una ruta con sus clientes. Todo lo de abajo se
// OBSERVA o se pregunta en una frase frente al puesto; lo que el tintero
// cuenta con calma (ingresos, proveedor, café) va en la encuesta.

import { parsePlace, isValidPlace, isLocalidad } from './place.js';

/** Opciones de la ficha: [valor guardado, texto en pantalla]. Los valores son los del check de la base. */
export const TINTERO_OPTIONS = {
  formato: [['termos_a_pie', 'Termos a pie'], ['carrito', 'Carrito'], ['bicicleta', 'Bicicleta'], ['puesto_fijo', 'Puesto fijo'], ['otro', 'Otro']],
  recorrido: [['ruta', 'Hace una ruta'], ['mixto', 'Ruta y un punto fijo'], ['fijo', 'Se queda en un punto']],
  products: [['tinto', 'Tinto'], ['perico', 'Perico'], ['aromatica', 'Aromática'], ['chocolate', 'Chocolate'], ['agua_panela', 'Agua de panela'], ['ponque', 'Ponqué'], ['galletas', 'Galletas'], ['empanadas', 'Empanadas'], ['cigarrillos', 'Cigarrillos'], ['dulces', 'Dulces']],
  client_mix: [['fijos', 'Casi todos fijos'], ['mitad', 'Mitad y mitad'], ['de_paso', 'Casi todos de paso']],
  client_types: [['oficinistas', 'Oficinistas'], ['porteros', 'Porteros'], ['obreros', 'Obreros'], ['taxistas', 'Taxistas'], ['conductores', 'Conductores'], ['estudiantes', 'Estudiantes'], ['vendedores', 'Otros vendedores'], ['vecinos', 'Vecinos'], ['transeuntes', 'Gente de paso']],
  payments_seen: [['efectivo', 'Efectivo'], ['nequi', 'Nequi'], ['daviplata', 'Daviplata'], ['bre_b', 'Bre-B'], ['fiado', 'Fiado']],
  ipes: [['si', 'Sí'], ['no', 'No'], ['no_sabe', 'No sabe']],
};
/** Horas en las que arranca y termina (5 a.m. a 9 p.m.), para elegir de un toque. */
export const START_HOURS = [4, 5, 6, 7, 8, 9, 10];
export const END_HOURS = [9, 10, 11, 12, 14, 16, 18, 20];
export const hourLabel = (h) => (h === 12 ? '12 m.' : h < 12 ? `${h} a. m.` : `${h - 12} p. m.`);

export const EMPTY_TINTERO = {
  name: '', localidad: null, place: null,
  formato: null, recorrido: null, hora_inicio: null, hora_fin: null, termos: '',
  products: [], tinto_price: '', perico_price: '', aromatica_price: '', cups_per_hour: '',
  client_mix: null, client_types: [], payments_seen: [], ipes: null,
  photo_consent: false, notes: '',
};

const money = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[.\s$]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};
const count = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN;
};
const oneOf = (field, v) => (TINTERO_OPTIONS[field].some(([x]) => x === v) ? v : null);
const someOf = (field, list) => [...new Set((list ?? []).filter((v) => TINTERO_OPTIONS[field].some(([x]) => x === v)))];

function priceOf(raw, what) {
  const p = money(raw);
  if (Number.isNaN(p)) return { error: `El precio del ${what} va en pesos, solo números.` };
  if (p !== null && (p < 0 || p > 50000)) return { error: `Ese precio no parece de un ${what}.` };
  return { value: p };
}

/**
 * Valida la ficha. Devuelve { body } listo para POST /tinteros (sin la foto:
 * esa va aparte) o { error } con lo primero que falta, en palabras de calle.
 * Obligatorio: nombre y localidad. La cuadra es opcional (en el sur no hay
 * cuadrícula), pero si se escribe tiene que estar completa.
 */
export function buildTintero(form, { surveyedAt = new Date() } = {}) {
  const name = String(form.name ?? '').trim();
  if (name.length < 2) return { error: 'Ponle un nombre al puesto (o a la persona).' };
  if (name.length > 80) return { error: 'El nombre es muy largo.' };
  if (!isLocalidad(form.localidad)) return { error: 'Falta dónde está: elige la localidad.' };
  const place = parsePlace(form.place);
  if (place?.error) return { error: place.error };

  const prices = {};
  for (const [field, what] of [['tinto_price', 'tinto'], ['perico_price', 'perico'], ['aromatica_price', 'aromática']]) {
    const r = priceOf(form[field], what);
    if (r.error) return { error: r.error };
    prices[field] = r.value;
  }
  const cph = count(form.cups_per_hour);
  if (Number.isNaN(cph)) return { error: 'Las tazas por hora van en números.' };
  if (cph !== null && (cph < 0 || cph > 500)) return { error: 'Esas tazas por hora no cuadran.' };
  const termos = count(form.termos);
  if (Number.isNaN(termos) || (termos !== null && (termos < 0 || termos > 20 || !Number.isInteger(termos)))) return { error: 'Los termos van en números enteros (0 a 20).' };
  const start = form.hora_inicio ?? null;
  const end = form.hora_fin ?? null;
  if (start !== null && end !== null && end <= start) return { error: 'La hora en que termina tiene que ser después de la de empezar.' };

  const notes = String(form.notes ?? '').trim().slice(0, 500) || null;
  const lists = Object.fromEntries(['products', 'client_types', 'payments_seen'].map((f) => [f, someOf(f, form[f])]));
  const body = {
    name,
    localidad: form.localidad,
    zone: isValidPlace(place) && place.zone ? place.zone : form.localidad,
    carrera: isValidPlace(place) ? place.carrera : null,
    calle: isValidPlace(place) ? place.calle : null,
    stage: 'prospecto',
    formato: oneOf('formato', form.formato),
    recorrido: oneOf('recorrido', form.recorrido),
    hora_inicio: start,
    hora_fin: end,
    termos,
    ...prices,
    cups_per_hour: cph,
    client_mix: oneOf('client_mix', form.client_mix),
    ipes: oneOf('ipes', form.ipes),
    photo_consent: !!form.photo_consent,
    surveyed_at: surveyedAt.toISOString(),
  };
  // Listas vacías y campos sin respuesta no viajan: «no se anotó» no es «no tiene»
  for (const [f, list] of Object.entries(lists)) if (list.length) body[f] = list;
  for (const k of Object.keys(body)) if (body[k] === null) delete body[k];
  if (notes) body.notes = notes;
  return { body };
}

/** Cuántos de los datos del estudio quedaron anotados (para el contador de la hoja). */
export const FICHA_FIELDS = ['localidad', 'formato', 'recorrido', 'hora_inicio', 'hora_fin', 'termos', 'products', 'tinto_price', 'cups_per_hour', 'client_mix', 'client_types', 'payments_seen', 'ipes'];
export function fichaProgress(form) {
  const done = FICHA_FIELDS.filter((f) => {
    const v = form[f];
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '';
  }).length;
  return { done, total: FICHA_FIELDS.length };
}

/** Si hay foto, solo se guarda con permiso: sin permiso, la foto no sube. */
export const canUploadPhoto = (form, hasPhoto) => !!hasPhoto && !!form.photo_consent;

/** Nombre del archivo en el bucket privado «estudio». */
export const photoPath = (name, now = Date.now()) => `tinteros/${now}-${String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'puesto'}.jpg`;

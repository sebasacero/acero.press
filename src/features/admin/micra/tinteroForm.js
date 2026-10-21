// Ficha de campo de un tintero (estudio de calle), lista para la API de BI.
// Lógica pura: lo que se teclea en la calle → lo que se guarda, con las
// mismas reglas que la base (migración micra_street_study).

import { parsePlace, isValidPlace } from './place.js';

export const EMPTY_TINTERO = { name: '', place: null, tinto_price: '', cups_per_hour: '', photo_consent: false, notes: '' };

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

/**
 * Valida la ficha. Devuelve { body } listo para POST /tinteros (sin la foto:
 * esa va aparte) o { error } con lo primero que falta, en palabras de calle.
 */
export function buildTintero(form, { surveyedAt = new Date() } = {}) {
  const name = String(form.name ?? '').trim();
  if (name.length < 2) return { error: 'Ponle un nombre al puesto (o a la persona).' };
  if (name.length > 80) return { error: 'El nombre es muy largo.' };
  const place = parsePlace(form.place);
  if (!isValidPlace(place)) return { error: place?.error ?? 'Falta dónde está: calle y carrera.' };
  const price = money(form.tinto_price);
  if (Number.isNaN(price)) return { error: 'El precio del tinto va en pesos, solo números.' };
  if (price !== null && (price < 0 || price > 50000)) return { error: 'Ese precio no parece de un tinto.' };
  const cph = count(form.cups_per_hour);
  if (Number.isNaN(cph)) return { error: 'Las tazas por hora van en números.' };
  if (cph !== null && (cph < 0 || cph > 500)) return { error: 'Esas tazas por hora no cuadran.' };
  const notes = String(form.notes ?? '').trim().slice(0, 500) || null;
  return {
    body: {
      name,
      zone: place.zone,
      carrera: place.carrera,
      calle: place.calle,
      stage: 'prospecto',
      tinto_price: price,
      cups_per_hour: cph,
      photo_consent: !!form.photo_consent,
      surveyed_at: surveyedAt.toISOString(),
      ...(notes ? { notes } : {}),
    },
  };
}

/** Si hay foto, solo se guarda con permiso: sin permiso, la foto no sube. */
export const canUploadPhoto = (form, hasPhoto) => !!hasPhoto && !!form.photo_consent;

/** Nombre del archivo en el bucket privado «estudio». */
export const photoPath = (name, now = Date.now()) => `tinteros/${now}-${String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'puesto'}.jpg`;

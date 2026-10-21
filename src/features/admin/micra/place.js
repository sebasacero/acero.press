// Dónde se vende hoy (estudio de calle). La ubicación es (carrera, calle),
// como el mapa del sitio y como la dice cualquiera en Bogotá («la 85 con
// 13»); nada de GPS ni permisos. Las reglas son las mismas que el check de
// la base (migración micra_street_study): las dos coordenadas o ninguna, y
// dentro de Bogotá.

/** Sectores donde se vende, con la cuadra que se toma por defecto al elegirlos. */
export const ZONES = [
  { id: 'Chapinero', carrera: 13, calle: 60 },
  { id: 'Quinta Camacho', carrera: 10, calle: 68 },
  { id: 'Zona T', carrera: 13, calle: 83 },
  { id: 'Parque 93', carrera: 12, calle: 93 },
  { id: 'Usaquén', carrera: 6, calle: 119 },
  { id: 'Teusaquillo', carrera: 22, calle: 38 },
];

const RANGE = { carrera: [1, 120], calle: [1, 200] };

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN;
};
const inRange = (n, [lo, hi]) => n >= lo && n <= hi;

/**
 * Lee un lugar escrito a mano o guardado. Devuelve null si está vacío, el
 * lugar si vale, o { error } si viene a medias o fuera de Bogotá.
 */
export function parsePlace(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const carrera = num(raw.carrera);
  const calle = num(raw.calle);
  const zone = String(raw.zone ?? '').trim().slice(0, 60) || null;
  // Un error conserva lo escrito: los campos lo siguen mostrando y la
  // siguiente edición parte de ahí (no se le borra lo que ya tecleó).
  const keep = (error) => ({ error, carrera: raw.carrera ?? '', calle: raw.calle ?? '', zone });
  if (carrera === null && calle === null) return zone ? keep('Falta la cuadra: carrera y calle.') : null;
  if (carrera === null || calle === null) return keep('El lugar necesita carrera y calle.');
  if (Number.isNaN(carrera) || Number.isNaN(calle)) return keep('Carrera y calle van en números.');
  if (!inRange(carrera, RANGE.carrera) || !inRange(calle, RANGE.calle)) return keep('Ese lugar no está en Bogotá.');
  return { carrera, calle, zone };
}

export const isValidPlace = (p) => !!p && !p.error;

/** La zona entera de un toque: su cuadra por defecto con su nombre. */
export const placeOfZone = (z) => parsePlace({ carrera: z.carrera, calle: z.calle, zone: z.id });

/** Un campo editado a mano sobre el lugar actual (válido o a medias). */
export const editPlace = (current, patch) => parsePlace({ ...(current ?? {}), ...patch });

/** «Calle 85 con 13 · Zona T» */
export function placeLabel(p) {
  if (!isValidPlace(p)) return null;
  const cuadra = `Calle ${fmt(p.calle)} con ${fmt(p.carrera)}`;
  return p.zone ? `${cuadra} · ${p.zone}` : cuadra;
}
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','));

/** Lo que viaja a micra_record_sale como p_place (o null). */
export const placePayload = (p) => (isValidPlace(p) ? { carrera: p.carrera, calle: p.calle, zone: p.zone } : null);

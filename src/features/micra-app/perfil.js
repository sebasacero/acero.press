// «Mi perfil» y «Cerrar sesión» de la app Micra: cómo se muestra el celular,
// con qué entró, qué se borra del celular al salir y cuándo no se deja salir
// (ventas o un recorrido sin subir). Puro, sin DOM ni red: el almacenamiento
// llega como parámetro (localStorage o un doble en las pruebas).

/** Las ventas (+1) que esperan señal (BaristaViews.jsx). Nunca se borran con algo sin subir. */
export const SALES_QUEUE_KEY = 'micra_sales_queue_v1';
/** Las fichas del estudio que esperan señal (fichaFlow.js), del equipo. */
export const FICHA_QUEUE_KEY = 'micra_ficha_queue_v1';
/** El recorrido de «Salí a vender» en curso o por cerrar (ruta/useTracker.js). */
export const ROUTE_KEY = 'micra_ruta_v1';

/**
 * Lo de la sesión que no debe quedarle a quien entre después en el mismo
 * celular: la meta y la fiesta del día, el modo (barista/equipo), la marca de
 * «acaba de entrar», el código de Mi ruta, lo que la cámara le pasa a la ficha
 * y los textos que la cámara recuerda (firma, @usuario). Lo visto en la Escuela
 * se queda: es lo único que guarda su avance y no dice nada privado.
 */
export const SESSION_KEYS = [
  'micra_goal_v1', 'micra_party_v1', 'micra_mode_v1', 'micra_login_pending',
  'micra_ruta_codigo', 'micra_handoff_v1', 'micra_prefs_v1',
];

/**
 * Lo que el celular guarda del cliente (no tiene cuenta): su nombre, sus
 * baristas, la llave de sus apartados y sellos, y la del «busco café» con su
 * preferencia de zona. Los apartados en sí viven en la base, con el barista.
 */
export const CLIENT_KEYS = [
  'micra_name_v1', 'micra_favs_v1', 'micra_device_v1',
  'micra_seek_ref_v1', 'micra_seek_at_v1', 'micra_seek_off_v1',
];

const digits = (v) => String(v ?? '').replace(/\D/g, '');

/**
 * El celular a medias, para mostrarlo sin dictarlo entero: «300 ••• 4567».
 * Acepta «573001234567», «+57 300…» o los 10 dígitos. Otro país: «••• 4567».
 * Vacío o ilegible: ''.
 */
export function maskPhone(input) {
  let d = digits(input);
  if (d.startsWith('0057')) d = d.slice(4);
  else if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  if (/^3\d{9}$/.test(d)) return `${d.slice(0, 3)} ••• ${d.slice(6)}`;
  return d.length >= 7 ? `••• ${d.slice(-4)}` : '';
}

/**
 * Con qué entró, de la sesión de Supabase: 'celular' (SMS), 'google' o 'correo'.
 * Null sin sesión.
 */
export function signInMethod(user) {
  if (!user) return null;
  const p = user.app_metadata?.provider ?? user.identities?.[0]?.provider ?? null;
  if (p === 'phone' || (!p && user.phone)) return 'celular';
  if (p === 'google') return 'google';
  if (p === 'email' || user.email) return 'correo';
  return user.phone ? 'celular' : null;
}

export const METHOD_LABEL = { celular: 'Con tu celular (SMS)', google: 'Con Google', correo: 'Con tu correo' };

const readJson = (storage, key, fallback) => {
  try { return JSON.parse(storage?.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
};

/**
 * Lo que impide cerrar la sesión sin perder algo: ventas sin subir, fichas sin
 * subir (equipo) o el final de un recorrido sin subir. Null si se puede salir.
 * `role`: 'barista' | 'owner'.
 */
export function signOutBlock(storage, role = 'barista') {
  const sales = readJson(storage, SALES_QUEUE_KEY, []);
  if (Array.isArray(sales) && sales.length) return { kind: 'sales', n: sales.length };
  if (role === 'owner') {
    const fichas = readJson(storage, FICHA_QUEUE_KEY, []);
    if (Array.isArray(fichas) && fichas.length) return { kind: 'fichas', n: fichas.length };
  }
  const route = readJson(storage, ROUTE_KEY, null);
  // `ending`: lo marca useTracker al terminar; si sigue ahí, el final no subió
  if (route?.ending) return { kind: 'route' };
  return null;
}

/** Qué decirle cuando no puede salir todavía. */
export function blockText(block) {
  if (!block) return '';
  if (block.kind === 'sales') return `Tienes ${block.n === 1 ? '1 venta' : `${block.n} ventas`} sin subir. Si cierras sesión ahora se perderían: espera a tener señal y que diga «Todo guardado».`;
  if (block.kind === 'fichas') return `Tienes ${block.n === 1 ? '1 ficha' : `${block.n} fichas`} del estudio sin subir. Espera a tener señal y que suban antes de cerrar sesión.`;
  return 'Tu último recorrido no ha subido. Espera a tener señal para no perderlo.';
}

/**
 * Las llaves que se borran al salir. 'barista' y 'owner': lo de la sesión (y
 * la cola de ventas y el recorrido, que a esta altura están vacíos: signOutBlock
 * no deja salir si no). 'client': lo que el celular guarda del cliente.
 */
export function keysToClear(role) {
  if (role === 'client') return [...CLIENT_KEYS];
  const keys = [...SESSION_KEYS, SALES_QUEUE_KEY, ROUTE_KEY];
  return role === 'owner' ? [...keys, FICHA_QUEUE_KEY] : keys;
}

/**
 * Borra esas llaves. Nunca borra una cola con algo adentro (aunque la llamen
 * mal): devuelve las que de verdad borró.
 */
export function clearStored(storage, keys) {
  const removed = [];
  for (const k of keys) {
    try {
      if ((k === SALES_QUEUE_KEY || k === FICHA_QUEUE_KEY) && readJson(storage, k, []).length) continue;
      if (storage.getItem(k) == null) continue;
      storage.removeItem(k);
      removed.push(k);
    } catch { /* sin memoria: no hay nada que borrar */ }
  }
  return removed;
}

// Lo visto en la Escuela, solo en este navegador: es una comodidad, no un registro.
// Si no hay almacenamiento (ventana privada, sin permiso), todo funciona y empieza de cero.
const SEEN_KEY = 'acero.escuela.vistas';

export function readSeen() {
  try {
    const v = JSON.parse(window.localStorage.getItem(SEEN_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function writeSeen(list) {
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(list)); } catch { /* sin almacenamiento: no pasa nada */ }
}

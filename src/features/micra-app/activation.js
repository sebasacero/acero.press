// Activación automática de Micra: las reglas que la base aplica sola
// (20261031120000_micra_auto_activation.sql) y el resumen del equipo.
// Nadie aprueba a mano: cuando un barista cumple los requisitos, sale en el
// mapa y recibe apartados; el cliente que no llega dos veces seguidas se
// frena 7 días y vuelve solo.

/** Los pasos de un barista, en orden. Cada uno se cumple solo con lo que hay en su ficha. */
export const BARISTA_STEPS = [
  { key: 'ficha', label: 'Ficha', rule: 'Tiene ficha del estudio de calle' },
  { key: 'invitado', label: 'Invitado', rule: 'Tiene su celular guardado o un código vigente' },
  { key: 'enlazado', label: 'Entró', rule: 'Entró a la app con su celular o el código' },
  { key: 'activo', label: 'Activo', rule: 'Dio permiso para salir en público y puso el precio del tinto: sale en el mapa y recibe apartados' },
  { key: 'vendiendo', label: 'Vendiendo', rule: 'Vendió o entregó un apartado en los últimos 7 días' },
];

export const CLIENT_RULES = [
  'Aparta sin cuenta, con la llave de su celular',
  'Se activa con su primer apartado entregado',
  'Frecuente: 3 o más entregados en 30 días',
  'Si no llega a sus dos últimos apartados, no aparta por 7 días y vuelve solo',
];

const DAY = 864e5;
export const DORMANT_DAYS = 14;

/** Lo que le falta para el siguiente paso, en palabras del equipo (null si no le falta nada). */
export function missingStep(b, hasPhone = b.has_phone) {
  if (!b.linked) {
    if (!hasPhone && !b.invite_code) return 'Falta enlazar su cuenta: pon su celular o genera un código';
    return 'Falta enlazar su cuenta: que entre con su celular';
  }
  if (!b.public) return 'Falta su permiso para salir en público (ficha › publicidad)';
  if (!b.has_prices) return 'Faltan sus precios';
  return null;
}

/** El paso donde está un barista: ficha · invitado · enlazado · activo · vendiendo · dormido. */
export function baristaLevel(b, { hasPhone = b.has_phone, now = Date.now() } = {}) {
  if (!b.linked) return hasPhone || b.invite_code ? 'invitado' : 'ficha';
  if (!b.public || !b.has_prices) return 'enlazado';
  const last = b.last_active_at ? Date.parse(b.last_active_at) : null;
  if (b.live_until || b.cups > 0 || b.served > 0 || (last && now - last <= 7 * DAY)) return 'vendiendo';
  // Sin dato de actividad (la base aún no lo trae) no se marca dormido
  if (last != null || b.created_at) {
    const since = last ?? Date.parse(b.created_at);
    if (now - since > DORMANT_DAYS * DAY) return 'dormido';
  }
  return 'activo';
}

/** Cuántos requisitos le faltan para quedar activo (0 si ya lo está). */
export function stepsLeft(b, hasPhone = b.has_phone) {
  let n = 0;
  if (!b.linked) n += hasPhone || b.invite_code ? 1 : 2;
  if (!b.public) n += 1;
  if (!b.has_prices) n += 1;
  return n;
}

/**
 * El resumen del equipo a partir de micra_owner_day (y los celulares, si llegan aparte).
 * phones: { id: '57300…' } o null.
 */
export function teamSummary(baristas, { phones = null, clients = null, now = Date.now() } = {}) {
  const hasPhone = (b) => (phones ? !!phones[b.id] : !!b.has_phone);
  const rows = baristas.map((b) => ({ ...b, level: baristaLevel(b, { hasPhone: hasPhone(b), now }), left: stepsLeft(b, hasPhone(b)) }));
  const count = (pred) => rows.filter(pred).length;
  const reached = (key) => {
    const i = BARISTA_STEPS.findIndex((s) => s.key === key);
    return count((r) => levelIndex(r.level) >= i);
  };
  const funnel = BARISTA_STEPS.map((s) => ({ ...s, n: reached(s.key) }));
  const active = count((r) => ['activo', 'vendiendo', 'dormido'].includes(r.level));

  // Los que están a uno o dos pasos, primero los públicos (los clientes ya los ven)
  const almost = rows
    .filter((r) => r.left > 0 && r.left <= 2 && (r.linked || hasPhone(r) || r.invite_code || r.public))
    .sort((a, b) => a.left - b.left || Number(b.public) - Number(a.public) || a.name.localeCompare(b.name, 'es'));

  const alerts = [];
  const waitingOff = rows.filter((r) => r.waiting > 0 && !r.live_until).reduce((a, r) => a + r.waiting, 0);
  if (waitingOff) alerts.push({ key: 'waiting', tone: 'red', text: `${waitingOff} ${waitingOff === 1 ? 'apartado espera' : 'apartados esperan'} a baristas que no están en la calle` });
  const publicNoHolds = count((r) => r.public && r.level !== 'vendiendo' && r.level !== 'activo' && r.level !== 'dormido');
  if (publicNoHolds) alerts.push({ key: 'public', tone: 'ink', text: `${publicNoHolds} salen en el mapa pero aún no reciben apartados (les falta entrar o el precio)` });
  const invited = count((r) => r.level === 'invitado');
  if (invited) alerts.push({ key: 'invited', tone: 'ink', text: `${invited} ${invited === 1 ? 'tiene' : 'tienen'} celular o código y no ha${invited === 1 ? '' : 'n'} entrado: escríbeles` });
  const dormant = count((r) => r.level === 'dormido');
  if (dormant) alerts.push({ key: 'dormant', tone: 'ink', text: `${dormant} activo${dormant === 1 ? '' : 's'} sin vender hace más de ${DORMANT_DAYS} días` });
  if (clients?.paused) alerts.push({ key: 'paused', tone: 'ink', text: `${clients.paused} cliente${clients.paused === 1 ? '' : 's'} frenado${clients.paused === 1 ? '' : 's'} 7 días por no llegar (vuelve${clients.paused === 1 ? '' : 'n'} solo${clients.paused === 1 ? '' : 's'})` });

  return { rows, total: rows.length, active, funnel, almost, alerts, live: rows.filter((r) => r.live_until) };
}

const ORDER = ['ficha', 'invitado', 'enlazado', 'activo', 'vendiendo'];
function levelIndex(level) {
  return level === 'dormido' ? ORDER.indexOf('activo') : ORDER.indexOf(level);
}

export const LEVEL_LABEL = {
  ficha: 'Ficha', invitado: 'Invitado', enlazado: 'Entró', activo: 'Activo', vendiendo: 'Vendiendo', dormido: 'Dormido',
};

/** Busca en el equipo por nombre, lugar, paso («invitado», «activo»…) o «en la calle». Sin texto ni paso, nada. */
export function findBaristas(rows, { q = '', level = null, limit = 8 } = {}) {
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const text = norm(q).trim();
  if (!text && !level) return { items: [], more: 0 };
  const hits = rows.filter((r) => (!level || r.level === level)
    && (!text || norm(`${r.name} ${r.referencia ?? ''} ${r.localidad ?? ''} ${LEVEL_LABEL[r.level] ?? ''}${r.live_until ? ' en la calle' : ''}`).includes(text)));
  return { items: hits.slice(0, limit), more: Math.max(0, hits.length - limit) };
}

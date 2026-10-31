// Los avisos dentro de la app (el «globito» de arriba, como una notificación
// del celular): al barista cuando le apartan, al cliente cuando su barista
// salió, está en su cuadra o le entregó; y el «desliza para recargar». Lógica
// pura con tests. Lo ya avisado se guarda en el celular para no repetirlo y
// para avisar al abrir lo que llegó con la app cerrada.
import { itemsLabel } from './micraApp.js';

export const HOLDS_SEEN_KEY = 'micra_holds_seen_v1';
export const STAGE_SEEN_KEY = 'micra_hold_stage_v1';
export const POLL_MS = 20000;

const read = (store, key) => { try { return JSON.parse(store?.getItem(key) ?? 'null'); } catch { return null; } };
const write = (store, key, v) => { try { store?.setItem(key, JSON.stringify(v)); } catch { /* sin memoria */ } };
const first = (name) => String(name ?? '').split(/[ ·,]/)[0] || 'Un cliente';

/** Los apartados ya avisados hoy a este barista (`scope`: su id y el día). */
export function seenHolds(store, scope) {
  const s = read(store, HOLDS_SEEN_KEY);
  return new Set(s?.scope === scope && Array.isArray(s.ids) ? s.ids : []);
}

/**
 * ¿Este celular ya usó los avisos alguna vez? La primera vez (recién
 * instalada) lo que ya espera se muestra en la lista sin globito; desde ahí,
 * todo apartado sin avisar sale, también los de otro día con la app cerrada.
 */
export const hasHoldMemory = (store) => read(store, HOLDS_SEEN_KEY) != null;

export function rememberHolds(store, scope, ids) {
  write(store, HOLDS_SEEN_KEY, { scope, ids: [...new Set(ids)].slice(-200) });
}

/** Los que esperan y todavía no se avisaron. */
export const newHolds = (holds, seen) => (holds ?? []).filter((h) => h?.status === 'waiting' && h.id && !seen.has(h.id));

/** El globito del barista: uno o varios apartados nuevos. */
export function holdAlert(list) {
  if (!list?.length) return null;
  if (list.length === 1) {
    const h = list[0];
    return { title: 'Nuevo apartado', body: `${first(h.name)} · ${itemsLabel(h.items ?? [])}`, kind: 'hold' };
  }
  const cups = list.reduce((a, h) => a + (Number(h.cups) || 0), 0);
  return { title: `${list.length} apartados nuevos`, body: `${list.map((h) => first(h.name)).join(', ')} · ${cups} ${cups === 1 ? 'taza' : 'tazas'}`, kind: 'hold' };
}

/**
 * El globito del cliente cuando su apartado avanza (1 salió, 2 en tu cuadra,
 * 3 entregado). Solo si avanzó desde lo que ya se le avisó; la primera vez
 * que se ve un apartado no se avisa nada (es lo que él acaba de hacer).
 */
export function stageAlert(store, holdId, stage, name) {
  if (!holdId || stage == null) return null;
  const all = read(store, STAGE_SEEN_KEY) ?? {};
  const before = all[holdId];
  if (before !== stage) write(store, STAGE_SEEN_KEY, { ...Object.fromEntries(Object.entries(all).slice(-30)), [holdId]: stage });
  if (before == null || stage <= before) return null;
  const who = first(name);
  if (stage === 1) return { title: `${who} salió`, body: 'Ya va en camino con tu café.', kind: 'stage' };
  if (stage === 2) return { title: `${who} está en tu cuadra`, body: 'Sal a recibir tu café.', kind: 'stage' };
  if (stage === 3) return { title: '¡Tu café llegó!', body: `${who} te lo entregó. Que lo disfrutes.`, kind: 'stage' };
  return null;
}

/**
 * Desliza para recargar: cuánto baja el indicador (con resistencia, como en
 * las apps) y si ya pasó el punto para soltar y recargar.
 */
export function pullProgress(dy, threshold = 72) {
  const d = Math.max(0, Number(dy) || 0);
  const offset = Math.round(Math.min(threshold * 1.6, d < threshold ? d * 0.6 : threshold * 0.6 + (d - threshold) * 0.25));
  return { offset, progress: Math.min(1, d / threshold), ready: d >= threshold };
}

// Competencia: el reto de la semana (20261101120000_micra_competencia.sql).
// Lo puro: cuánto falta, el podio, la llave de votos de este celular, el
// formulario del equipo y las ideas de retos. Sin React ni Supabase, con tests.
import { newRef } from './micraApp.js';

export const MIN_VOTES = 3; // con menos votos no se entra al podio
export const VOTE_REF_KEY = 'micra_vote_ref_v1';
export const KINDS = [['arte_latte', 'Arte latte'], ['foto', 'Foto del puesto']];

// Ideas para abrir un reto (el equipo las toca y las ajusta)
export const CHALLENGE_IDEAS = [
  { kind: 'arte_latte', title: 'Arte latte: tu mejor corazón', brief: 'Un perico con el corazón más limpio. Vale la foto desde arriba, con luz natural.' },
  { kind: 'arte_latte', title: 'Arte latte: la rosetta', brief: 'Hojas parejas y simétricas. Sube la foto apenas la sirvas.' },
  { kind: 'arte_latte', title: 'Arte latte: el tulipán', brief: 'Tres capas o más, bien centradas.' },
  { kind: 'foto', title: 'Tu puesto al amanecer', brief: 'La primera luz del día sobre tu carrito, tu sombrilla o tu termo.' },
  { kind: 'foto', title: 'El cliente de siempre', brief: 'Con su permiso: la persona que te compra todos los días.' },
];

/** «Cierra hoy», «Cierra mañana», «Quedan 4 días» o «Cerró». */
export function daysLeftLabel(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n < 0) return 'Cerró';
  if (n === 0) return 'Cierra hoy';
  if (n === 1) return 'Cierra mañana';
  return `Quedan ${n} días`;
}

/** «4,2» con una decimal; sin votos, «—». */
export const scoreLabel = (avg) => (avg == null ? '—' : Number(avg).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/**
 * El podio: con MIN_VOTES o más, por promedio y luego por votos (puesto 1, 2,
 * 3…); los demás después, los más votados primero, sin puesto.
 */
export function rankEntries(entries, { minVotes = MIN_VOTES } = {}) {
  const list = (Array.isArray(entries) ? entries : []).filter((e) => e && e.id);
  const by = (a, b) => (Number(b.avg ?? 0) - Number(a.avg ?? 0)) || ((b.votes ?? 0) - (a.votes ?? 0)) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
  const ranked = list.filter((e) => (e.votes ?? 0) >= minVotes).sort(by).map((e, i) => ({ ...e, rank: i + 1 }));
  const rest = list.filter((e) => (e.votes ?? 0) < minVotes).sort((a, b) => ((b.votes ?? 0) - (a.votes ?? 0)) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))).map((e) => ({ ...e, rank: null }));
  return [...ranked, ...rest];
}

/** La llave de votos de este celular: distinta a la de los apartados y a la del «busco café». */
export function voteRef(store, rand) {
  try {
    const cur = store?.getItem(VOTE_REF_KEY);
    if (cur && /^voto-[a-z0-9-]{8,}$/.test(cur)) return cur;
    const ref = newRef('voto', rand);
    store?.setItem(VOTE_REF_KEY, ref);
    return ref;
  } catch { return newRef('voto', rand); }
}

/** ¿Puede calificar esta entrada? No la suya, y solo con el reto abierto. */
export const canVote = (entry, challenge) => !!entry && !entry.mine && Number(challenge?.days_left) >= 0;

export const ENTRY_STATUS = { pending: 'En revisión', approved: 'En el reto', rejected: 'No entró' };

/** El formulario del equipo → lo que va a micra_challenge_save, o el error. */
export function challengeDraft(f, today) {
  const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const title = t(f.title, 80);
  if (title.length < 2) return { error: 'Falta el nombre del reto.' };
  const starts = /^\d{4}-\d{2}-\d{2}$/.test(f.starts_on ?? '') ? f.starts_on : today;
  const ends = /^\d{4}-\d{2}-\d{2}$/.test(f.ends_on ?? '') ? f.ends_on : null;
  if (!ends) return { error: 'Falta hasta cuándo va el reto.' };
  if (ends < starts) return { error: 'La fecha final va después de la inicial.' };
  return {
    ch: {
      title, brief: t(f.brief, 280) || null, prize: t(f.prize, 120) || null,
      kind: KINDS.some(([id]) => id === f.kind) ? f.kind : 'arte_latte',
      starts_on: starts, ends_on: ends,
    },
  };
}

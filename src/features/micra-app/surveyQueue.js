// La encuesta del estudio no se puede perder en la calle: lo que se va
// respondiendo queda como borrador en el celular (una llamada, un cambio de app
// o una recarga no la borran) y, si al guardar no hay señal, queda en cola y
// sube sola. Una encuesta de una ficha que tampoco ha subido espera a su ficha.
// Puro, sin DOM ni red: recibe el `storage`.

const DRAFT_KEY = 'micra_survey_draft_v1';
const QUEUE_KEY = 'micra_survey_queue_v1';
/** Un borrador de ayer ya no es de esta visita. */
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const DRAFT_MAX = 20;

const read = (storage, key, empty) => {
  try { return JSON.parse(storage?.getItem(key) || 'null') ?? empty; } catch { return empty; }
};
const write = (storage, key, value) => {
  try { storage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};

/** La llave de una ficha: su id, o su `ref` de la cola si aún no sube. */
export const surveyKey = (tintero) => (tintero?.id ? String(tintero.id) : tintero?.ref ? `ref:${tintero.ref}` : null);

const hasAnswer = (form) => Object.entries(form ?? {}).some(([k, v]) => k !== 'consent' && (Array.isArray(v) ? v.length > 0 : v !== '' && v !== null && v !== undefined));

function drafts(storage, now = Date.now()) {
  const all = read(storage, DRAFT_KEY, {});
  if (!all || typeof all !== 'object' || Array.isArray(all)) return {};
  return Object.fromEntries(Object.entries(all).filter(([, d]) => d && d.form && now - Number(d.at) < DRAFT_MAX_AGE_MS));
}

/** El borrador de una ficha ({ form, i, at }) o null. */
export function readDraft(storage, key, now = Date.now()) {
  if (!key) return null;
  return drafts(storage, now)[key] ?? null;
}

/** Guarda por dónde va la encuesta; sin permiso ni respuestas no hay nada que guardar. */
export function saveDraft(storage, key, { form, i = 0 }, now = Date.now()) {
  if (!key) return false;
  const all = drafts(storage, now);
  if (!form?.consent && !hasAnswer(form)) delete all[key];
  else all[key] = { form, i, at: now };
  // Solo los más recientes: el celular no es el archivo del estudio
  const kept = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, DRAFT_MAX);
  return write(storage, DRAFT_KEY, Object.fromEntries(kept));
}

export function clearDraft(storage, key) {
  const all = drafts(storage);
  delete all[key];
  write(storage, DRAFT_KEY, all);
}

/** Las fichas con una encuesta a medias (para «Seguir encuesta» en la lista). */
export const draftKeys = (storage, now = Date.now()) => new Set(Object.keys(drafts(storage, now)));

// ── Cola de encuestas sin subir ──────────────────────────────────────────────

export function readSurveyQueue(storage) {
  const q = read(storage, QUEUE_KEY, []);
  return Array.isArray(q) ? q.filter((x) => x && x.ref && x.body && (x.tintero_id || x.ficha_ref)) : [];
}

/**
 * Deja una encuesta en el celular. Va con el id de la ficha o, si la ficha
 * tampoco ha subido, con su `ref` de la cola de fichas. Devuelve false si el
 * celular no dejó guardar (sin espacio): ahí no se puede decir «quedó guardada».
 */
export function queueSurvey(storage, { ref, tintero, body, at = Date.now() }) {
  const item = { ref, body, at, name: tintero?.name ?? null };
  if (tintero?.id) item.tintero_id = String(tintero.id);
  else if (tintero?.ref) item.ficha_ref = tintero.ref;
  else return false;
  const q = readSurveyQueue(storage).filter((x) => x.ref !== ref);
  q.push(item);
  return write(storage, QUEUE_KEY, q);
}

export function unqueueSurvey(storage, ref) {
  const q = readSurveyQueue(storage).filter((x) => x.ref !== ref);
  write(storage, QUEUE_KEY, q);
  return q;
}

/** La ficha subió: sus encuestas en espera ya tienen a quién pegarse. */
export function linkFicha(storage, fichaRef, tinteroId) {
  const q = readSurveyQueue(storage).map((x) => (x.ficha_ref === fichaRef ? { ref: x.ref, body: x.body, at: x.at, name: x.name, tintero_id: String(tinteroId) } : x));
  write(storage, QUEUE_KEY, q);
  return q;
}

/** La ficha fue rechazada: su encuesta no tiene dónde quedar. */
export function dropFicha(storage, fichaRef) {
  const q = readSurveyQueue(storage).filter((x) => x.ficha_ref !== fichaRef);
  write(storage, QUEUE_KEY, q);
  return q;
}

/** Las fichas (por id) con una encuesta esperando en el celular. */
export const queuedIds = (queue) => new Set((queue ?? []).map((x) => x.tintero_id).filter(Boolean));

/**
 * ¿La API rechazó lo enviado y reintentar no sirve? Solo eso se saca de la
 * cola. Sin señal, sesión vencida (401), servidor caído (5xx) o cualquier
 * otra cosa: se queda en el celular y se vuelve a intentar.
 */
export const isRejected = (e) => [400, 404, 410, 422].includes(Number(e?.status));

/** «2 fichas y 1 encuesta» para el aviso de lo que espera en el celular. */
export function waitingText({ fichas = 0, surveys = 0 }) {
  const parts = [];
  if (fichas) parts.push(`${fichas} ${fichas === 1 ? 'ficha' : 'fichas'}`);
  if (surveys) parts.push(`${surveys} ${surveys === 1 ? 'encuesta' : 'encuestas'}`);
  return parts.join(' y ');
}

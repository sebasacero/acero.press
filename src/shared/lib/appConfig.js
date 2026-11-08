import { supabase } from './supabaseClient.js';

// Las secciones del sitio piden sus claves de app_config cada una por su lado
// (la portada hacía 24 consultas al abrir). Lo que se pide en el mismo momento
// sale en UNA consulta `in (...)`: el mismo resultado, menos viajes con mala señal.
let pending = null;

function flush() {
  const batch = pending;
  pending = null;
  const keys = [...batch.keys()];
  supabase.from('app_config').select('key, value').in('key', keys).then(({ data, error }) => {
    if (error) console.error(`Error leyendo app_config (${keys.join(', ')}):`, error.message);
    const found = new Map((data ?? []).map((r) => [r.key, r.value]));
    for (const [key, waiters] of batch) waiters.forEach((w) => w(error ? { error } : { value: found.get(key) }));
  }, (error) => {
    for (const waiters of batch.values()) waiters.forEach((w) => w({ error }));
  });
}

/** Lee varias claves; se junta con las que pidan otras secciones en el mismo tick. */
export function loadConfigKeys(keys) {
  if (!pending) { pending = new Map(); setTimeout(flush, 0); }
  return Promise.all(keys.map((key) => new Promise((resolve) => {
    if (!pending.has(key)) pending.set(key, []);
    pending.get(key).push(resolve);
  }))).then((rows) => {
    const failed = rows.find((r) => r.error);
    if (failed) return { error: failed.error, values: {} };
    return { error: null, values: Object.fromEntries(keys.map((k, i) => [k, rows[i].value]).filter(([, v]) => v !== undefined)) };
  });
}

/**
 * Trae valores de configuración pública (tabla app_config). Pensada solo
 * para datos que de por sí terminan siendo visibles en el sitio (como el
 * número de WhatsApp, que aparece en el link wa.me) — nunca para secretos.
 */
export async function fetchAppConfig(key, fallback = null) {
  const { error, values } = await loadConfigKeys([key]);
  if (error || values[key] == null) return fallback;
  return values[key];
}

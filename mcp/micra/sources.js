// De dónde lee el servidor MCP. Dos fuentes con la misma forma:
//   remoteSource: producción, con la sesión de quien pregunta (el owner). La
//     base y la API de Acero vuelven a verificar el rol: el MCP no salta RLS.
//   fileSource: un JSON con las mismas respuestas, para pruebas y demos sin red.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

async function asJson(res, what) {
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* respuesta que no es JSON */ }
  if (!res.ok) {
    const why = body?.detail ?? body?.message ?? body?.error ?? (text.slice(0, 160) || res.statusText);
    throw new Error(`${what}: HTTP ${res.status} ${typeof why === 'string' ? why : JSON.stringify(why)}`);
  }
  return body;
}

/**
 * @param {{ apiBase: string, supabaseUrl: string, anonKey: string, token: string, fetchImpl?: typeof fetch }} opts
 */
export function remoteSource({ apiBase, supabaseUrl, anonKey, token, fetchImpl = fetch }) {
  if (!apiBase || !supabaseUrl || !anonKey || !token) throw new Error('Faltan apiBase, supabaseUrl, anonKey o token.');
  const api = String(apiBase).replace(/\/+$/, '');
  const auth = { Authorization: `Bearer ${token}` };
  const rpc = (fn, args = {}) =>
    fetchImpl(`${String(supabaseUrl).replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { ...auth, apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    }).then((r) => asJson(r, fn));
  return {
    piloto: (days) => fetchImpl(`${api}/api/v1/bi/piloto?days=${days}`, { headers: auth }).then((r) => asJson(r, 'piloto')),
    liveMap: (minutes) => rpc('micra_live_map', { p_minutes: minutes }),
    ownerDay: () => rpc('micra_owner_day'),
    pulse: () => fetchImpl(`${api}/api/v1/pulse`).then((r) => asJson(r, 'pulso')),
    holdRatings: () => rpc('micra_hold_ratings'),
    holdTimes: (days) => rpc('micra_hold_times', { p_days: days }),
    fincas: () => rpc('micra_finca_presencia_list'),
  };
}

/** @param {{ piloto?: any, liveMap?: any, ownerDay?: any, pulse?: any, holdRatings?: any, holdTimes?: any, fincas?: any }} data */
export function memorySource(data) {
  const pick = (k) => async () => {
    if (data?.[k] == null) throw new Error(`Sin datos de «${k}» en el archivo.`);
    return structuredClone(data[k]);
  };
  return {
    piloto: pick('piloto'), liveMap: pick('liveMap'), ownerDay: pick('ownerDay'), pulse: pick('pulse'),
    holdRatings: pick('holdRatings'), holdTimes: pick('holdTimes'), fincas: pick('fincas'),
  };
}

export async function fileSource(path) {
  return memorySource(JSON.parse(await readFile(path, 'utf8')));
}

export const DEMO_PATH = fileURLToPath(new URL('./demo.json', import.meta.url));

/**
 * Elige la fuente con las variables de entorno (stdio y el script de demo):
 * MICRA_MCP_DATA → ese JSON; MICRA_TOKEN → datos reales; ninguna → la demo.
 */
export async function sourceFromEnv(env = process.env) {
  if (env.MICRA_MCP_DATA) return fileSource(env.MICRA_MCP_DATA);
  if (!env.MICRA_TOKEN) return fileSource(DEMO_PATH);
  return remoteSource({
    apiBase: env.MICRA_API_BASE || 'https://www.aceropress.com',
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
    token: env.MICRA_TOKEN,
  });
}

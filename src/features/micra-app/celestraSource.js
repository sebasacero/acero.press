// De dónde lee el algoritmo de Celestra en el celular: las mismas RPC y la API de Acero que
// usa el servidor MCP, pero con la sesión del navegador (sin pasar por /api/micra-agent, así
// no gasta ni necesita la clave de la IA). La última lectura buena se guarda en el celular:
// sin señal, el parte sale de ahí y lo dice.
import { supabase } from '../../shared/lib/supabaseClient.js';
import { apiUrl } from '../../shared/lib/apiBase.js';
import { analyze } from '../admin/social/social.js';
import { hayLectura, leer } from '../../../mcp/micra/algoritmo.js';

export const LECTURAS_KEY = 'micra_celestra_lecturas_v1';
const DAY = 86_400_000;

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
async function api(path, withAuth) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(apiUrl(path), { headers: withAuth ? { Authorization: `Bearer ${session?.access_token ?? ''}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const source = {
  piloto: (days) => api(`/api/v1/bi/piloto?days=${days}`, true),
  liveMap: (minutes) => rpc('micra_live_map', { p_minutes: minutes }),
  ownerDay: () => rpc('micra_owner_day'),
  pulse: () => api('/api/v1/pulse', false),
  holdRatings: () => rpc('micra_hold_ratings'),
  holdTimes: (days) => rpc('micra_hold_times', { p_days: days }),
  fincas: () => rpc('micra_finca_presencia_list'),
};

// Instagram (lo sincronizado en ig_media) y la tienda (pedidos no cancelados), 30 días. null = no se pudo leer.
async function redes30() {
  const { data, error } = await supabase.from('ig_media')
    .select('id, media_product, media_type, caption, posted_at, like_count, comments_count, reach, views, saved, shares')
    .gte('posted_at', new Date(Date.now() - 30 * DAY).toISOString()).limit(300);
  if (error) return null;
  const { totals } = analyze(data ?? [], [], { days: 30 });
  return { posts: totals.feed, perWeek: totals.perWeek, reach: totals.reach };
}
async function tienda30() {
  const { data, error } = await supabase.from('orders').select('created_at, total, status')
    .gte('created_at', new Date(Date.now() - 30 * DAY).toISOString()).neq('status', 'cancelled').limit(500);
  if (error || !Array.isArray(data)) return null;
  const week = Date.now() - 7 * DAY;
  return {
    pedidos_30d: data.length,
    pedidos_7d: data.filter((o) => Date.parse(o.created_at) >= week).length,
    total_30d: data.reduce((a, o) => a + (Number(o.total) || 0), 0),
  };
}

function readCache(storage) {
  try { const v = JSON.parse(storage?.getItem(LECTURAS_KEY) ?? 'null'); return v && typeof v === 'object' && v.l ? v : null; } catch { return null; }
}

/** Lo que el algoritmo necesita hoy: { l, redes, tienda, cached }. Sin señal, la última lectura guardada. */
export async function lecturasDeHoy(storage) {
  const [l, redes, tienda] = await Promise.all([leer(source), redes30().catch(() => null), tienda30().catch(() => null)]);
  if (hayLectura(l)) {
    const fresh = { l, redes, tienda };
    try { storage?.setItem(LECTURAS_KEY, JSON.stringify(fresh)); } catch { /* sin espacio: sigue sin guardar */ }
    return { ...fresh, cached: false };
  }
  const old = readCache(storage);
  return old ? { ...old, cached: true } : { l, redes, tienda, cached: false };
}

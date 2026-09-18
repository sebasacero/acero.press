import { supabase } from './supabaseClient.js';

/**
 * Trae valores de configuración pública (tabla app_config). Pensada solo
 * para datos que de por sí terminan siendo visibles en el sitio (como el
 * número de WhatsApp, que aparece en el link wa.me) — nunca para secretos.
 */
export async function fetchAppConfig(key, fallback = null) {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error(`Error leyendo app_config.${key}:`, error.message);
    return fallback;
  }
  return data.value;
}

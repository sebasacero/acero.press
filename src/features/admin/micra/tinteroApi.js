import { supabase } from '../../../shared/lib/supabaseClient.js';

/** API de BI de Acero con la sesión del owner (fichas de tinteros). */
export async function biApi(path, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/v1/bi${path}`, {
    method,
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(Array.isArray(detail) ? detail.map((d) => d.msg).join(' · ') : detail || 'La API de Acero no respondió.');
  }
  return data;
}

/** Anota que el tintero aceptó salir en la publicidad (la fecha la pone el servidor). */
export const grantAdConsent = (id) => biApi(`/tinteros/${encodeURIComponent(id)}`, { method: 'PATCH', body: { ad_consent: true } });

import { supabase } from '../../../shared/lib/supabaseClient.js';

/** Guarda una encuesta por la API de Acero (solo el owner; la base exige el permiso del tintero). */
export async function postSurvey(tinteroId, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/v1/bi/tinteros/${encodeURIComponent(tinteroId)}/surveys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(Array.isArray(detail) ? detail.map((d) => String(d.msg).replace(/^Value error, /, '')).join(' · ') : detail || 'La API de Acero no respondió.');
  }
  return data;
}

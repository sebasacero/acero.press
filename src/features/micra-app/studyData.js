import { supabase } from '../../shared/lib/supabaseClient.js';
import { apiUrl } from '../../shared/lib/apiBase.js';

/** Las fichas, encuestas y rutas del estudio (API de Acero, solo el equipo). */
export async function loadStudy(days = 90) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(apiUrl(`/api/v1/bi/piloto?days=${days}`), { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || 'La API de Acero no respondió.');
  return data;
}

import { supabase } from './supabaseClient.js';

/** Trae una sección activa por su slug (para renderizarla en el sitio público). */
export async function fetchSection(slug) {
  const { data, error } = await supabase
    .from('page_sections')
    .select('slug, section_type, content, order_index, active')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  if (error) {
    console.error(`Error cargando la sección "${slug}":`, error.message);
    return null;
  }
  return data;
}

/** Trae todas las secciones (activas e inactivas) — para el panel de admin. */
export async function fetchAllSections() {
  const { data, error } = await supabase
    .from('page_sections')
    .select('id, slug, section_type, content, order_index, active, updated_at')
    .order('order_index');
  if (error) {
    console.error('Error cargando las secciones:', error.message);
    return [];
  }
  return data ?? [];
}

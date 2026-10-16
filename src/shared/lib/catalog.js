import { supabase } from './supabaseClient.js';

/**
 * Trae los productos activos de una categoría (coffee_bag | aeropress_equipment)
 * con sus presentaciones (variantes) activas:
 *
 * [{ id, name, image, sizes: ['250G', '500G', '1KG'],
 *    prices: { '250G': 18000, ... }, variantIds: { '250G': 'uuid...', ... } }]
 *
 * `sizes` viene ordenado: para el café por tamaño; para el resto, por precio.
 */
const COFFEE_ORDER = ['250G', '500G', '1KG'];

export async function fetchProductsByCategory(category) {
  const { data, error } = await supabase
    .from('products')
    .select('id, slug, name, image_url, product_variants(id, label, price, active)')
    .eq('category', category)
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Error cargando el catálogo desde Supabase:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((p) => p.product_variants?.some((v) => v.active))
    .map((p) => {
      const active = p.product_variants.filter((v) => v.active);
      const rank = (v) => {
        const i = COFFEE_ORDER.indexOf(v.label);
        return i === -1 ? COFFEE_ORDER.length + Number(v.price) / 1e9 : i;
      };
      active.sort((a, b) => rank(a) - rank(b) || Number(a.price) - Number(b.price));
      const prices = {};
      const variantIds = {};
      active.forEach((v) => {
        prices[v.label] = Number(v.price);
        variantIds[v.label] = v.id;
      });
      return {
        id: p.slug,
        name: p.name,
        image: p.image_url,
        sizes: active.map((v) => v.label),
        prices,
        variantIds,
      };
    });
}

/** Variedades de café (bolsas). */
export const fetchCoffeeVarieties = () => fetchProductsByCategory('coffee_bag');

/** Equipo AeroPress (prensas, filtros, accesorios). */
export const fetchAeropressProducts = () => fetchProductsByCategory('aeropress_equipment');

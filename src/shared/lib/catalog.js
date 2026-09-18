import { supabase } from './supabaseClient.js';

/**
 * Trae las variedades de café activas junto con sus presentaciones (variantes) activas.
 * Devuelve la misma forma que antes usaba el arreglo VARIETIES hardcodeado en
 * ProductSection.jsx, para no tener que rediseñar el componente:
 *
 * [{ id, name, image, prices: { '250G': 18000, '500G': 30000, '1KG': 55000 },
 *    variantIds: { '250G': 'uuid...', '500G': 'uuid...', '1KG': 'uuid...' } }]
 */
export async function fetchCoffeeVarieties() {
  const { data, error } = await supabase
    .from('products')
    .select('id, slug, name, image_url, product_variants(id, label, price, active)')
    .eq('category', 'coffee_bag')
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Error cargando el catálogo desde Supabase:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((p) => p.product_variants?.some((v) => v.active))
    .map((p) => {
      const prices = {};
      const variantIds = {};
      p.product_variants
        .filter((v) => v.active)
        .forEach((v) => {
          prices[v.label] = Number(v.price);
          variantIds[v.label] = v.id;
        });
      return {
        id: p.slug,
        name: p.name,
        image: p.image_url,
        prices,
        variantIds,
      };
    });
}

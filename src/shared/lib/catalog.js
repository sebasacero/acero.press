import { supabase } from './supabaseClient.js';

/**
 * Trae los productos activos de una categoría (coffee_bag | aeropress_equipment)
 * con sus presentaciones (variantes) activas:
 *
 * [{ id, name, brand, description, variety, region, image, sizes: ['250G', '500G', '1KG'],
 *    prices: { '250G': 18000, ... }, variantIds: { '250G': 'uuid...', ... } }]
 *
 * `sizes` viene ordenado: para el café por tamaño; para el resto, por precio.
 */
const COFFEE_ORDER = ['250G', '500G', '1KG'];

export async function fetchProductsByCategory(category) {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('category', category)
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Error cargando el catálogo desde Supabase:', error.message);
    return [];
  }

  return shapeProducts(data);
}

const PRODUCT_FIELDS = 'id, slug, name, brand, description, variety, region, category, image_url, product_variants(id, label, price, active)';

/** Productos activos por id (para recetas y el barista), con la misma forma que fetchProductsByCategory. */
export async function fetchProductsByIds(ids) {
  if (!ids?.length) return [];
  const { data, error } = await supabase.from('products').select(PRODUCT_FIELDS).in('id', ids).eq('active', true);
  if (error) {
    console.error('Error cargando productos:', error.message);
    return [];
  }
  return shapeProducts(data);
}

function shapeProducts(data) {
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
        uuid: p.id,
        category: p.category,
        name: p.name,
        brand: p.brand ?? null,
        description: p.description ?? null,
        variety: p.variety ?? null,
        region: p.region ?? null,
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

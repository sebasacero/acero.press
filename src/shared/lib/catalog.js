import { supabase } from './supabaseClient.js';
import { PRODUCT_FIELDS, shapeProducts } from './productShape.js';

/**
 * Trae los productos activos de una categoría (coffee_bag | aeropress_equipment)
 * con sus presentaciones (variantes) activas:
 *
 * [{ id, name, brand, description, variety, region, image, sizes: ['250G', '500G', '1KG'],
 *    prices: { '250G': 18000, ... }, variantIds: { '250G': 'uuid...', ... } }]
 *
 * `sizes` viene ordenado: para el café por tamaño; para el resto, por precio.
 */
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

/** Variedades de café (bolsas). */
export const fetchCoffeeVarieties = () => fetchProductsByCategory('coffee_bag');

/** Equipo AeroPress (prensas, filtros, accesorios). */
export const fetchAeropressProducts = () => fetchProductsByCategory('aeropress_equipment');

// Forma común de un producto del catálogo (navegador y funciones de Vercel).
// Sin dependencias: catalog.js, el barista y el agente la comparten.

export const PRODUCT_FIELDS = 'id, slug, name, brand, description, variety, region, category, image_url, product_variants(id, label, price, active)';

// 18G = sachet de una preparación de AeroPress.
const COFFEE_ORDER = ['18G', '250G', '500G', '1KG'];

/**
 * [{ id: slug, uuid, category, name, brand, description, variety, region, image,
 *    sizes: ['250G', ...], prices: { '250G': 18000 }, variantIds: { '250G': 'uuid' } }]
 * `sizes` va ordenado: el café por tamaño; el resto, por precio.
 */
export function shapeProducts(data) {
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

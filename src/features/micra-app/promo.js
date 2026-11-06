// La publicidad de ACERO.press en Micra (6 nov 2026, pedido del usuario): en el inicio del
// cliente, el video plano de la lata (public/image/cans.mp4) y al terminar, el carrusel de las
// latas de las recetas de la casa. Antes era un banner encima de «Mi perfil» una vez al día;
// ya no sale solo: está en el inicio y se abre desde «Otros › ACERO.press».
// Lógica pura con tests: las latas con su precio (el mismo del sitio, page_sections
// `cold_brew`, el contenido de las recetas de la vitrina) y el mensaje de WhatsApp.

/** Las latas de la casa, en el orden del carrusel. `heat`: el tramo del gradiente térmico. */
export const HOUSE_CANS = [
  { id: 'cold-brew', name: 'Cold brew', temp: '4 °C · frío', heat: 'cold', note: 'AeroPress invertida con hielo', match: /cold\s*brew/i },
  { id: 'latte', name: 'Latte', temp: '65 °C · caliente', heat: 'hot', note: 'Espresso doble y leche', match: /latte/i },
  { id: 'americano', name: 'Americano', temp: '85 °C · caliente', heat: 'hot', note: 'Espresso doble y agua', match: /americano/i },
  { id: 'matcha-mambe', name: 'Matcha mambé', temp: '45 °C · tibio', heat: 'warm', note: 'Mambé amazónico y leche de coco', match: /mamb/i },
];

function slidesOf(content) {
  let c = content;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { return []; } }
  return Array.isArray(c?.slides) ? c.slides : [];
}

const priceOf = (slide) => {
  const p = Number(slide?.price);
  return Number.isFinite(p) && p > 0 && p < 1000000 ? Math.round(p) : null;
};

/** Las latas con el precio de su receta en el sitio; sin precio, null (nunca uno inventado). */
export function houseCans(content) {
  const slides = slidesOf(content);
  return HOUSE_CANS.map(({ match, ...can }) => {
    const slide = slides.find((s) => match.test(s?.title1?.es ?? ''));
    return { ...can, price: priceOf(slide) };
  });
}

/** El precio de la lata de cold brew en el sitio. */
export const coldBrewPrice = (content) => houseCans(content)[0].price;

/** Lo que le llega al equipo por WhatsApp al tocar «Pídela». */
export const canText = (name = 'Cold brew', cans = 1) =>
  `Hola, ACERO.press. Quiero pedir ${cans === 1 ? 'una lata' : `${cans} latas`} de ${name.toLowerCase()}. ¿Cuánto es y cuándo me llega?`;

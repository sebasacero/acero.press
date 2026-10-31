// El banner de la lata de cold brew de ACERO.press: sale encima de «Mi perfil»
// del cliente una vez al día (como el de las apps de domicilios) y se abre otra
// vez desde su acceso. Lógica pura con tests: cuándo sale, el precio de la lata
// (el mismo del sitio, page_sections `cold_brew`) y el mensaje de WhatsApp.

export const PROMO_KEY = 'micra_promo_coldbrew_v1';

/** Sale una vez al día: si hoy ya se cerró, vuelve mañana. Sin memoria, no sale. */
export function promoDue(store, day) {
  try { return !!store && store.getItem(PROMO_KEY) !== day; } catch { return false; }
}

/** Hoy ya se vio. */
export function promoSeen(store, day) {
  try { store?.setItem(PROMO_KEY, day); } catch { /* sin memoria */ }
}

/** El precio de la lata en el sitio: la diapositiva de COLD BREW (lata de 355 ml). */
export function coldBrewPrice(content) {
  let c = content;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { return null; } }
  const slides = Array.isArray(c?.slides) ? c.slides : [];
  const slide = slides.find((s) => /cold\s*brew/i.test(s?.title1?.es ?? '') || /lata/i.test(s?.figLabel?.es ?? ''));
  const p = Number(slide?.price);
  return Number.isFinite(p) && p > 0 && p < 1000000 ? Math.round(p) : null;
}

/** Lo que le llega al equipo por WhatsApp al tocar «Pídela». */
export const coldBrewText = (cans = 1) => `Hola, ACERO.press. Quiero pedir ${cans === 1 ? 'una lata' : `${cans} latas`} de cold brew (355 ml). ¿Cuánto es y cuándo me llega?`;

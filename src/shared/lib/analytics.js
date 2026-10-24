// Medición del sitio con Google Analytics 4 (G-6F6S72KWWQ, se carga en index.html).
// Lo que se mide son acciones, no personas: de dónde llega la gente (utm_*),
// qué mira y qué hace (carrito, pago, WhatsApp, Escuela). Con eso, cuando haya
// Pixel de Meta, se sabe a quién dirigir la publicidad.
//
// Ley 1581: hasta que la persona acepta, Google recibe solo señales sin cookies
// (Consent Mode). El equipo no se cuenta: el panel no carga GA y quien entra
// como admin queda marcado en su navegador.

export const GA_ID = 'G-6F6S72KWWQ';
const CONSENT_KEY = 'acero.consent'; // 'granted' | 'denied'
const TEAM_KEY = 'acero.team';

/** El panel (/admin) y Mi ruta (/ruta) son del equipo y los tinteros: no se miden. */
export const isTrackedPath = (pathname) => !/^\/(admin|ruta)(\/|$)/.test(pathname || '/');

/** Carrito → artículos de GA4 (comercio electrónico). */
export function gaItems(lines) {
  return (lines ?? []).map((l) => ({
    item_id: String(l.variantId ?? l.id ?? l.name),
    item_name: l.name,
    ...(l.variant ? { item_variant: l.variant } : {}),
    price: Number(l.price) || 0,
    quantity: Number(l.qty) || 1,
  }));
}
export const gaValue = (lines) => (lines ?? []).reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 1), 0);

/** Evento de compra/carrito con moneda y valor ya calculados. */
export const commerce = (lines, extra = {}) => ({ currency: 'COP', value: gaValue(lines), items: gaItems(lines), ...extra });

const storage = () => { try { return window.localStorage; } catch { return null; } };

export function readConsent() {
  const v = storage()?.getItem(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

/** «Aceptar» o «Solo lo necesario» del aviso de cookies. */
export function setConsent(granted) {
  const v = granted ? 'granted' : 'denied';
  try { storage()?.setItem(CONSENT_KEY, v); } catch { /* sin almacenamiento */ }
  window.gtag?.('consent', 'update', { analytics_storage: v, ad_storage: v, ad_user_data: v, ad_personalization: v });
}

/** Quien entra como admin no cuenta como visita, ni ahora ni en sus próximas visitas. */
export function markTeam() {
  try { storage()?.setItem(TEAM_KEY, '1'); } catch { /* sin almacenamiento */ }
  window[`ga-disable-${GA_ID}`] = true;
}

/** Un evento de GA4. Sin GA (bloqueador, panel, pruebas) no hace nada. */
export function track(name, params = {}) {
  try { window.gtag?.('event', name, params); } catch { /* la medición nunca rompe la tienda */ }
}

/** Dónde se tocó algo: la sección más cercana con id («beans», «metodo», «escuela»…). */
export const sectionOf = (el) => el?.closest?.('[id]')?.id ?? null;

/** Un solo oyente para todos los enlaces a WhatsApp del sitio. */
export function trackWhatsAppClicks(doc = document) {
  const onClick = (e) => {
    const a = e.target?.closest?.('a[href*="wa.me/"]');
    if (a) track('contact_whatsapp', { section: sectionOf(a.parentElement) ?? 'sitio', page: window.location.pathname });
  };
  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}

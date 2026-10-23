// El carrito vive en esta pestaña (sessionStorage): sobrevive a recargar y a pasar de la
// portada a /escuela, que son páginas distintas. Aquí va la parte pura, para probarla.
export const CART_KEY = 'acero.carrito';
const MAX_QTY = 999;

/** Lo guardado → artículos con forma válida; cualquier cosa rara se descarta. */
export function parseCart(raw) {
  try {
    const list = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) return [];
    return list.filter((i) => i && typeof i.id === 'string' && typeof i.name === 'string'
      && Number.isFinite(i.price) && i.price >= 0
      && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= MAX_QTY);
  } catch {
    return [];
  }
}

/** Al volver de un pago aprobado o en curso, ese pedido ya quedó hecho: el carrito empieza vacío. */
export const paidOnReturn = (search) => /[?&]payment=(success|pending)(&|$)/.test(search || '');

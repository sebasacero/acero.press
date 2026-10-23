// Filtros de la cámara de Micra, por sección. Cada filtro es una tarjeta con
// el nombre que va escrito en ella: en Receta, la variedad del catálogo; en
// Invitación y Anuncio, estos modelos (más un texto que se escribe encima).
// `layout` (opcional) es el diseño propio del modelo (ver micra/cardLayout.js)
// y `freeText` el texto libre con el que arranca.

export const CARD_KINDS = [
  { id: 'recipe', label: 'Receta' },
  { id: 'invite', label: 'Invitación' },
  { id: 'announce', label: 'Anuncio' },
];

export const PRESETS = {
  invite: [
    {
      id: 'te-invito', name: 'Te invito un café', glyph: '☕', badge: 'POR LA CASA',
      textLabel: 'Para', placeholder: 'Nombre de a quién invitas',
      note: 'Pásate por la barra, di tu nombre y el café va por nuestra cuenta.',
    },
    {
      id: 'bienvenida', name: 'Café de bienvenida', glyph: '✦', badge: 'PRIMERA VEZ',
      textLabel: 'Para', placeholder: 'Nombre (opcional)',
      note: 'Tu primer café de especialidad con AeroPress, invitado por nosotros.',
    },
    {
      id: 'cata', name: 'Cata abierta', glyph: '◎', badge: 'ENTRADA LIBRE',
      textLabel: 'Cuándo', placeholder: 'Ej.: sábado 4 p. m.',
      note: 'Probamos tinto y café de especialidad a ciegas. Trae a alguien y vota.',
    },
    {
      id: 'hoy-invitamos', name: 'Hoy invitamos', glyph: '♥', badge: 'SOLO HOY',
      textLabel: 'Detalle', placeholder: 'Ej.: los primeros 10 cafés',
      note: 'Los primeros cafés del día van por la casa. Ven temprano.',
    },
  ],
  announce: [
    {
      id: 'nuevo-cafe', name: 'Nuevo café', glyph: '★', badge: 'NUEVO', usesVariety: true,
      textLabel: 'Anuncio', placeholder: 'Ej.: llegó de Huila, notas a frutos rojos',
      layout: { price: { visible: true } },
    },
    {
      id: 'abrimos', name: 'Hoy abrimos', glyph: '◐', badge: 'HORARIO',
      textLabel: 'Anuncio', placeholder: 'Ej.: desde las 7 a. m. en la 72',
    },
    {
      id: 'promo', name: 'Promo', glyph: '%', badge: 'PROMO',
      textLabel: 'Anuncio', placeholder: 'Ej.: 2×1 en sachets hasta el viernes',
      layout: { free: { visible: true } }, freeText: '¡Solo esta semana!',
    },
    {
      id: 'evento', name: 'Evento', glyph: '▲', badge: 'EVENTO',
      textLabel: 'Anuncio', placeholder: 'Ej.: campeonato AeroPress el sábado',
    },
    {
      // La tarjeta se llena con la ficha de un tintero que aceptó salir en la publicidad (micra/tinteroAd.js)
      id: 'tintero', name: 'Tintero aliado', glyph: '◉', badge: 'TINTERO ALIADO', usesTintero: true,
      textLabel: 'Anuncio', placeholder: 'Qué vende y a qué hora',
      layout: { place: { visible: true }, drawing: { visible: false } }, // sin la receta dibujada: no es una preparación
    },
    {
      id: 'aviso', name: 'Aviso', glyph: '!', badge: 'AVISO',
      textLabel: 'Anuncio', placeholder: 'Ej.: hoy cerramos a las 3 p. m.',
      layout: { drawing: { visible: false } },
    },
  ],
};

export const presetOf = (kind, id) => (PRESETS[kind] ?? []).find((p) => p.id === id) ?? PRESETS[kind]?.[0] ?? null;

// Micra siempre abre en la cámara. Otras entradas (⌘K «Registrar una venta»)
// dejan una intención para que el estudio abra, además, la hoja de Venta: se
// guarda en sessionStorage (si Micra aún no está abierto) y se avisa con un
// evento (si ya lo está).
const MICRA_INTENT = 'micra_open';
export const MICRA_INTENT_EVENT = 'micra:intent';
export function requestMicra(intent = 'camera') {
  try { sessionStorage.setItem(MICRA_INTENT, intent); } catch { /* sin almacenamiento */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MICRA_INTENT_EVENT, { detail: intent }));
}
// Leer y borrar van separados: React (en desarrollo) llama dos veces al
// valor inicial del estado, y la segunda lectura no debe perder la marca.
export function readMicraIntent() {
  try { return sessionStorage.getItem(MICRA_INTENT); } catch { return null; }
}
export function clearMicraIntent() {
  try { sessionStorage.removeItem(MICRA_INTENT); } catch { /* sin almacenamiento */ }
}

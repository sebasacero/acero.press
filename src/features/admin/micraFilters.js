// Filtros de la cámara de Micra, por sección. Cada filtro es una tarjeta con
// el nombre que va escrito en ella: en Receta, la variedad del catálogo; en
// Invitación y Anuncio, estos modelos (más un texto que se escribe encima).

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
    },
    {
      id: 'abrimos', name: 'Hoy abrimos', glyph: '◐', badge: 'HORARIO',
      textLabel: 'Anuncio', placeholder: 'Ej.: desde las 7 a. m. en la 72',
    },
    {
      id: 'promo', name: 'Promo', glyph: '%', badge: 'PROMO',
      textLabel: 'Anuncio', placeholder: 'Ej.: 2×1 en sachets hasta el viernes',
    },
    {
      id: 'evento', name: 'Evento', glyph: '▲', badge: 'EVENTO',
      textLabel: 'Anuncio', placeholder: 'Ej.: campeonato AeroPress el sábado',
    },
    {
      id: 'aviso', name: 'Aviso', glyph: '!', badge: 'AVISO',
      textLabel: 'Anuncio', placeholder: 'Ej.: hoy cerramos a las 3 p. m.',
    },
  ],
};

export const presetOf = (kind, id) => (PRESETS[kind] ?? []).find((p) => p.id === id) ?? PRESETS[kind]?.[0] ?? null;

// El ícono "m." del inicio abre la cámara de una: deja esta marca y la
// ventana de Micra la consume al abrirse.
const CAMERA_INTENT = 'micra_open_camera';
export function requestCamera() {
  try { sessionStorage.setItem(CAMERA_INTENT, '1'); } catch { /* sin almacenamiento */ }
}
// Leer y borrar van separados: React (en desarrollo) llama dos veces al
// valor inicial del estado, y la segunda lectura no debe perder la marca.
export function hasCameraIntent() {
  try { return sessionStorage.getItem(CAMERA_INTENT) === '1'; } catch { return false; }
}
export function clearCameraIntent() {
  try { sessionStorage.removeItem(CAMERA_INTENT); } catch { /* sin almacenamiento */ }
}

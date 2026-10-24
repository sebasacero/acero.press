// Ubicación del tintero con el GPS del celular: en la calle nadie sabe la
// cuadra (y en el sur la numeración no sigue la cuadrícula del norte), así que
// la ficha guarda el punto del GPS y una referencia que se entienda
// («puerta principal de Plaza de las Américas»). Puro, sin DOM.

// Bogotá con sus bordes (Sumapaz llega al sur hasta ~3,7°): un punto fuera es un error del GPS
const BOGOTA = { south: 3.7, north: 4.85, west: -74.5, east: -73.95 };

/** Lo que devuelve getCurrentPosition → lo que guarda la ficha, o { error }. */
export function gpsFix(position, now = new Date()) {
  const c = position?.coords;
  const lat = Number(c?.latitude);
  const lng = Number(c?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: 'El celular no dio la ubicación. Intenta otra vez.' };
  if (lat < BOGOTA.south || lat > BOGOTA.north || lng < BOGOTA.west || lng > BOGOTA.east) {
    return { error: 'Esa ubicación queda fuera de Bogotá. Espera unos segundos con buena señal y vuelve a marcar.' };
  }
  const accuracy = Number.isFinite(Number(c.accuracy)) ? Math.round(Number(c.accuracy)) : null;
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    accuracy,
    at: new Date(position.timestamp ?? now).toISOString(),
  };
}

/** Qué tan bueno es el punto: 'buena' (≤ 30 m), 'regular' (≤ 100 m) o 'debil'. */
export function gpsQuality(accuracy) {
  if (accuracy == null) return 'regular';
  if (accuracy <= 30) return 'buena';
  if (accuracy <= 100) return 'regular';
  return 'debil';
}

/** Lo que se ve en la ficha: «Marcado · ±12 m». */
export function gpsLabel(fix) {
  if (!fix || fix.error) return null;
  return fix.accuracy != null ? `Marcado · ±${fix.accuracy} m` : 'Marcado';
}

/** Mensaje del navegador → palabras de calle (códigos de GeolocationPositionError). */
export function gpsErrorText(err) {
  if (err?.code === 1) return 'El celular no dio permiso de ubicación. Actívalo para este sitio en el navegador y vuelve a marcar.';
  if (err?.code === 3) return 'El GPS tardó mucho. Sal a cielo abierto o espera unos segundos y vuelve a marcar.';
  return 'No se pudo leer el GPS. Revisa que la ubicación del celular esté encendida.';
}

/** Para abrir el punto en un mapa y revisarlo. */
export const gpsMapUrl = (fix) => `https://www.openstreetmap.org/?mlat=${fix.lat}&mlon=${fix.lng}#map=18/${fix.lat}/${fix.lng}`;

/** Lo que viaja a la API: { lat, lng, gps_accuracy_m, located_at } o {} sin punto. */
export function gpsPayload(fix) {
  if (!fix || fix.error) return {};
  return { lat: fix.lat, lng: fix.lng, gps_accuracy_m: fix.accuracy, located_at: fix.at };
}

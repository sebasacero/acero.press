// De (carrera, calle) a coordenadas GPS en Bogotá, para dibujar el estudio de
// calle sobre un mapa real (MapLibre). La cuadrícula de Bogotá es casi recta:
// un ajuste lineal sobre puntos de referencia con coordenadas publicadas, más
// una corrección que hace exacto cada punto y se desvanece con la distancia
// (la carrera 7 se curva hacia Usaquén). Precisión esperada: una o dos cuadras
// en Chapinero y el norte; fuera de la cuadrícula (sur, diagonales) es solo
// orientativo. Cuando Micra guarde GPS, ese dato manda sobre este.

// [carrera, calle, lat, lng]: lugares cuya dirección y coordenadas son públicas
export const ANCHORS = [
  [7, 28, 4.6155, -74.069], // Museo Nacional, Cra. 7 #28-66
  [7, 40, 4.6289, -74.0647], // Universidad Javeriana, Cra. 7 #40-62
  [30, 57, 4.6461, -74.0775], // Estadio El Campín, Cra. 30 #57-60
  [11, 82, 4.66705, -74.05259], // Centro Andino, Cra. 11 #82-71
  [12, 93, 4.67694, -74.04861], // Parque de la 93
  [6, 119, 4.6952, -74.0309], // Plaza de Usaquén
];

// Mínimos cuadrados de v = x0 + x1·carrera + x2·calle (ecuaciones normales 3×3)
function fitPlane(anchors, col) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const b = [0, 0, 0];
  for (const a of anchors) {
    const r = [1, a[0], a[1]];
    for (let i = 0; i < 3; i += 1) {
      b[i] += r[i] * a[col];
      for (let j = 0; j < 3; j += 1) A[i][j] += r[i] * r[j];
    }
  }
  for (let i = 0; i < 3; i += 1) {
    const p = A[i][i];
    for (let j = 0; j < 3; j += 1) A[i][j] /= p;
    b[i] /= p;
    for (let k = 0; k < 3; k += 1) {
      if (k === i) continue;
      const f = A[k][i];
      for (let j = 0; j < 3; j += 1) A[k][j] -= f * A[i][j];
      b[k] -= f * b[i];
    }
  }
  return b;
}

const plane = (x, c, k) => x[0] + x[1] * c + x[2] * k;

/** Conversión ajustada a unas referencias (las de arriba por defecto; las pruebas dejan una afuera). */
export function makeGeo(anchors = ANCHORS) {
  const LAT = fitPlane(anchors, 2);
  const LNG = fitPlane(anchors, 3);
  const resid = anchors.map(([c, k, lat, lng]) => [c, k, lat - plane(LAT, c, k), lng - plane(LNG, c, k)]);
  return (carrera, calle) => {
    if (carrera === null || carrera === undefined || carrera === '' || calle === null || calle === undefined || calle === '') return null;
    const c = Number(carrera);
    const k = Number(calle);
    if (!Number.isFinite(c) || !Number.isFinite(k) || c < 1 || c > 120 || k < 1 || k > 200) return null;
    // Corrección por distancia inversa al cuadrado (en cuadras): exacta en cada referencia
    let w = 0;
    let dLat = 0;
    let dLng = 0;
    for (const [ac, ak, rLat, rLng] of resid) {
      const d2 = (c - ac) ** 2 + (k - ak) ** 2;
      if (d2 < 1e-9) return [plane(LNG, c, k) + rLng, plane(LAT, c, k) + rLat];
      w += 1 / d2;
      dLat += rLat / d2;
      dLng += rLng / d2;
    }
    return [plane(LNG, c, k) + dLng / w, plane(LAT, c, k) + dLat / w];
  };
}

/** [lng, lat] de una cuadra (como lo pide GeoJSON), o null si no es una cuadra de Bogotá. */
export const toLngLat = makeGeo();

/** Distancia aproximada en metros entre dos [lng, lat] (suficiente a escala de ciudad). */
export function meters([lng1, lat1], [lng2, lat2]) {
  const kx = 111320 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot((lng2 - lng1) * kx, (lat2 - lat1) * 110574);
}

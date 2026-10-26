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

/**
 * De GPS a la cuadra más cercana (carrera, calle): el inverso de toLngLat
 * por Newton. null fuera de la cuadrícula (el sur, las diagonales) o si no
 * converge a menos de 40 m.
 */
export function toCuadra(lng, lat) {
  let c = 12;
  let k = 70;
  const h = 0.05;
  for (let it = 0; it < 30; it += 1) {
    const p = toLngLat(c, k);
    const pc = toLngLat(Math.min(c + h, 120), k);
    const pk = toLngLat(c, Math.min(k + h, 200));
    if (!p || !pc || !pk) return null;
    const fx = p[0] - lng;
    const fy = p[1] - lat;
    const a = (pc[0] - p[0]) / h;
    const b = (pk[0] - p[0]) / h;
    const cc = (pc[1] - p[1]) / h;
    const d = (pk[1] - p[1]) / h;
    const det = a * d - b * cc;
    if (Math.abs(det) < 1e-12) return null;
    const dc = (d * fx - b * fy) / det;
    const dk = (a * fy - cc * fx) / det;
    c = Math.min(119.9, Math.max(1, c - dc));
    k = Math.min(199.9, Math.max(1, k - dk));
    if (Math.abs(dc) < 1e-4 && Math.abs(dk) < 1e-4) break;
  }
  const back = toLngLat(c, k);
  if (!back || meters(back, [lng, lat]) > 40) return null;
  return { carrera: Math.round(c), calle: Math.round(k) };
}

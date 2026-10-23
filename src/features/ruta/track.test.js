import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptFix, detectStops, distanceOf, elapsed, fromPosition, km, newRef, simplifyPath, summarize, toCuadra } from './track.js';
import { meters, toLngLat } from '../../shared/lib/bogotaGeo.js';

const T0 = Date.parse('2026-10-27T11:30:00Z'); // 6:30 en Bogotá
const pt = (sec, lat, lng, acc = 10) => ({ t: new Date(T0 + sec * 1000).toISOString(), lat, lng, acc });
// Un metro en grados, cerca de Chapinero
const DLAT = 1 / 110574;

test('fromPosition toma la lectura del navegador y redondea a 6 decimales', () => {
  const p = fromPosition({ timestamp: T0, coords: { latitude: 4.64312345, longitude: -74.06361234, accuracy: 12.6 } });
  assert.deepEqual(p, { t: '2026-10-27T11:30:00.000Z', lat: 4.643123, lng: -74.063612, acc: 13 });
  assert.equal(fromPosition({ coords: {} }), null);
  assert.equal(fromPosition(null), null);
});

test('acceptFix descarta lo que no sirve y explica por qué', () => {
  const a = pt(0, 4.6431, -74.0636);
  assert.equal(acceptFix(null, a).reason, 'primero');
  assert.equal(acceptFix(null, pt(0, 6.25, -75.56)).reason, 'fuera-de-bogota');
  assert.equal(acceptFix(null, pt(0, 4.6431, -74.0636, 80)).reason, 'impreciso');
  assert.equal(acceptFix(a, pt(0, 4.6432, -74.0636)).reason, 'repetido');
  // 500 m en 10 s = 50 m/s: un salto del GPS
  assert.equal(acceptFix(a, pt(10, 4.6431 + 500 * DLAT, -74.0636)).reason, 'salto');
  // Quieto: 2 m en 10 s no se guarda; un minuto después sí
  assert.equal(acceptFix(a, pt(10, 4.6431 + 2 * DLAT, -74.0636)).reason, 'quieto');
  assert.equal(acceptFix(a, pt(61, 4.6431 + 2 * DLAT, -74.0636)).keep, true);
  // Caminando: 20 m en 15 s
  assert.equal(acceptFix(a, pt(15, 4.6431 + 20 * DLAT, -74.0636)).keep, true);
  // Sin precisión (algunos celulares) se acepta
  assert.equal(acceptFix(null, { ...a, acc: null }).keep, true);
});

test('distanceOf suma los tramos', () => {
  const pts = [pt(0, 4.64, -74.06), pt(60, 4.64 + 100 * DLAT, -74.06), pt(120, 4.64 + 250 * DLAT, -74.06)];
  assert.ok(Math.abs(distanceOf(pts) - 250) < 1);
  assert.equal(distanceOf([]), 0);
});

// Marlene: 4 min en la portería, camina 300 m, 5 min en el paradero, cruza (1 min en el semáforo), sigue
function marlene() {
  const pts = [];
  let s = 0;
  const lat0 = 4.6431;
  const lng = -74.0636;
  for (let i = 0; i <= 4; i += 1) pts.push(pt((s = i * 60), lat0 + (i % 2) * 5 * DLAT, lng)); // portería
  for (let i = 1; i <= 15; i += 1) pts.push(pt((s += 15), lat0 + i * 20 * DLAT, lng)); // 300 m
  const lat1 = lat0 + 300 * DLAT;
  for (let i = 1; i <= 5; i += 1) pts.push(pt((s += 60), lat1 + (i % 2) * 6 * DLAT, lng)); // paradero
  for (let i = 1; i <= 5; i += 1) pts.push(pt((s += 15), lat1 + i * 20 * DLAT, lng));
  const lat2 = lat1 + 100 * DLAT;
  pts.push(pt((s += 60), lat2 + 2 * DLAT, lng)); // semáforo
  for (let i = 1; i <= 5; i += 1) pts.push(pt((s += 15), lat2 + i * 20 * DLAT, lng));
  return pts;
}

test('detectStops encuentra la portería y el paradero, no el semáforo', () => {
  const stops = detectStops(marlene());
  assert.equal(stops.length, 2);
  assert.equal(stops[0].minutes, 4);
  // Cuenta desde que llega a 35 m de la esquina hasta que se aleja: 5 min y los pasos de llegada y salida
  assert.ok(stops[1].minutes >= 5 && stops[1].minutes <= 6, String(stops[1].minutes));
  assert.ok(meters([stops[0].lng, stops[0].lat], [-74.0636, 4.6431]) < 10);
  assert.ok(meters([stops[1].lng, stops[1].lat], [-74.0636, 4.6431 + 300 * DLAT]) < 10);
  assert.equal(detectStops([]).length, 0);
});

test('detectStops junta una parada interrumpida por un paso corto en la misma esquina', () => {
  const lat = 4.66;
  const lng = -74.055;
  const pts = [pt(0, lat, lng), pt(120, lat, lng), pt(200, lat, lng), pt(215, lat + 40 * DLAT, lng), pt(240, lat, lng), pt(420, lat, lng), pt(500, lat + 3 * DLAT, lng)];
  const stops = detectStops(pts);
  assert.equal(stops.length, 1);
  assert.equal(stops[0].minutes, 8);
});

test('toCuadra es el inverso de toLngLat en la cuadrícula del piloto', () => {
  for (const [c, k] of [[13, 60], [7, 53], [11, 82], [12, 93], [9, 52], [15, 72]]) {
    const [lng, lat] = toLngLat(c, k);
    assert.deepEqual(toCuadra(lng, lat), { carrera: c, calle: k }, `${c}/${k}`);
  }
  // Fuera de la cuadrícula (Medellín, o al oriente de los cerros): sin cuadra
  assert.equal(toCuadra(-75.56, 6.25), null);
});

test('simplifyPath no toca un trazo corto, deja una recta larga en sus extremos y respeta el máximo', () => {
  const line = Array.from({ length: 100 }, (_, i) => pt(i * 10, 4.64 + i * 10 * DLAT, -74.06));
  assert.equal(simplifyPath(line).length, 100);
  assert.equal(simplifyPath(line, 50).length, 2);
  const zigzag = Array.from({ length: 1000 }, (_, i) => pt(i * 10, 4.64 + i * 5 * DLAT, -74.06 + (i % 2) * 0.0003));
  const p = simplifyPath(zigzag, 400);
  assert.ok(p.length <= 400 && p.length >= 2);
  assert.deepEqual(p[0], [-74.06, 4.64]);
});

test('summarize arma lo que guarda tintero_route_end, con la cuadra de cada parada', () => {
  const s = summarize(marlene());
  assert.ok(s.distance_m > 500 && s.distance_m < 600, String(s.distance_m));
  assert.equal(s.stops.length, 2);
  assert.ok('carrera' in s.stops[0] && 'calle' in s.stops[0]);
  assert.ok(s.path.length >= 2 && s.path.length <= 400);
  assert.deepEqual(summarize([]), { distance_m: 0, stops: [], path: [] });
});

test('elapsed, km y newRef', () => {
  assert.equal(elapsed('2026-10-27T11:30:00Z', T0 + 75_000), '01:15');
  assert.equal(elapsed('2026-10-27T11:30:00Z', T0 + 3_725_000), '1:02:05');
  assert.equal(km(3640), '3,6 km');
  assert.equal(km(0), '0,0 km');
  const r = newRef(() => 0.5);
  assert.match(r, /^ruta-[0-9a-z]+-[0-9a-z]{6}$/);
  assert.ok(r.length >= 8 && r.length <= 64);
});

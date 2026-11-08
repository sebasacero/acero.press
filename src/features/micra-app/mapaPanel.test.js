import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startOfBogotaDay, windowSince, heatOf, agoLabel, kmLabel, durationLabel, cleanPoints,
  routeTracks, panelPeople, searchPeople, studyPoints, sightingPoints, tracksGeoJSON,
  panelKpis, boundsOf, personDetail, ONLINE_MS,
} from './mapaPanel.js';

// 8 nov 2026, 3:00 p. m. en Bogotá (20:00 UTC)
const NOW = Date.parse('2026-11-08T20:00:00Z');
const DAY = Date.parse('2026-11-08T05:00:00Z');
const iso = (offMin) => new Date(NOW + offMin * 60000).toISOString();

test('el día empieza a las 0:00 de Bogotá, no de UTC', () => {
  assert.equal(startOfBogotaDay(NOW), DAY);
  // 11:30 p. m. del 7 nov en Bogotá ya es 8 nov en UTC: sigue siendo el 7
  assert.equal(startOfBogotaDay(Date.parse('2026-11-08T04:30:00Z')), DAY - 864e5);
  assert.equal(windowSince('hoy', NOW), DAY);
  assert.equal(windowSince('7d', NOW), DAY - 6 * 864e5);
  assert.equal(windowSince('30d', NOW), DAY - 29 * 864e5);
});

test('color térmico: lo de ahora caliente, lo viejo frío', () => {
  assert.equal(heatOf(NOW, NOW, true), '#F2542D');
  assert.equal(heatOf(NOW - 3600e3, NOW), '#DE1B1B');
  assert.equal(heatOf(NOW - 10 * 3600e3, NOW), '#B0127A');
  assert.equal(heatOf(NOW - 3 * 864e5, NOW), '#5A1E9E');
  assert.equal(heatOf(NOW - 20 * 864e5, NOW), '#22125A');
});

test('etiquetas cortas', () => {
  assert.equal(agoLabel(NOW - 20e3, NOW), 'ahora');
  assert.equal(agoLabel(NOW - 5 * 60e3, NOW), 'hace 5 min');
  assert.equal(agoLabel(NOW - 3 * 3600e3, NOW), 'hace 3 h');
  assert.equal(agoLabel(NOW - 30 * 3600e3, NOW), 'ayer');
  assert.equal(agoLabel(null, NOW), 'nunca');
  assert.equal(kmLabel(840), '840 m');
  assert.equal(kmLabel(3491), '3,5 km');
  assert.equal(kmLabel(null), '—');
  assert.equal(durationLabel(0, 12 * 60000), '12 min');
  assert.equal(durationLabel(0, 125 * 60000), '2 h 05 min');
  assert.equal(durationLabel(10, 0), '—');
});

test('los puntos se ordenan y se descartan los imposibles', () => {
  const pts = cleanPoints([
    { lat: 4.65, lng: -74.06, recorded_at: iso(-1) },
    { lat: 4.64, lng: -74.06, recorded_at: iso(-2) },
    { lat: 0, lng: 0, recorded_at: iso(-3) },
    { lat: 4.6, lng: -74.0, recorded_at: null },
  ]);
  assert.deepEqual(pts.map((p) => p.lat), [4.64, 4.65]);
});

const routes = [
  // En curso: los puntos crudos dan el trazo y la distancia
  { id: 'r1', tintero_id: 'a', started_at: iso(-90), ended_at: null, source: 'gps' },
  // Terminada hoy, con su path guardado
  { id: 'r2', tintero_id: 'b', started_at: iso(-300), ended_at: iso(-200), distance_m: 2300, path: [[-74.06, 4.65], [-74.05, 4.66]], stops: [{}, {}], source: 'gps' },
  // Levantada por el equipo hace 10 días
  { id: 'r3', tintero_id: 'c', started_at: iso(-14400), ended_at: iso(-14300), distance_m: 900, path: [[-74.1, 4.6], [-74.11, 4.61]], source: 'relato' },
  // Abierta pero dormida (último punto hace 2 h): no está «en vivo»
  { id: 'r4', tintero_id: 'd', started_at: iso(-300), ended_at: null },
];
const livePoints = [
  { route_id: 'r1', lat: 4.65, lng: -74.06, recorded_at: iso(-60) },
  { route_id: 'r1', lat: 4.651, lng: -74.06, recorded_at: iso(-30) },
  { route_id: 'r1', lat: 4.652, lng: -74.061, recorded_at: iso(-2) },
  { route_id: 'r4', lat: 4.7, lng: -74.05, recorded_at: iso(-120) },
];

test('rutas: la ventana, en curso, el color y la distancia', () => {
  const today = routeTracks({ routes, livePoints, since: windowSince('hoy', NOW), now: NOW });
  assert.deepEqual(today.map((t) => t.id), ['r1', 'r4', 'r2']);
  const [r1, r4, r2] = today;
  assert.equal(r1.live, true);
  assert.equal(r1.color, '#F2542D');
  assert.deepEqual(r1.head, [-74.061, 4.652]);
  assert.ok(r1.distance > 200 && r1.distance < 300);
  assert.equal(r4.open, true);
  assert.equal(r4.live, false);
  assert.equal(r2.stops, 2);
  assert.equal(r2.distance, 2300);
  const month = routeTracks({ routes, livePoints, since: windowSince('30d', NOW), now: NOW });
  assert.equal(month.length, 4);
  assert.equal(month.find((t) => t.id === 'r3').color, '#22125A');
});

const tinteros = [
  { id: 'a', name: 'Marlene Rojas', linked: true, referencia: 'Cl. 57 con Cra. 7', out_until: iso(60), out_lat: 4.643, out_lng: -74.064, app_seen_at: iso(-0.5), lat: 4.6, lng: -74.1, stage: 'activo' },
  { id: 'b', name: 'Jairo', linked: false, zone: 'Chapinero', lat: 4.65, lng: -74.06, stage: 'prospecto' },
  { id: 'e', name: 'Ana', linked: true, app_seen_at: iso(-1), lat: 4.66, lng: -74.05, stage: 'piloto' },
  { id: 'f', name: 'Rosa', linked: true, app_seen_at: iso(-600), stage: 'piloto' },
  { id: 'g', name: 'Sin nada', linked: false, lat: 4.61, lng: -74.07, stage: 'prospecto' },
  { id: 'h', name: 'Se fue', linked: true, stage: 'salio' },
];

test('personas: quién sale, su estado y dónde ponerlo', () => {
  const since = windowSince('hoy', NOW);
  const tracks = routeTracks({ routes, livePoints, since, now: NOW });
  const people = panelPeople({ tinteros, tracks, live: { baristas: [] }, since, now: NOW });
  assert.deepEqual(people.map((p) => [p.id, p.status]), [['a', 'calle'], ['e', 'app'], ['b', 'hoy'], ['f', 'hoy']]);
  const a = people[0];
  // En la calle con la ruta en curso: el último punto exacto
  assert.equal(a.posKind, 'gps');
  assert.deepEqual(a.pos, { lng: -74.061, lat: 4.652 });
  assert.equal(a.tracking, true);
  // Sin ruta en curso: el punto de su ficha
  assert.equal(people.find((p) => p.id === 'e').posKind, 'ficha');
  // Sin punto conocido
  assert.equal(people.find((p) => p.id === 'f').pos, null);
  assert.equal(people.find((p) => p.id === 'b').distance, 2300);
});

test('personas: «en la calle» también por el mapa en vivo y el punto de salida', () => {
  const people = panelPeople({
    tinteros: [{ id: 'x', name: 'Luz', linked: true, lat: 4.6, lng: -74.1 }],
    tracks: [],
    live: { baristas: [{ id: 'x', lat: 4.655, lng: -74.058 }] },
    since: DAY,
    now: NOW,
  });
  assert.equal(people[0].status, 'calle');
  assert.equal(people[0].posKind, 'salida');
  assert.deepEqual(people[0].pos, { lat: 4.655, lng: -74.058 });
});

test('«con Micra abierta» vence a los 3 minutos', () => {
  const t = [{ id: 'x', name: 'Luz', linked: true, app_seen_at: new Date(NOW - ONLINE_MS - 1000).toISOString() }];
  assert.equal(panelPeople({ tinteros: t, tracks: [], since: DAY, now: NOW })[0].status, 'hoy');
});

test('buscar sin tildes, por lugar o por estado', () => {
  const people = [
    { name: 'Marlene', where: 'Cl. 57', localidad: 'Chapinero', status: 'calle' },
    { name: 'Ana María', where: '', localidad: 'Kennedy', status: 'off' },
  ];
  assert.equal(searchPeople(people, 'maria').length, 1);
  assert.equal(searchPeople(people, 'kennedy')[0].name, 'Ana María');
  assert.equal(searchPeople(people, 'en la calle')[0].name, 'Marlene');
  assert.equal(searchPeople(people, '  ').length, 2);
});

test('estudio: puntos con encuesta y sin datos privados', () => {
  const s = studyPoints([...tinteros, { id: 'z', name: 'Fuera', lat: 10, lng: 10 }], [{ tintero_id: 'b' }]);
  assert.equal(s.features.length, 4);
  const b = s.features.find((f) => f.properties.id === 'b');
  assert.equal(b.properties.survey, true);
  assert.deepEqual(Object.keys(b.properties).sort(), ['id', 'linked', 'name', 'price', 'survey', 'where']);
});

test('avistamientos de la ventana', () => {
  const s = sightingPoints([{ lat: 4.65, lng: -74.06, at: iso(-10) }, { lat: 4.65, lng: -74.06, at: iso(-3000) }], DAY);
  assert.equal(s.features.length, 1);
});

test('trazos: solo con 2 puntos, y el foco apaga a los demás', () => {
  const tracks = routeTracks({ routes, livePoints, since: windowSince('30d', NOW), now: NOW });
  const g = tracksGeoJSON(tracks, 'a');
  assert.deepEqual(g.features.map((f) => f.properties.id), ['r1', 'r2', 'r3']);
  assert.equal(g.features.find((f) => f.properties.id === 'r1').properties.dim, 0);
  assert.equal(g.features.find((f) => f.properties.id === 'r2').properties.dim, 1);
  assert.equal(g.features.find((f) => f.properties.id === 'r3').properties.team, 1);
});

test('cifras del panel', () => {
  const since = windowSince('hoy', NOW);
  const tracks = routeTracks({ routes, livePoints, since, now: NOW });
  const people = panelPeople({ tinteros, tracks, since, now: NOW });
  const k = panelKpis({
    people, tracks,
    study: studyPoints(tinteros, [{ tintero_id: 'b' }]),
    live: { min_count: 2, demand: [{ n: 3 }, { n: 2 }, { n: 1 }] },
    sightings: sightingPoints([], since),
  });
  assert.equal(k.calle, 1);
  assert.equal(k.online, 2);
  assert.equal(k.rutas, 3);
  assert.equal(k.fichas, 4);
  assert.equal(k.encuestas, 1);
  assert.equal(k.buscan, 5);
  assert.equal(k.zonas, 2);
});

test('encuadre y detalle de una persona', () => {
  assert.equal(boundsOf([]), null);
  assert.deepEqual(boundsOf([[-74.1, 4.6], [-74.0, 4.7], [0, 0]]), [[-74.1, 4.6], [-74.0, 4.7]]);
  const since = windowSince('hoy', NOW);
  const tracks = routeTracks({ routes, livePoints, since, now: NOW });
  const people = panelPeople({ tinteros, tracks, since, now: NOW });
  const d = personDetail(people[0], tracks, NOW);
  assert.equal(d.statusLabel, 'En la calle');
  assert.equal(d.tracks.length, 1);
  assert.equal(d.tracks[0].live, true);
  assert.equal(d.coords.length, 4);
  assert.equal(personDetail(null, tracks), null);
});

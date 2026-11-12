import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { memorySource, DEMO_PATH } from './sources.js';
import { candidatas, clave, elegir, hayLectura, leer, parteAlgoritmo, responder, resumen } from './algoritmo.js';
import { OFICIOS } from './celestra.js';

const demo = async () => leer(memorySource(JSON.parse(await readFile(DEMO_PATH, 'utf8'))), new Date('2026-11-09T15:00:00Z'));

test('leer: trae las seis lecturas; lo que falla queda en null y en faltan', async () => {
  const l = await demo();
  assert.deepEqual(l.faltan, []);
  assert.ok(l.dia && l.encuestas && l.apartados && l.mapa && l.precio && l.fincas);
  const roto = await leer(memorySource({}));
  assert.equal(roto.faltan.length, 6);
  assert.equal(hayLectura(roto), false);
  assert.equal(hayLectura(l), true);
});

test('parte del algoritmo: 3 propuestas con la forma del parte, sin repetir meta y con cifras reales', async () => {
  const l = await demo();
  const p = parteAlgoritmo(l, { today: '2026-11-09' });
  assert.equal(p.propuestas.length, 3);
  assert.equal(new Set(p.metas).size, 3);
  for (const x of p.propuestas) {
    assert.ok(OFICIOS.includes(x.oficio));
    assert.ok(x.titulo.length <= 90 && x.por_que.length <= 260);
  }
  assert.match(p.resumen, /Hoy van 23 tazas/);
  assert.match(p.resumen, /sin IA/);
  // Lunes: la pieza del plan es la Receta del lunes
  assert.ok(candidatas(l, { today: '2026-11-09' }).some((c) => c.titulo === 'Publica la Receta del lunes'));
});

test('reglas: nadie en la calle pesa más; con menos de 3 no compara', () => {
  const l = {
    dia: { totales: { baristas: 1, en_la_calle: 0, tazas: 0, apartados_esperando: 0 }, baristas: [{ nombre: 'Ana', enlazado: true, en_la_calle: false }], semana: [] },
    apartados: { notas: [{ nombre: 'Ana', n: 2, nota: 1, pagado_n: 2, pagado_taza: 3000, pide_taza: 1000 }], tiempos: { n: 2, perdidos: 2, cancelados: 0, dias: 7, entregar_min: { n: 2, mediana: 40 } } },
  };
  const c = candidatas(l, { today: '2026-11-11' });
  assert.equal(c[0].id, 'calle-nadie');
  assert.ok(!c.some((x) => x.id.startsWith('nota-') || x.id.startsWith('precio-') || x.id.startsWith('apartados-')));
  // Sin Instagram: lo dice y propone conectarlo
  assert.ok(c.some((x) => x.id === 'datos-instagram'));
  assert.ok(!candidatas(l, { today: '2026-11-11', redes: { posts: 12, perWeek: 3, reach: 800 } }).some((x) => x.id === 'datos-instagram'));
});

test('memoria: lo descartado no vuelve en 14 días, lo aprobado sube, lo hecho descansa', () => {
  const cands = [
    { id: 'a', meta: 'ventas', oficio: 'calle', peso: 90, titulo: 'Saca a la calle a quien falta', por_que: 'x' },
    { id: 'b', meta: 'ventas', oficio: 'calle', peso: 80, titulo: 'Atiende 2 apartados que esperan', por_que: 'x' },
    { id: 'c', meta: 'redes', oficio: 'mercado', peso: 60, titulo: 'Publica el corto de hoy', por_que: 'x' },
    { id: 'd', meta: 'datos', oficio: 'estudio', peso: 50, titulo: 'Encuesta hoy en Kennedy', por_que: 'x' },
  ];
  assert.deepEqual(elegir(cands, { today: '2026-11-12' }).map((x) => x.id), ['a', 'c', 'd']);
  const mem = [{ dia: '2026-11-10', titulo: 'Saca a la calle a quien falta', estado: 'descartada' }];
  assert.deepEqual(elegir(cands, { today: '2026-11-12', decisions: mem }).map((x) => x.id), ['b', 'c', 'd']);
  // Pasados 14 días vuelve
  assert.equal(elegir(cands, { today: '2026-11-30', decisions: mem })[0].id, 'a');
  // Las cifras del título no cambian la clave
  assert.equal(clave('Atiende 2 apartados que esperan'), clave('Atiende 5 apartados que esperan'));
});

test('sin lecturas: igual propone desde el plan y lo dice; con la lectura guardada lo avisa', () => {
  const p = parteAlgoritmo({}, { today: '2026-11-13' });
  assert.equal(p.propuestas.length, 3);
  assert.match(p.resumen, /No se pudo leer Micra/);
  assert.match(resumen({ encuestas: { encuestas: 3, meta: 25 } }, { cached: true }), /última lectura guardada/);
});

test('responder: las cuatro preguntas de la tarjeta, y null para lo demás', async () => {
  const l = await demo();
  assert.match(responder('¿Cómo vamos hoy?', l).answer, /Hoy van 23 tazas/);
  assert.match(responder('¿Dónde voy a encuestar?', l).answer, /de 25 encuestas/);
  assert.match(responder('¿Cómo les va a los apartados?', l).answer, /14 apartados, 10 entregados/);
  assert.match(responder('¿Cómo está el precio del café?', l).answer, /Carga FNC: \$2\.850\.000 \(\+1,4 %\)/);
  assert.equal(responder('¿Qué opinas del clima?', l), null);
});

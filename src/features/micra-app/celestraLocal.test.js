import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CELESTRA_KEY, decideLocal, localEstado, saveLocalParte } from './celestraLocal.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};
const PARTE = { resumen: 'Hoy van 4 tazas.', propuestas: [{ oficio: 'estudio', titulo: 'Ir a Usaquén', por_que: 'Falta 1 encuesta (n=6).', accion: 'Ir a las 10' }, { oficio: 'calle', titulo: 'Salir temprano', por_que: 'x', accion: null }] };

test('sin nada guardado: sin parte y sin memoria', () => {
  const e = localEstado(mem(), '2026-11-11');
  assert.equal(e.parte, null);
  assert.deepEqual(e.decisiones, []);
  assert.equal(e.local, true);
  assert.equal(e.gastado_mes, null);
});

test('el parte se guarda con ids, pendiente, y solo vale el día que se escribió', () => {
  const s = mem();
  const e = saveLocalParte(s, '2026-11-11', PARTE);
  assert.equal(e.parte.propuestas[0].id, '2026-11-11-1');
  assert.equal(e.parte.propuestas[1].estado, 'pendiente');
  assert.equal(localEstado(s, '2026-11-12').parte, null);
});

test('decidir cambia la propuesta y entra a la memoria sin repetirse', () => {
  const s = mem();
  saveLocalParte(s, '2026-11-11', PARTE);
  decideLocal(s, '2026-11-11', '2026-11-11-1', 'aprobada');
  const e = decideLocal(s, '2026-11-11', '2026-11-11-1', 'descartada', 'ya fuimos');
  assert.equal(e.parte.propuestas[0].estado, 'descartada');
  assert.equal(e.decisiones.length, 1);
  assert.deepEqual(e.decisiones[0], { id: '2026-11-11-1', dia: '2026-11-11', titulo: 'Ir a Usaquén', estado: 'descartada', nota: 'ya fuimos' });
  // la memoria sigue al otro día
  assert.equal(localEstado(s, '2026-11-12').decisiones.length, 1);
});

test('un almacenamiento roto o bloqueado no rompe nada', () => {
  const s = { getItem: () => '{roto', setItem: () => { throw new Error('lleno'); } };
  assert.equal(localEstado(s, 'd').parte, null);
  assert.equal(saveLocalParte(s, 'd', PARTE).parte.propuestas.length, 2);
  assert.equal(CELESTRA_KEY, 'micra_celestra_v1');
});

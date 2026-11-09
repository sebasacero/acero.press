// Subir lo que quedó en el celular sin señal: primero las fichas (para que sus
// encuestas tengan a quién pegarse) y luego las encuestas. Lo que la API
// rechaza de verdad sale de la cola; todo lo demás se queda y se reintenta.
// Puro: la red llega como `postFicha` y `postSurvey`.

import { readQueue, dequeue } from './fichaFlow.js';
import { readSurveyQueue, unqueueSurvey, linkFicha, dropFicha, isRejected } from './surveyQueue.js';

/** Lo que espera en el celular. */
export function waiting(storage) {
  return { fichas: readQueue(storage).length, surveys: readSurveyQueue(storage).length };
}

/**
 * Sube las colas. Devuelve { fichas, surveys } subidas, `dropped` (rechazadas
 * por la API, con su motivo) y `left` (lo que sigue en el celular).
 */
export async function syncStudy({ storage, postFicha, postSurvey }) {
  const out = { fichas: 0, surveys: 0, dropped: [], left: { fichas: 0, surveys: 0 } };
  for (const item of readQueue(storage)) {
    try {
      const row = await postFicha(item.body); // eslint-disable-line no-await-in-loop
      dequeue(storage, item.ref);
      if (row?.id) linkFicha(storage, item.ref, row.id); else dropFicha(storage, item.ref);
      out.fichas += 1;
    } catch (e) {
      if (!isRejected(e)) break; // sin señal o sin sesión: las demás tampoco van a pasar
      dequeue(storage, item.ref);
      dropFicha(storage, item.ref);
      out.dropped.push({ kind: 'ficha', name: item.body?.name ?? null, why: String(e?.message || e) });
    }
  }
  for (const item of readSurveyQueue(storage)) {
    if (!item.tintero_id) continue; // su ficha sigue en cola
    try {
      await postSurvey(item.tintero_id, item.body); // eslint-disable-line no-await-in-loop
      unqueueSurvey(storage, item.ref);
      out.surveys += 1;
    } catch (e) {
      if (!isRejected(e)) break;
      unqueueSurvey(storage, item.ref);
      out.dropped.push({ kind: 'encuesta', name: item.name ?? null, why: String(e?.message || e) });
    }
  }
  out.left = waiting(storage);
  return out;
}

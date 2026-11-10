// La subida de las colas del estudio con la API de verdad. Una sola a la vez:
// Estudio, la ficha rápida y el aviso de «volvió la señal» la piden a la par.
import { biApi } from '../admin/micra/tinteroApi.js';
import { postSurvey } from '../admin/survey/surveyApi.js';
import { syncStudy } from './studySync.js';

let running = null;

export function syncNow() {
  if (!running) {
    running = syncStudy({ storage: localStorage, postFicha: (body) => biApi('/tinteros', { method: 'POST', body }), postSurvey })
      .finally(() => { running = null; });
  }
  return running;
}

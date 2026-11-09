import { useEffect, useRef, useState } from 'react';
import { Amount, Brand, Choice, Multi, SURVEY_STEPS } from '../admin/survey/SurveyForm.jsx';
import { EMPTY_SURVEY, buildSurvey } from '../admin/survey/survey.js';
import { postSurvey } from '../admin/survey/surveyApi.js';
import { newRef } from './micraApp.js';
import { surveyKey, readDraft, saveDraft, clearDraft, queueSurvey, isRejected } from './surveyQueue.js';

// La encuesta del estudio, una pregunta por pantalla y todas opcionales: se
// responde lo que la persona quiera y se guarda lo que haya en cualquier
// momento. Mismas preguntas y misma API que la encuesta del panel.
// En la calle no se pierde: cada respuesta queda como borrador en el celular
// (si entra una llamada o se recarga, sigue donde iba) y sin señal la encuesta
// queda en cola y sube sola, incluso la de una ficha que tampoco ha subido.

export default function SurveyWizard({ tintero, onSaved, onClose }) {
  const key = surveyKey(tintero);
  const draft = useRef(undefined);
  if (draft.current === undefined) draft.current = readDraft(localStorage, key);
  const [form, setForm] = useState(() => ({ ...EMPTY_SURVEY, ...(draft.current?.form ?? {}) }));
  // -1: el permiso. Un borrador con permiso vuelve a la pregunta donde iba
  const [i, setI] = useState(() => (draft.current?.form?.consent ? Math.max(0, Number(draft.current.i) || 0) : -1));
  const [resumed, setResumed] = useState(() => !!draft.current?.form?.consent);
  const saved = useRef(false);
  useEffect(() => { if (!saved.current) saveDraft(localStorage, key, { form, i }); }, [key, form, i]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => { setError(null); setForm((f) => ({ ...f, ...patch })); };
  const steps = SURVEY_STEPS.filter((s) => !s.when || s.when(form));
  const at = Math.min(i, steps.length - 1); // un borrador viejo no deja el paso fuera de la lista
  const step = steps[at] ?? null;
  const answered = steps.filter((s) => { const v = form[s.field]; return Array.isArray(v) ? v.length > 0 : v !== '' && v != null && v !== false; }).length;

  const save = async () => {
    const { body, error: e } = buildSurvey(form);
    if (e) { setError(e); return; }
    setBusy(true);
    setError(null);
    const finish = (queued) => { saved.current = true; clearDraft(localStorage, key); onSaved({ answered, queued }); };
    // Sin señal, sesión vencida o servidor caído: queda en el celular y sube sola
    const keep = () => {
      if (queueSurvey(localStorage, { ref: newRef('e'), tintero, body })) { finish(true); return true; }
      return false;
    };
    try {
      // La ficha tampoco ha subido: la encuesta la espera en el celular
      if (!tintero?.id) { if (!keep()) setError('El celular no dejó guardar la encuesta. Deja esta pantalla abierta y vuelve a intentar con señal.'); return; }
      await postSurvey(tintero.id, body);
      finish(false);
    } catch (err) {
      if (isRejected(err) || !keep()) setError(err.message);
    } finally { setBusy(false); }
  };
  // Vacío y sin permiso: el borrador se borra solo al guardarse así
  const discard = () => { setError(null); setForm({ ...EMPTY_SURVEY }); setI(-1); setResumed(false); };

  const props = { form, set };
  const field = step && (
    step.kind === 'choice' ? <Choice label={step.label} field={step.field} options={step.options} grid={step.grid} {...props} />
      : step.kind === 'multi' ? <Multi label={step.label} field={step.field} options={step.options} {...props} />
        : step.kind === 'brand' ? <Brand {...props} />
          : step.kind === 'notes' ? (
            <label className="msheet-group">
              <span className="msheet-label">{step.label}</span>
              <textarea className="msheet-input is-caption" rows={3} maxLength={500} placeholder="Lo que contó y no cabe arriba" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </label>
          )
            : <Amount label={step.label} field={step.field} presets={step.presets} fmt={step.fmt} placeholder={step.placeholder} inputMode={step.inputMode} {...props} />
  );

  return (
    <div className="mff-screen mff-survey" data-testid="survey-wizard" role="dialog" aria-label={`Encuesta${tintero?.name ? ` de ${tintero.name}` : ''}`}>
      <header className="mff-top">
        <button type="button" className="mff-back" onClick={() => (at < 0 ? onClose() : setI(at - 1))} aria-label="Atrás">‹</button>
        <span className="mff-step">{at < 0 ? 'Encuesta' : `${at + 1} de ${steps.length}`}{step?.section ? ` · ${step.section}` : ''}</span>
        <button type="button" className="mff-skip" onClick={onClose}>Cerrar</button>
      </header>
      {at >= 0 && <div className="srv-progress" aria-live="polite"><i style={{ '--p': `${Math.round(((at + 1) / steps.length) * 100)}%` }} /><span>{answered} respondidas</span></div>}
      {resumed && at >= 0 && (
        <p className="msheet-fine srv-resumed" role="status">
          Seguimos donde ibas: lo respondido estaba guardado en este celular.{' '}
          <button type="button" className="mapp-link" onClick={discard}>Empezar de cero</button>
        </p>
      )}

      <div className="mff-body">
        {at < 0 ? (
          <>
            <h2 className="mapp-title is-small">¿Tiene dos minutos?</h2>
            <p className="msheet-fine srv-say">Cuéntale{tintero?.name ? ` a ${tintero.name}` : ''}: «Es un estudio de ACERO.press sobre el café en la calle. Lo que respondas no se publica con tu nombre y puedes saltarte lo que quieras.»</p>
            <label className="msheet-switch is-sale">
              <input type="checkbox" checked={form.consent} onChange={(e) => set({ consent: e.target.checked })} />
              <span>Aceptó responder</span>
              <small>sin esto no se guarda</small>
            </label>
          </>
        ) : field}
        {error && <p className="msheet-notice is-err" role="alert">{error}</p>}
      </div>

      <footer className="mff-foot">
        {at < 0 ? (
          <button type="button" className="mapp-btn is-cta is-big" disabled={!form.consent} onClick={() => setI(0)}>Empezar</button>
        ) : at < steps.length - 1 ? (
          <>
            <button type="button" className="mapp-btn is-ghost" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar lo que hay'}</button>
            <button type="button" className="mapp-btn is-cta is-big" onClick={() => { setResumed(false); setI(at + 1); }}>Siguiente</button>
          </>
        ) : (
          <button type="button" className="mapp-btn is-cta is-big" onClick={save} disabled={busy}>{busy ? 'Guardando…' : `Guardar encuesta · ${answered} respuestas`}</button>
        )}
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { Amount, Brand, Choice, Multi, SURVEY_STEPS } from '../admin/survey/SurveyForm.jsx';
import { EMPTY_SURVEY, buildSurvey } from '../admin/survey/survey.js';
import { postSurvey } from '../admin/survey/surveyApi.js';

// La encuesta del estudio, una pregunta por pantalla y todas opcionales: se
// responde lo que la persona quiera y se guarda lo que haya en cualquier
// momento. Mismas preguntas y misma API que la encuesta del panel.

export default function SurveyWizard({ tintero, onSaved, onClose }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_SURVEY }));
  const [i, setI] = useState(-1); // -1: el permiso
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => { setError(null); setForm((f) => ({ ...f, ...patch })); };
  const steps = SURVEY_STEPS.filter((s) => !s.when || s.when(form));
  const step = steps[i] ?? null;
  const answered = steps.filter((s) => { const v = form[s.field]; return Array.isArray(v) ? v.length > 0 : v !== '' && v != null && v !== false; }).length;

  const save = async () => {
    const { body, error: e } = buildSurvey(form);
    if (e) { setError(e); return; }
    setBusy(true);
    setError(null);
    try {
      await postSurvey(tintero.id, body);
      onSaved({ answered });
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

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
    <div className="mff-screen mff-survey" data-testid="survey-wizard">
      <header className="mff-top">
        <button type="button" className="mff-back" onClick={() => (i < 0 ? onClose() : setI(i - 1))} aria-label="Atrás">‹</button>
        <span className="mff-step">{i < 0 ? 'Encuesta' : `${i + 1} de ${steps.length}`}{step?.section ? ` · ${step.section}` : ''}</span>
        <button type="button" className="mff-skip" onClick={onClose}>Cerrar</button>
      </header>
      {i >= 0 && <div className="srv-progress" aria-live="polite"><i style={{ '--p': `${Math.round(((i + 1) / steps.length) * 100)}%` }} /><span>{answered} respondidas</span></div>}

      <div className="mff-body">
        {i < 0 ? (
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
        {i < 0 ? (
          <button type="button" className="mapp-btn is-cta is-big" disabled={!form.consent} onClick={() => setI(0)}>Empezar</button>
        ) : i < steps.length - 1 ? (
          <>
            <button type="button" className="mapp-btn is-ghost" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar lo que hay'}</button>
            <button type="button" className="mapp-btn is-cta is-big" onClick={() => setI(i + 1)}>Siguiente</button>
          </>
        ) : (
          <button type="button" className="mapp-btn is-cta is-big" onClick={save} disabled={busy}>{busy ? 'Guardando…' : `Guardar encuesta · ${answered} respuestas`}</button>
        )}
      </footer>
    </div>
  );
}

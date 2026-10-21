import { useState } from 'react';
import Sheet from '../micra/Sheet.jsx';
import SurveyForm from './SurveyForm.jsx';
import { EMPTY_SURVEY, buildSurvey } from './survey.js';
import { postSurvey } from './surveyApi.js';
import '../micra/micra.css';

// La encuesta desde el panel (Piloto): para un tintero ya registrado, o para
// volver a encuestarlo y ver cómo cambia. La misma hoja oscura de Micra.
export default function SurveyDialog({ tintero, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_SURVEY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    const { body, error: e } = buildSurvey(form);
    if (e) { setError(e); return; }
    setBusy(true);
    setError(null);
    try {
      const row = await postSurvey(tintero.id, body);
      onSaved?.(row);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mstudio srv-modal">
      <Sheet
        title={`Encuesta · ${tintero.name}`}
        aside={<span className="msheet-total">2 min</span>}
        onClose={onClose}
        size="tall"
        label={`Encuesta de ${tintero.name}`}
        footer={(
          <>
            {error && <p className="msheet-notice is-err" role="alert">{error}</p>}
            <button type="button" className="msheet-btn is-primary is-big" disabled={busy || !form.consent} onClick={save}>{busy ? 'Guardando…' : 'Guardar encuesta'}</button>
          </>
        )}
      >
        <SurveyForm form={form} onChange={(f) => { setError(null); setForm(f); }} name={tintero.name} />
      </Sheet>
    </div>
  );
}

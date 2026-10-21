import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import Sheet from './Sheet.jsx';
import { ZONES, isValidPlace, placeLabel, placeOfZone, editPlace } from './place.js';
import { EMPTY_TINTERO, buildTintero, canUploadPhoto, photoPath } from './tinteroForm.js';
import SurveyForm from '../survey/SurveyForm.jsx';
import { EMPTY_SURVEY, buildSurvey } from '../survey/survey.js';
import { postSurvey } from '../survey/surveyApi.js';

// Ficha de campo de un tintero (estudio de calle), para levantar en dos
// minutos parado frente al puesto: foto con la misma cámara de Micra, dónde
// está, a cuánto vende el tinto y cuántas tazas por hora se le vieron. La
// foto va al bucket privado «estudio» y solo con permiso; la ficha entra por
// la API de BI (la misma que usa el panel), así que aplican el owner y RLS.
// Guardada la ficha, sigue la encuesta (dos minutos, con su permiso); se
// puede dejar para después y hacerla desde Piloto.

const BUCKET = 'estudio';

async function postTintero(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/v1/bi/tinteros', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(Array.isArray(detail) ? detail.map((d) => d.msg).join(' · ') : detail || 'La API de Acero no respondió.');
  }
  return data;
}

export default function TinteroSheet({ place, onPlace, photo, onTakePhoto, onClearPhoto, canShoot, docked, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_TINTERO, place }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null); // la ficha ya guardada: sigue la encuesta
  const [survey, setSurvey] = useState(EMPTY_SURVEY);
  const nameRef = useRef(null);
  const set = (patch) => { setError(null); setForm((f) => ({ ...f, ...patch })); };

  // El lugar de la venta y el de la ficha son el mismo mientras se está en la calle
  useEffect(() => { setForm((f) => ({ ...f, place })); }, [place]);
  const setPlace = (p) => { onPlace?.(p); set({ place: p }); };

  const save = async () => {
    const { body, error: e } = buildTintero(form);
    if (e) { setError(e); if (/nombre/.test(e)) nameRef.current?.focus(); return; }
    setBusy(true);
    try {
      if (canUploadPhoto(form, photo)) {
        const path = photoPath(body.name);
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, photo.file, { contentType: photo.file.type || 'image/jpeg' });
        if (upErr) throw new Error(`La foto no subió: ${upErr.message}`);
        // Bucket privado: se guarda la ruta como URL de referencia; el panel pide una firmada al verla
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        body.photo_url = data.publicUrl;
      }
      const row = await postTintero(body);
      setSaved({ ...row, hadPhoto: !!body.photo_url });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const finish = (surveyed) => onSaved?.({ ...saved, surveyed });

  const saveSurvey = async () => {
    const { body, error: e } = buildSurvey(survey);
    if (e) { setError(e); return; }
    setBusy(true);
    setError(null);
    try {
      await postSurvey(saved.id, body);
      finish(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <Sheet
        title="Encuesta"
        aside={<span className="msheet-total">2 min</span>}
        onClose={() => finish(false)}
        docked={docked}
        size="tall"
        label={`Encuesta de ${saved.name}`}
        footer={(
          <>
            {error && <p className="msheet-notice is-err" role="alert">{error}</p>}
            <button type="button" className="msheet-btn is-primary is-big" disabled={busy || !survey.consent} onClick={saveSurvey}>
              {busy ? 'Guardando…' : 'Guardar encuesta'}
            </button>
            <button type="button" className="msheet-btn is-ghost" disabled={busy} onClick={() => finish(false)}>Ahora no: la hago después desde Piloto</button>
          </>
        )}
      >
        <p className="msheet-notice is-ok" role="status">✓ La ficha de {saved.name} quedó guardada{saved.hadPhoto ? ' con su foto' : ''}.</p>
        <SurveyForm form={survey} onChange={(f) => { setError(null); setSurvey(f); }} name={saved.name} />
      </Sheet>
    );
  }

  const footer = (
    <>
      {error && <p className="msheet-notice is-err" role="alert">{error}</p>}
      <button type="button" className="msheet-btn is-primary is-big" disabled={busy} onClick={save}>
        {busy ? 'Guardando…' : 'Guardar tintero'}
      </button>
    </>
  );

  return (
    <Sheet title="Nuevo tintero" aside={<span className="msheet-total">Estudio</span>} onClose={onClose} docked={docked} size="tall" footer={footer} label="Ficha de un tintero">
      <div className="msheet-group" data-testid="tintero-photo">
        <span className="msheet-label">Foto del puesto</span>
        {photo ? (
          <div className="mtin-photo">
            <img src={photo.url} alt="Foto del puesto" />
            <button type="button" className="msheet-btn is-ghost" onClick={onClearPhoto}>Otra foto</button>
          </div>
        ) : (
          <button type="button" className="msheet-btn" disabled={!canShoot} onClick={onTakePhoto}>
            {canShoot ? 'Tomar foto' : 'La cámara no está disponible'}
          </button>
        )}
        <label className="msheet-switch">
          <input type="checkbox" checked={form.photo_consent} onChange={(e) => set({ photo_consent: e.target.checked })} />
          <span>Dio permiso para la foto</span>
          <small>sin permiso no sube</small>
        </label>
      </div>

      <label className="msheet-group">
        <span className="msheet-label">Nombre del puesto o de la persona</span>
        <input ref={nameRef} className="msheet-input" type="text" autoComplete="off" placeholder="Don Jairo · carrito calle 72" value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <div className="msheet-group" data-testid="tintero-place">
        <span className="msheet-label">Dónde está</span>
        <div className="msheet-chips" role="listbox" aria-label="Zona">
          {ZONES.map((z) => {
            const on = isValidPlace(form.place) && form.place.zone === z.id;
            return (
              <button key={z.id} type="button" role="option" aria-selected={on} className={`msheet-chip ${on ? 'on' : ''}`} onClick={() => setPlace(on ? null : placeOfZone(z))}>{z.id}</button>
            );
          })}
        </div>
        <div className="msheet-row is-place">
          <label className="msheet-place-field"><span>Calle</span>
            <input className="msheet-input" inputMode="decimal" autoComplete="off" placeholder="72" aria-label="Calle" value={form.place?.calle ?? ''} onChange={(e) => setPlace(editPlace(form.place, { calle: e.target.value }))} />
          </label>
          <span className="msheet-place-con" aria-hidden="true">con</span>
          <label className="msheet-place-field"><span>Carrera</span>
            <input className="msheet-input" inputMode="decimal" autoComplete="off" placeholder="13" aria-label="Carrera" value={form.place?.carrera ?? ''} onChange={(e) => setPlace(editPlace(form.place, { carrera: e.target.value }))} />
          </label>
        </div>
        <small className={`msheet-fine ${form.place?.error ? 'is-warn' : ''}`}>{form.place?.error ?? (isValidPlace(form.place) ? placeLabel(form.place) : 'La cuadra donde se para el puesto.')}</small>
      </div>

      <div className="msheet-row is-place">
        <label className="msheet-place-field"><span>Tinto a</span>
          <input className="msheet-input" inputMode="numeric" autoComplete="off" placeholder="1.500" aria-label="Precio del tinto" value={form.tinto_price} onChange={(e) => set({ tinto_price: e.target.value })} />
        </label>
        <label className="msheet-place-field"><span>Tazas por hora</span>
          <input className="msheet-input" inputMode="decimal" autoComplete="off" placeholder="25" aria-label="Tazas por hora" value={form.cups_per_hour} onChange={(e) => set({ cups_per_hour: e.target.value })} />
        </label>
      </div>
      <small className="msheet-fine">Lo que viste en el rato que estuviste: es la línea base del estudio.</small>

      <label className="msheet-group">
        <span className="msheet-label">Nota (opcional)</span>
        <textarea className="msheet-input is-caption" rows={2} maxLength={500} placeholder="Termo de 10 L, llega a las 6, se le acaba a las 10…" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </label>
    </Sheet>
  );
}

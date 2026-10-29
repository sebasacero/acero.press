import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { apiUrl } from '../../../shared/lib/apiBase.js';
import Sheet from './Sheet.jsx';
import { LOCALIDADES, LOCALIDAD_GROUPS, isValidPlace, placeLabel, editPlace } from './place.js';
import { EMPTY_TINTERO, END_HOURS, START_HOURS, TINTERO_OPTIONS, buildTintero, canUploadPhoto, fichaProgress, hourLabel, photoPath } from './tinteroForm.js';
import SurveyForm, { Choice, Multi } from '../survey/SurveyForm.jsx';
import { EMPTY_SURVEY, buildSurvey } from '../survey/survey.js';
import { postSurvey } from '../survey/surveyApi.js';
import { grantAdConsent } from './tinteroApi.js';
import { adTexts } from './tinteroAd.js';
import { gpsErrorText, gpsFix, gpsLabel, gpsMapUrl, gpsQuality } from './gps.js';

// Ficha de campo de un tintero (estudio de calle), para levantar en dos
// minutos parado frente al puesto: foto con la misma cámara de Micra, en qué
// localidad del estudio está, cómo vende (termos, carrito, ruta), a qué
// horas, qué vende y a cuánto, qué clientes tiene y cómo le pagan. La
// foto va al bucket privado «estudio» y solo con permiso; la ficha entra por
// la API de BI (la misma que usa el panel), así que aplican el owner y RLS.
// Guardada la ficha, sigue la encuesta (dos minutos, con su permiso); se
// puede dejar para después y completarla en Estudio. Al final, con su permiso de
// publicidad, se toma la foto de su tarjeta «Tintero aliado», llena con la ficha
// y la encuesta.

const BUCKET = 'estudio';

async function postTintero(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(apiUrl('/api/v1/bi/tinteros'), {
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

export default function TinteroSheet({ photo, onTakePhoto, onClearPhoto, canShoot, docked, onClose, onSaved, onMakeCard, canCard = true }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_TINTERO }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null); // la ficha ya guardada: sigue la encuesta
  const [survey, setSurvey] = useState(EMPTY_SURVEY);
  const [card, setCard] = useState(null); // después de la encuesta: { survey } con lo que sirve para su tarjeta
  const [adOk, setAdOk] = useState(false);
  const nameRef = useRef(null);
  const set = (patch) => { setError(null); setForm((f) => ({ ...f, ...patch })); };
  const progress = fichaProgress(form);

  // La cuadra de la ficha es solo de la ficha: antes se copiaba la de la última venta y
  // un tintero de Kennedy quedaba en el Parque 93
  const setPlace = (p) => set({ place: p });

  // GPS del celular: un toque marca dónde está el puesto
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const locate = () => {
    if (!navigator.geolocation) { setGpsError('Este celular no tiene GPS en el navegador.'); return; }
    setLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const fix = gpsFix(pos);
        if (fix.error) setGpsError(fix.error);
        else set({ gps: fix });
      },
      (err) => { setLocating(false); setGpsError(gpsErrorText(err)); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

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
      setCard({ survey: { years_selling: body.years_selling, years_here: body.years_here, days_per_week: body.days_per_week, payments: body.payments }, surveyed: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Tercer paso: la foto de su tarjeta, después de la encuesta (y solo con su permiso de publicidad)
  if (saved && card) {
    const consented = !!saved.ad_consent;
    const preview = adTexts(saved, card.survey);
    const shoot = async () => {
      setBusy(true);
      setError(null);
      try {
        const row = consented ? saved : { ...saved, ...(await grantAdConsent(saved.id)), ad_consent: true };
        onMakeCard?.({ ...row, survey: card.survey });
      } catch (err) {
        setError(`No se guardó el permiso: ${err.message}`);
      } finally {
        setBusy(false);
      }
    };
    return (
      <Sheet
        title="Su tarjeta"
        onClose={() => finish(card.surveyed)}
        docked={docked}
        label={`Tarjeta de ${saved.name}`}
        footer={(
          <>
            {error && <p className="msheet-notice is-err" role="alert">{error}</p>}
            <button type="button" className="msheet-btn is-primary is-big" disabled={busy || !onMakeCard || !canCard || !(consented || adOk)} onClick={shoot}>
              {busy ? 'Guardando…' : 'Tomar la foto de su tarjeta'}
            </button>
            <button type="button" className="msheet-btn is-ghost" disabled={busy} onClick={() => finish(card.surveyed)}>Listo, sin tarjeta</button>
          </>
        )}
      >
        <p className="msheet-notice is-ok" role="status">✓ {card.surveyed ? `La encuesta de ${saved.name} quedó guardada.` : `La ficha de ${saved.name} quedó guardada.`}</p>
        <p className="msheet-fine">Su tarjeta «Tintero aliado» sale con esto (todo se puede editar después):</p>
        <div className="tad-preview" data-testid="tintero-card-preview">
          <b>{preview.title}</b>
          <small>{preview.place}</small>
          <p>{preview.announce}</p>
        </div>
        {!consented && (
          <>
            <p className="msheet-fine srv-say">Pregúntale: «¿Podemos publicar tu nombre, dónde estás y lo que vendes en las redes de ACERO.press?»</p>
            <label className="msheet-switch">
              <input type="checkbox" checked={adOk} onChange={(e) => setAdOk(e.target.checked)} />
              <span>Aceptó salir en la publicidad</span>
              <small>sin esto no hay tarjeta</small>
            </label>
          </>
        )}
      </Sheet>
    );
  }

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
            <button type="button" className="msheet-btn is-ghost" disabled={busy} onClick={() => setCard({ survey: null, surveyed: false })}>Ahora no: queda pendiente en Estudio</button>
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
    <Sheet title="Nuevo tintero" aside={<span className="msheet-total" aria-label="Datos del estudio anotados">{progress.done} de {progress.total}</span>} onClose={onClose} docked={docked} size="tall" footer={footer} label="Ficha de un tintero">
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
      <label className="msheet-switch">
        <input type="checkbox" checked={form.ad_consent} onChange={(e) => set({ ad_consent: e.target.checked })} />
        <span>Aceptó salir en la publicidad</span>
        <small>su nombre, dónde está y lo que vende en las redes de ACERO.press</small>
      </label>

      <div className="msheet-group" data-testid="tintero-place">
        <span className="msheet-label" id="tin-localidad">Dónde está · localidad</span>
        {LOCALIDAD_GROUPS.map(([group, title]) => (
          <div key={group} className="mtin-locs">
            <small className="msheet-fine">{title}</small>
            <div className="msheet-chips" role="listbox" aria-label={`Localidad: ${title.toLowerCase()}`}>
              {LOCALIDADES.filter((l) => l.group === group).map((l) => {
                const on = form.localidad === l.id;
                return (
                  <button key={l.id} type="button" role="option" aria-selected={on} title={[l.note, l.ipes ? `${l.ipes.toLocaleString('es-CO')} vendedores en el IPES` : null].filter(Boolean).join(' · ') || undefined}
                    className={`msheet-chip ${on ? 'on' : ''}`} onClick={() => set({ localidad: on ? null : l.id })}>{l.id}</button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="msheet-chips" role="listbox" aria-label="Localidad: otra">
          <button type="button" role="option" aria-selected={form.localidad === 'Otra'} className={`msheet-chip ${form.localidad === 'Otra' ? 'on' : ''}`} onClick={() => set({ localidad: form.localidad === 'Otra' ? null : 'Otra' })}>Otra</button>
        </div>
        <span className="msheet-label">Dónde está exactamente</span>
        <button type="button" className={`msheet-btn ${form.gps ? 'is-ghost' : ''}`} disabled={locating} onClick={locate}>
          {locating ? 'Buscando la señal del GPS…' : form.gps ? 'Marcar de nuevo' : '📍 Usar mi ubicación'}
        </button>
        {form.gps && (
          <p className={`msheet-fine ${gpsQuality(form.gps.accuracy) === 'debil' ? 'is-warn' : ''}`} role="status" data-testid="tintero-gps">
            ✓ {gpsLabel(form.gps)}
            {gpsQuality(form.gps.accuracy) === 'debil' && ' · señal débil: espera unos segundos y marca de nuevo'}
            {' · '}<a href={gpsMapUrl(form.gps)} target="_blank" rel="noreferrer">Ver en el mapa</a>
          </p>
        )}
        {gpsError && <p className="msheet-fine is-warn" role="alert">{gpsError}</p>}
        <label className="msheet-place-field is-wide"><span>Referencia</span>
          <input className="msheet-input" type="text" autoComplete="off" maxLength={80} placeholder="Puerta principal de Plaza de las Américas" aria-label="Referencia" value={form.referencia} onChange={(e) => set({ referencia: e.target.value })} />
        </label>
        <details className="mtin-cuadra">
        <summary>Sé la cuadra (opcional)</summary>
        <div className="msheet-row is-place">
          <label className="msheet-place-field"><span>Calle</span>
            <input className="msheet-input" inputMode="decimal" autoComplete="off" placeholder="72" aria-label="Calle" value={form.place?.calle ?? ''} onChange={(e) => setPlace(editPlace(form.place, { calle: e.target.value }))} />
          </label>
          <span className="msheet-place-con" aria-hidden="true">con</span>
          <label className="msheet-place-field"><span>Carrera</span>
            <input className="msheet-input" inputMode="decimal" autoComplete="off" placeholder="13" aria-label="Carrera" value={form.place?.carrera ?? ''} onChange={(e) => setPlace(editPlace(form.place, { carrera: e.target.value }))} />
          </label>
        </div>
        <small className={`msheet-fine ${form.place?.error ? 'is-warn' : ''}`}>{form.place?.error ?? (isValidPlace(form.place) ? placeLabel(form.place) : 'Solo si es una avenida o calle principal que conozcas.')}</small>
        </details>
      </div>

      <Choice label="Cómo vende" field="formato" options={TINTERO_OPTIONS.formato} form={form} set={set} />
      <Choice label="¿Se mueve?" field="recorrido" options={TINTERO_OPTIONS.recorrido} form={form} set={set} />
      <Choice label="Empieza a vender" field="hora_inicio" options={START_HOURS.map((h) => [h, hourLabel(h)])} form={form} set={set} />
      <Choice label="Termina" field="hora_fin" options={END_HOURS.map((h) => [h, hourLabel(h)])} form={form} set={set} />

      <Multi label="Qué vende" field="products" options={TINTERO_OPTIONS.products} form={form} set={set} />
      <div className="msheet-row is-place">
        <label className="msheet-place-field"><span>Tinto a</span>
          <input className="msheet-input" inputMode="numeric" autoComplete="off" placeholder="1.500" aria-label="Precio del tinto" value={form.tinto_price} onChange={(e) => set({ tinto_price: e.target.value })} />
        </label>
        <label className="msheet-place-field"><span>Perico a</span>
          <input className="msheet-input" inputMode="numeric" autoComplete="off" placeholder="1.700" aria-label="Precio del perico" value={form.perico_price} onChange={(e) => set({ perico_price: e.target.value })} />
        </label>
        <label className="msheet-place-field"><span>Aromática a</span>
          <input className="msheet-input" inputMode="numeric" autoComplete="off" placeholder="1.200" aria-label="Precio de la aromática" value={form.aromatica_price} onChange={(e) => set({ aromatica_price: e.target.value })} />
        </label>
      </div>
      <div className="msheet-row is-place">
        <label className="msheet-place-field"><span>Termos</span>
          <input className="msheet-input" inputMode="numeric" autoComplete="off" placeholder="3" aria-label="Termos" value={form.termos} onChange={(e) => set({ termos: e.target.value })} />
        </label>
        <label className="msheet-place-field"><span>Tazas por hora</span>
          <input className="msheet-input" inputMode="decimal" autoComplete="off" placeholder="25" aria-label="Tazas por hora" value={form.cups_per_hour} onChange={(e) => set({ cups_per_hour: e.target.value })} />
        </label>
      </div>
      <small className="msheet-fine">Tazas por hora: las que viste en el rato que estuviste. Es la línea base del estudio.</small>

      <Choice label="Sus clientes" field="client_mix" options={TINTERO_OPTIONS.client_mix} form={form} set={set} />
      <Multi label="Quiénes le compran" field="client_types" options={TINTERO_OPTIONS.client_types} form={form} set={set} />
      <Multi label="Cómo le pagan" field="payments_seen" options={TINTERO_OPTIONS.payments_seen} form={form} set={set} />
      <Choice label="¿Registrado en el IPES?" field="ipes" options={TINTERO_OPTIONS.ipes} form={form} set={set} />

      <label className="msheet-group">
        <span className="msheet-label">Nota (opcional)</span>
        <textarea className="msheet-input is-caption" rows={2} maxLength={500} placeholder="Termo de 10 L, llega a las 6, se le acaba a las 10…" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </label>
    </Sheet>
  );
}

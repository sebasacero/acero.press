import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { biApi } from '../admin/micra/tinteroApi.js';
import { photoPath, TINTERO_OPTIONS, START_HOURS, END_HOURS, hourLabel } from '../admin/micra/tinteroForm.js';
import { LOCALIDADES, LOCALIDAD_GROUPS } from '../admin/micra/place.js';
import { Choice, Multi } from '../admin/survey/SurveyForm.jsx';
import { newRef } from './micraApp.js';
import { EMPTY_FICHA, EXTRAS, quickBody, gpsFields, gpsBadge, savedSummary, enqueue, dequeue, readQueue, isOffline } from './fichaFlow.js';
import platform from './platform.js';
import Viewfinder from './Viewfinder.jsx';

// La ficha rápida del estudio de calle, en la app del equipo (/micra/ficha).
// Primero mapear: la cámara a pantalla completa, el GPS se lee solo mientras
// encuadras, y con un toque la persona queda en el mapa. Después, si hay
// tiempo y ganas, lo opcional: encuesta, video con filtro, su tarjeta, ticket.
// Sin señal, la ficha se guarda en el celular y sube cuando vuelva la red.

const SurveyWizard = lazy(() => import('./SurveyWizard.jsx'));
const RouteCapture = lazy(() => import('./RouteCapture.jsx'));
const BUCKET = 'estudio';
const HANDOFF_KEY = 'micra_handoff_v1';

/** Lo que la cámara de Micra (MicraStudio) recibe al abrirse desde aquí: para quién y para qué. */
export function handoff(tintero, mode) {
  try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ tintero, mode })); } catch { /* sin memoria */ }
}

async function uploadPhoto(photo, name) {
  const path = photoPath(name);
  const { error } = await supabase.storage.from(BUCKET).upload(path, photo.file, { contentType: photo.file.type || 'image/jpeg' });
  if (error) throw new Error(`La foto no subió: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Sube lo que quedó en cola sin señal (sin foto: esa se perdió al cerrar la app). */
export async function flushQueue() {
  let sent = 0;
  for (const item of readQueue(localStorage)) {
    try { await biApi('/tinteros', { method: 'POST', body: item.body }); dequeue(localStorage, item.ref); sent += 1; } catch (e) { if (!isOffline(e)) dequeue(localStorage, item.ref); } // eslint-disable-line no-await-in-loop
  }
  return sent;
}

function Top({ onBack, step, right }) {
  return (
    <header className="mff-top">
      <button type="button" className="mff-back" onClick={onBack} aria-label="Atrás">‹</button>
      <span className="mff-step">{step}</span>
      {right ?? <span />}
    </header>
  );
}

export default function FichaFlow({ go }) {
  const [screen, setScreen] = useState('foto'); // foto | quien | detalle | extras | encuesta
  const [photo, setPhoto] = useState(null); // { file, url }
  const [form, setForm] = useState(() => ({ ...EMPTY_FICHA }));
  const [gps, setGps] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState(null); // la ficha en la API (o en cola): { id?, name, queued, summary }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState({}); // extras hechos: { encuesta: 7 }
  const nameRef = useRef(null);
  const set = (patch) => { setError(null); setForm((f) => ({ ...f, ...patch })); };

  // El GPS se lee mientras se encuadra, y se vuelve a leer si salió flojo
  const locate = async () => {
    setSearching(true);
    const fix = gpsFields(await platform.position(15000, true));
    setGps((cur) => (fix.error && cur && !cur.error ? cur : fix));
    setSearching(false);
  };
  useEffect(() => { locate(); flushQueue().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (screen === 'quien') setTimeout(() => nameRef.current?.focus(), 350); }, [screen]);

  const reset = () => {
    if (photo?.url) URL.revokeObjectURL(photo.url);
    setPhoto(null); setForm({ ...EMPTY_FICHA }); setSaved(null); setDone({}); setError(null); setScreen('foto');
    locate();
  };

  const save = async () => {
    const { body, error: e } = quickBody(form, gps);
    if (e) { setError(e); return; }
    setBusy(true);
    setError(null);
    const ref = newRef('f');
    let uploaded = false;
    try {
      if (photo && form.photo_consent) {
        try { body.photo_url = await uploadPhoto(photo, body.name); uploaded = true; } catch (err) { if (!isOffline(err)) throw err; }
      }
      const row = await biApi('/tinteros', { method: 'POST', body });
      setSaved({ ...row, queued: false, summary: savedSummary(body, { photo: !!photo, uploaded }) });
      setScreen('extras');
    } catch (err) {
      if (isOffline(err)) {
        enqueue(localStorage, { ref, body });
        setSaved({ id: null, name: body.name, queued: true, summary: ['Sin señal: la ficha quedó guardada en el celular y sube sola', ...savedSummary(body, { photo: !!photo, uploaded })] });
        setScreen('extras');
      } else setError(err.message);
    } finally { setBusy(false); }
  };

  const badge = gpsBadge(gps, searching);
  const openCamera = (mode) => { handoff(saved, mode); go('/micra/camara'); };
  const canCard = !!saved?.id && !!form.ad_consent;

  if (screen === 'foto') {
    return (
      <div className="mff" data-screen="foto">
        <Viewfinder onShot={(p) => { setPhoto(p); setScreen('quien'); }}>
          <header className="mff-top is-over">
            <button type="button" className="mff-back" onClick={() => go('/micra/estudio')} aria-label="Cerrar">×</button>
            <span className="mff-step">Foto del puesto</span>
            <button type="button" className={`mff-gps is-${badge.tone}`} onClick={locate} disabled={searching} aria-live="polite">{badge.text}</button>
          </header>
          <button type="button" className="mff-skip is-over" onClick={() => setScreen('quien')}>Sin foto ›</button>
        </Viewfinder>
      </div>
    );
  }

  if (screen === 'quien' || screen === 'detalle') {
    const detalle = screen === 'detalle';
    return (
      <div className="mff mff-screen" data-screen={screen}>
        <Top onBack={() => setScreen(detalle ? 'quien' : 'foto')} step={detalle ? 'Más datos · opcional' : 'Quién · todo opcional'} right={<button type="button" className={`mff-gps is-${badge.tone}`} onClick={locate} disabled={searching}>{badge.text}</button>} />
        <div className="mff-body">
          {!detalle && (
            <>
              <div className="mff-photo-row">
                {photo ? <img className="mff-thumb" src={photo.url} alt="Foto del puesto" /> : <button type="button" className="mff-thumb is-empty" onClick={() => setScreen('foto')}>Sin foto · tomar</button>}
                <div className="mff-switches">
                  {photo && (
                    <label className="msheet-switch">
                      <input type="checkbox" checked={form.photo_consent} onChange={(e) => set({ photo_consent: e.target.checked })} />
                      <span>Dio permiso para la foto</span><small>sin permiso no sube</small>
                    </label>
                  )}
                  <label className="msheet-switch">
                    <input type="checkbox" checked={form.ad_consent} onChange={(e) => set({ ad_consent: e.target.checked })} />
                    <span>Acepta salir en la publicidad</span><small>para su tarjeta y los videos</small>
                  </label>
                </div>
              </div>
              <label className="msheet-group">
                <span className="msheet-label">Nombre del puesto o de la persona</span>
                <input ref={nameRef} className="msheet-input is-big" type="text" autoComplete="off" placeholder="Opcional · Don Jairo" value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label className="msheet-group">
                <span className="msheet-label">Referencia del lugar</span>
                <input className="msheet-input" type="text" autoComplete="off" maxLength={80} placeholder="Opcional · frente a la panadería" value={form.referencia} onChange={(e) => set({ referencia: e.target.value })} />
              </label>
              <label className="msheet-group">
                <span className="msheet-label">WhatsApp</span>
                <input className="msheet-input" type="tel" inputMode="tel" autoComplete="off" placeholder="Opcional · 300 123 4567" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </label>
              {gps?.error && <p className="msheet-fine is-warn" role="status">{gps.error} Se puede marcar después en Estudio.</p>}
              <button type="button" className="mapp-link" onClick={() => setScreen('detalle')}>Más datos: localidad, cómo vende, precios ›</button>
            </>
          )}
          {detalle && (
            <>
              <div className="msheet-group">
                <span className="msheet-label">Localidad</span>
                {LOCALIDAD_GROUPS.map(([group, title]) => (
                  <div key={group} className="mtin-locs">
                    <small className="msheet-fine">{title}</small>
                    <div className="msheet-chips" role="listbox" aria-label={`Localidad: ${title.toLowerCase()}`}>
                      {LOCALIDADES.filter((l) => l.group === group).map((l) => (
                        <button key={l.id} type="button" role="option" aria-selected={form.localidad === l.id} className={`msheet-chip ${form.localidad === l.id ? 'on' : ''}`} onClick={() => set({ localidad: form.localidad === l.id ? null : l.id })}>{l.id}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Choice label="Cómo vende" field="formato" options={TINTERO_OPTIONS.formato} form={form} set={set} />
              <Choice label="¿Se mueve?" field="recorrido" options={TINTERO_OPTIONS.recorrido} form={form} set={set} />
              <Multi label="Qué vende" field="products" options={TINTERO_OPTIONS.products} form={form} set={set} />
              <div className="msheet-row is-place">
                {[['tinto_price', 'Tinto a', '1.500'], ['perico_price', 'Perico a', '1.700'], ['aromatica_price', 'Aromática a', '1.200']].map(([k, label, ph]) => (
                  <label key={k} className="msheet-place-field"><span>{label}</span>
                    <input className="msheet-input" inputMode="numeric" autoComplete="off" placeholder={ph} aria-label={label} value={form[k]} onChange={(e) => set({ [k]: e.target.value })} />
                  </label>
                ))}
              </div>
              <Choice label="Empieza" field="hora_inicio" options={START_HOURS.map((h) => [h, hourLabel(h)])} form={form} set={set} />
              <Choice label="Termina" field="hora_fin" options={END_HOURS.map((h) => [h, hourLabel(h)])} form={form} set={set} />
              <label className="msheet-place-field"><span>Termos</span>
                <input className="msheet-input" inputMode="numeric" autoComplete="off" placeholder="3" aria-label="Termos" value={form.termos} onChange={(e) => set({ termos: e.target.value })} />
              </label>
              <label className="msheet-group">
                <span className="msheet-label">Nota</span>
                <textarea className="msheet-input is-caption" rows={2} maxLength={500} placeholder="Termo de 10 L, llega a las 6…" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
              </label>
            </>
          )}
          {error && <p className="msheet-notice is-err" role="alert">{error}</p>}
        </div>
        <footer className="mff-foot">
          <button type="button" className="mapp-btn is-cta is-big" disabled={busy} onClick={save} data-testid="ficha-save">
            {busy ? 'Guardando…' : '📍 Poner en el mapa'}
          </button>
        </footer>
      </div>
    );
  }

  if (screen === 'recorrido') {
    return (
      <div className="mff">
        <Suspense fallback={null}>
          <RouteCapture tintero={saved} start={gps && !gps.error ? gps : null} onClose={() => setScreen('extras')}
            onSaved={({ distance }) => { setDone((d) => ({ ...d, recorrido: distance })); setScreen('extras'); }} />
        </Suspense>
      </div>
    );
  }

  if (screen === 'encuesta') {
    return (
      <div className="mff">
        <Suspense fallback={null}>
          <SurveyWizard tintero={saved} onClose={() => setScreen('extras')} onSaved={({ answered }) => { setDone((d) => ({ ...d, encuesta: answered })); setScreen('extras'); }} />
        </Suspense>
      </div>
    );
  }

  // extras: quedó en el mapa; lo demás, si da el tiempo
  return (
    <div className="mff mff-screen" data-screen="extras">
      <Top onBack={() => go('/micra/estudio')} step="En el mapa" />
      <div className="mff-body">
        <p className="msheet-notice is-ok" role="status">✓ {saved.name}</p>
        <ul className="mff-summary">{saved.summary.map((s) => <li key={s}>{s}</li>)}</ul>
        <p className="mapp-cota">Si hay tiempo y ganas</p>
        <div className="mff-extras">
          {EXTRAS.map((x) => {
            const did = done[x.id];
            const blocked = x.needsConsent && !canCard;
            const run = x.id === 'encuesta' ? () => setScreen('encuesta') : x.id === 'recorrido' ? () => setScreen('recorrido') : x.id === 'ticket' ? () => openCamera('sale') : () => openCamera(x.id === 'video' ? 'video' : 'photo');
            return (
              <button key={x.id} type="button" className={`mff-extra ${did ? 'is-done' : ''}`} disabled={(!saved.id && x.id !== 'ticket') || blocked} onClick={run} data-testid={`extra-${x.id}`}>
                <b>{did ? '✓ ' : ''}{x.label}</b>
                <small>{blocked ? (saved.id ? 'necesita su permiso de publicidad' : 'cuando suba la ficha') : did ? (x.id === 'encuesta' ? `${did} respuestas` : x.id === 'recorrido' ? `${(did / 1000).toFixed(1).replace('.', ',')} km` : 'hecho') : x.sub}</small>
              </button>
            );
          })}
        </div>
      </div>
      <footer className="mff-foot">
        <button type="button" className="mapp-btn is-ghost" onClick={() => go('/micra/estudio')}>Listo</button>
        <button type="button" className="mapp-btn is-cta is-big" onClick={reset} data-testid="ficha-new">Siguiente persona</button>
      </footer>
    </div>
  );
}

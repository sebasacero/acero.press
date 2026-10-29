import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { apiUrl } from '../../shared/lib/apiBase.js';
import { biApi } from '../admin/micra/tinteroApi.js';
import { photoPath } from '../admin/micra/tinteroForm.js';
import { studyRows, studyCounts, whereLine, gpsPatch, PENDING_LABEL } from './study.js';
import platform from './platform.js';
import { Cargando } from './Animado.jsx';

// Estudio de calle en la app (modo equipo): lo mismo que «Tintero» en la cámara
// de Micra y la pestaña Estudio del panel, para hacerlo parado en la calle.
// «Registrar un barista» abre la cámara con la ficha (foto, GPS, encuesta y su
// tarjeta); aquí se ve cada ficha y se completa lo que quedó pendiente: la
// encuesta, el punto de GPS o la foto del puesto. Mismas tablas y misma API.

const SurveyDialog = lazy(() => import('../admin/survey/SurveyDialog.jsx'));
const StudyHeatMap = lazy(() => import('./StudyHeatMap.jsx'));
const BUCKET = 'estudio';
const shortDate = (iso) => new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' });

async function loadStudy() {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(apiUrl('/api/v1/bi/piloto?days=90'), { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || 'La API de Acero no respondió.');
  return data;
}

// Bucket privado: se guarda la URL «pública» como referencia y se pide una firmada para verla
const signed = new Map();
function Thumb({ url, name }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    const path = (url || '').split(`/${BUCKET}/`)[1];
    if (!path) return undefined;
    let alive = true;
    if (!signed.has(path)) signed.set(path, supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => data?.signedUrl ?? null));
    signed.get(path).then((u) => { if (alive && u) setSrc(u); });
    return () => { alive = false; };
  }, [url]);
  if (!url) return <span className="mapp-study-thumb is-empty" aria-hidden="true">Sin foto</span>;
  return src ? <img className="mapp-study-thumb" src={src} alt={`Puesto de ${name}`} loading="lazy" /> : <span className="mapp-study-thumb is-empty" aria-hidden="true" />;
}

/** Completar una ficha en la calle: foto del puesto (con su permiso) y el punto de GPS. */
function Complete({ row, onDone }) {
  const [busy, setBusy] = useState(null); // 'gps' | 'foto'
  const [error, setError] = useState(null);
  const [consent, setConsent] = useState(false);
  const [here, setHere] = useState(false);
  const file = useRef(null);
  const needsGps = row.pending.includes('gps');

  const point = async () => {
    const pos = await platform.position(15000, true);
    return gpsPatch(pos);
  };

  const markGps = async () => {
    setBusy('gps');
    setError(null);
    try {
      const fix = await point();
      if (fix.error) throw new Error(fix.error);
      await biApi(`/tinteros/${encodeURIComponent(row.id)}`, { method: 'PATCH', body: fix });
      onDone(`Punto de ${row.name} marcado${fix.gps_accuracy_m != null ? ` · ±${fix.gps_accuracy_m} m` : ''}.`);
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  const upload = async (picked) => {
    if (!picked) return;
    setBusy('foto');
    setError(null);
    try {
      const path = photoPath(row.name);
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, picked, { contentType: picked.type || 'image/jpeg' });
      if (upErr) throw new Error(`La foto no subió: ${upErr.message}`);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const body = { photo_url: data.publicUrl, photo_consent: true };
      // La foto se toma frente al puesto: si la ficha no tenía punto, va con el del celular
      let gpsNote = '';
      if (needsGps) {
        const fix = await point();
        if (!fix.error) { Object.assign(body, fix); gpsNote = ' y su punto de GPS'; }
      }
      await biApi(`/tinteros/${encodeURIComponent(row.id)}`, { method: 'PATCH', body });
      onDone(`Foto de ${row.name} guardada${gpsNote}.`);
    } catch (e) { setError(e.message); } finally { setBusy(null); if (file.current) file.current.value = ''; }
  };

  return (
    <div className="mapp-study-fix">
      {row.pending.includes('foto') && (
        <div>
          <label className="mapp-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Dio permiso para la foto</span>
          </label>
          <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files?.[0])} data-testid="study-photo-input" />
          <button type="button" className="mapp-btn is-small" disabled={!consent || !!busy} onClick={() => file.current?.click()}>
            {busy === 'foto' ? 'Subiendo…' : needsGps ? 'Tomar foto con GPS' : 'Tomar foto del puesto'}
          </button>
        </div>
      )}
      {needsGps && (
        <div>
          <label className="mapp-check">
            <input type="checkbox" checked={here} onChange={(e) => setHere(e.target.checked)} />
            <span>Estoy frente a su puesto</span>
          </label>
          <button type="button" className="mapp-btn is-small is-stop" disabled={!here || !!busy} onClick={markGps}>
            {busy === 'gps' ? 'Leyendo el GPS…' : '📍 Marcar su punto aquí'}
          </button>
        </div>
      )}
      {error && <p className="mapp-error" role="alert">{error}</p>}
    </div>
  );
}

export default function StudyView({ go }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // la ficha que se está completando
  const [surveying, setSurveying] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    loadStudy().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const done = (text) => { setNotice(`✓ ${text}`); setOpen(null); load(); };

  if (error && !data) return <p className="mapp-error" role="alert">No se pudo leer el estudio: {error}</p>;
  if (!data) return <Cargando fig="caminando">Leyendo el estudio…</Cargando>;

  const rows = studyRows(data.tinteros, data.surveys);
  const n = studyCounts(rows);
  const surveysReady = data.surveysReady !== false;

  return (
    <div className="mapp-study">
      <section className="mapp-hello">
        <p className="mapp-kicker">Equipo · estudio de calle</p>
        <h1 className="mapp-title is-small">Baristas en la calle</h1>
        <p className="mapp-muted">Frente al puesto: foto, punto de GPS, ficha y encuesta en dos minutos. Todo llega al mismo estudio del panel.</p>
      </section>

      <button type="button" className="mapp-btn is-cta is-big" onClick={() => go('/micra/ficha')}>Registrar un barista</button>
      <button type="button" className="mapp-btn is-ghost" onClick={() => go('/micra/camara')}>Cámara con filtros</button>

      {notice && <p className="mapp-notice" role="status">{notice}</p>}
      {error && <p className="mapp-error" role="alert">{error}</p>}

      <dl className="mapp-kpis">
        <div><dt>Fichas</dt><dd data-testid="study-total">{n.total}</dd></div>
        <div><dt>Con encuesta</dt><dd>{n.encuesta}<small> de {n.total}</small></dd></div>
        <div><dt>Con GPS</dt><dd>{n.gps}<small> de {n.total}</small></dd></div>
        <div><dt>Con foto</dt><dd>{n.foto}<small> de {n.total}</small></dd></div>
      </dl>

      <Suspense fallback={null}><StudyHeatMap rows={rows} routes={data.routes ?? []} /></Suspense>

      <section className="mapp-glass">
        <p className="mapp-cota">Fichas · {n.total - n.done} con algo pendiente</p>
        {rows.length === 0 ? (
          <p className="mapp-muted">Aún no hay fichas. Toca «Registrar un barista» frente a su puesto.</p>
        ) : (
          <ul className="mapp-team mapp-study-list" aria-label="Fichas del estudio">
            {rows.map((r) => (
              <li key={r.id}>
                <div className="mapp-study-row">
                  <Thumb url={r.photo_consent ? r.photo_url : null} name={r.name} />
                  <div>
                    <b>{r.name}</b>
                    <span className="mapp-muted">{whereLine(r)}</span>
                    <span className="mapp-study-tags">
                      {r.pending.length === 0 && <span className="mapp-badge is-live">Completa</span>}
                      {r.pending.map((p) => <span key={p} className="mapp-badge is-usual">{PENDING_LABEL[p]}</span>)}
                      {r.survey && <span className="mapp-todo">Encuesta del {shortDate(r.survey.surveyed_at)}</span>}
                    </span>
                  </div>
                </div>
                <span className="mapp-row-btns">
                  {surveysReady && (
                    <button type="button" className="mapp-link" onClick={() => { setNotice(null); setSurveying(r); }}>
                      {r.survey ? 'Volver a encuestar' : 'Hacer encuesta'}
                    </button>
                  )}
                  {(r.pending.includes('gps') || r.pending.includes('foto')) && (
                    <button type="button" className="mapp-link" aria-expanded={open === r.id} onClick={() => { setNotice(null); setOpen(open === r.id ? null : r.id); }}>
                      {open === r.id ? 'Cerrar' : 'Completar foto y GPS'}
                    </button>
                  )}
                </span>
                {open === r.id && <Complete row={r} onDone={done} />}
              </li>
            ))}
          </ul>
        )}
      </section>
      <a className="mapp-link" href={platform.siteUrl('/admin')}>Ver el mapa y el informe en el panel</a>

      {surveying && (
        <Suspense fallback={null}>
          <SurveyDialog
            tintero={surveying}
            onClose={() => setSurveying(null)}
            onSaved={() => { const name = surveying.name; setSurveying(null); done(`Encuesta de ${name} guardada.`); }}
          />
        </Suspense>
      )}
    </div>
  );
}

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { apiUrl } from '../../shared/lib/apiBase.js';
import { biApi } from '../admin/micra/tinteroApi.js';
import { photoPath } from '../admin/micra/tinteroForm.js';
import { studyRows, studyCounts, whereLine, gpsPatch, PENDING_LABEL } from './study.js';
import platform from './platform.js';
import { postPoints, addSighting, sightings as listSightings } from './api.js';
import { newRef } from './micraApp.js';
import { EMPTY_FICHA, quickBody, enqueue, isOffline } from './fichaFlow.js';
import { SPOT_KINDS, readSightingQueue, queueSighting, unqueueSighting, sightingFrom, sightingCounts } from './avistar.js';
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

/**
 * El botón de GPS: al pasar y ver un puesto o a alguien tomando tinto, un toque lee el punto y
 * otro dice qué era. El puesto queda como ficha sin nombre; el avistamiento, solo punto y hora.
 */
function SpotButton({ onDone }) {
  const [pos, setPos] = useState(null); // la lectura (o la promesa) mientras se elige
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const start = () => {
    setError(null);
    // El GPS empieza a leer de una vez: mientras se elige qué era, ya está buscando
    setPos(platform.position(15000, true));
  };
  const mark = async (kind) => {
    setBusy(true);
    setError(null);
    try {
      const fix = await pos;
      const gps = gpsPatch(fix);
      if (gps.error) throw new Error(gps.error);
      const acc = gps.gps_accuracy_m != null ? ` · ±${gps.gps_accuracy_m} m` : '';
      if (kind === 'puesto') {
        const { body } = quickBody({ ...EMPTY_FICHA, notes: 'Marcado al pasar' }, gps);
        try {
          await biApi('/tinteros', { method: 'POST', body });
          onDone(`Puesto marcado${acc}. Complétalo en la lista cuando puedas.`, true);
        } catch (e) {
          if (!isOffline(e)) throw e;
          enqueue(localStorage, { ref: newRef('f'), body });
          onDone(`Sin señal: el puesto quedó en el celular y sube solo${acc}.`, false);
        }
      } else {
        const item = sightingFrom(fix, newRef('av'));
        try {
          await addSighting(item);
          onDone(`Alguien tomando tinto, marcado${acc}.`, true);
        } catch (e) {
          if (!e.missing && !isOffline(e)) throw e;
          queueSighting(localStorage, item);
          onDone(`Marcado en el celular${acc}: sube cuando haya señal.`, true);
        }
      }
      setPos(null);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <section className="mapp-spot" aria-label="Marcar al pasar">
      {!pos ? (
        <button type="button" className="mapp-spot-btn" onClick={start} data-testid="spot-btn">
          <span aria-hidden="true">📍</span>
          <b>Marcar aquí</b>
          <small>Un puesto o alguien tomando tinto</small>
        </button>
      ) : (
        <div className="mapp-spot-pick" role="group" aria-label="¿Qué viste?">
          <p className="mapp-cota">¿Qué viste? · leyendo el GPS</p>
          {SPOT_KINDS.map((k) => (
            <button key={k.id} type="button" className={`mapp-spot-kind is-${k.id}`} onClick={() => mark(k.id)} disabled={busy} data-testid={`spot-${k.id}`}>
              <span aria-hidden="true">{k.id === 'puesto' ? '☕' : '🙋'}</span>
              <span><b>{k.label}</b><small>{k.hint}</small></span>
            </button>
          ))}
          <button type="button" className="mapp-link" onClick={() => setPos(null)} disabled={busy}>Cancelar</button>
        </div>
      )}
      {error && <p className="mapp-error" role="alert">{error}</p>}
    </section>
  );
}

export default function StudyView({ go, focus = null }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // la ficha que se está completando
  const [surveying, setSurveying] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    loadStudy().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  // Las fotos de venta con su lugar (sin la migración todavía: el mapa queda sin esa capa)
  const [photos, setPhotos] = useState([]);
  useEffect(() => { postPoints().then((p) => setPhotos(Array.isArray(p) ? p : [])).catch(() => setPhotos([])); }, []);
  // Los avistamientos: primero sube lo que quedó en el celular y luego se leen
  const [seen, setSeen] = useState([]);
  const [queued, setQueued] = useState(() => readSightingQueue(localStorage));
  const loadSightings = useCallback(async () => {
    for (const item of readSightingQueue(localStorage)) {
      try { await addSighting(item); unqueueSighting(localStorage, item.ref); } catch { break; }
    }
    setQueued(readSightingQueue(localStorage));
    listSightings().then((l) => setSeen(Array.isArray(l) ? l : [])).catch(() => setSeen([]));
  }, []);
  useEffect(() => { loadSightings(); }, [loadSightings]);
  const mapRef = useRef(null);
  useEffect(() => { if (focus === 'mapa' && data) mapRef.current?.scrollIntoView({ block: 'start' }); }, [focus, data]);

  const done = (text) => { setNotice(`✓ ${text}`); setOpen(null); load(); };
  const spotted = (text) => { setNotice(`✓ ${text}`); load(); loadSightings(); };

  if (error && !data) return <p className="mapp-error" role="alert">No se pudo leer el estudio: {error}</p>;
  if (!data) return <Cargando fig="caminando">Leyendo el estudio…</Cargando>;

  const rows = studyRows(data.tinteros, data.surveys);
  const n = studyCounts(rows);
  const surveysReady = data.surveysReady !== false;
  const tinto = sightingCounts(seen, queued);

  return (
    <div className="mapp-study">
      {/* La cabecera de Vender, con las cifras del estudio; la encuesta y la cámara están en la barra */}
      <section className="mapp-studyhead" aria-label="El estudio en cifras" data-testid="study-head">
        <p className="mapp-coffeehead-kicker">Equipo · estudio de calle</p>
        <h1 className="mapp-coffeehead-title">Estudio de calle</h1>
        <dl className="mapp-coffeehead-kpis is-four">
          <div><dd data-testid="study-total">{n.total}</dd><dt>puestos</dt></div>
          <div><dd>{n.encuesta}</dd><dt>con encuesta</dt></div>
          <div><dd>{n.gps}</dd><dt>con GPS</dt></div>
          <div><dd data-testid="study-tinto">{tinto.today}</dd><dt>tomando tinto hoy</dt></div>
        </dl>
        <p className="mapp-coffeehead-fine">{n.total - n.done} fichas con algo pendiente · {n.foto} con foto · {tinto.week} avistamientos en 7 días{tinto.pending ? ` · ${tinto.pending} en el celular` : ''}</p>
      </section>

      <SpotButton onDone={spotted} />

      {notice && <p className="mapp-notice" role="status">{notice}</p>}
      {error && <p className="mapp-error" role="alert">{error}</p>}

      <div ref={mapRef} id="estudio-mapa" />
      <Suspense fallback={null}><StudyHeatMap rows={rows} routes={data.routes ?? []} photos={photos} sightings={[...seen, ...queued]} /></Suspense>

      <section className="mapp-glass">
        <p className="mapp-cota">Fichas · {n.total - n.done} con algo pendiente</p>
        {rows.length === 0 ? (
          <p className="mapp-muted">Aún no hay fichas. Toca «Encuesta» abajo frente a un puesto, o «Marcar aquí» al pasar.</p>
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

import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import PilotoMap from './PilotoMap.jsx';
import { heatFromSales, pinsFromTinteros } from '../../../shared/lib/streetMap.js';
import { latestByTintero } from '../survey/survey.js';
import { TINTERO_OPTIONS, hourLabel } from '../micra/tinteroForm.js';

// El informe y la presentación pesan (gráficas, diapositivas): se cargan al abrir la pestaña
const PilotReport = lazy(() => import('../piloto/PilotReport.jsx'));
const SurveyDialog = lazy(() => import('../survey/SurveyDialog.jsx'));
const shortDate = (iso) => new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' });

// Estudio de calle (el MVP con datos reales): donde queda lo que se levanta en
// la calle con «Tintero» en Micra (ficha, encuesta, GPS). Mapa con
// las ventas y los tinteros reales, los números de la semana y las fichas con
// foto. Todo sale de /api/v1/bi/piloto (solo el owner); las fotos viven en el
// bucket privado «estudio» y se piden firmadas con la sesión de quien mira.

const STAGE_LABEL = { prospecto: 'Prospecto', piloto: 'Piloto', activo: 'Activo', pausa: 'En pausa', salio: 'Salió' };
const money = (n) => `$${Math.round(n ?? 0).toLocaleString('es-CO')}`;
const num = (n, d = 0) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const when = (iso) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const cuadra = (r) => {
  const gps = r.lat != null ? ` · GPS${r.gps_accuracy_m != null ? ` ±${r.gps_accuracy_m} m` : ''}` : '';
  if (r.referencia) return `${r.referencia}${gps}`;
  return r.carrera == null ? `${r.zone ?? '—'}${gps}` : `Calle ${r.calle} con ${r.carrera}${r.zone ? ` · ${r.zone}` : ''}${gps}`;
};
const delta = (cur, prev) => (!prev ? null : Math.round(((cur - prev) / prev) * 100));
const label = (field, v) => TINTERO_OPTIONS[field]?.find(([x]) => x === v)?.[1] ?? null;
/** Lo que el estudio sabe de cómo vende: «Termos a pie · hace una ruta · 6 a. m. a 11 a. m. · 3 termos». */
const howSells = (t) => [
  label('formato', t.formato),
  label('recorrido', t.recorrido)?.toLowerCase(),
  t.hora_inicio != null && t.hora_fin != null ? `${hourLabel(t.hora_inicio)} a ${hourLabel(t.hora_fin)}` : null,
  t.termos ? `${t.termos} termos` : null,
].filter(Boolean).join(' · ');
const whoBuys = (t) => [
  label('client_mix', t.client_mix),
  (t.client_types ?? []).map((v) => label('client_types', v)?.toLowerCase()).filter(Boolean).join(', ') || null,
  (t.payments_seen ?? []).includes('fiado') ? 'fía' : null,
  t.ipes === 'si' ? 'registrado en el IPES' : null,
].filter(Boolean).join(' · ');
const km = (m) => `${(Math.round((m ?? 0) / 100) / 10).toLocaleString('es-CO', { minimumFractionDigits: 1 })} km`;
const span = (a, b) => (b ? `${Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000))} min` : 'en curso');

/** El enlace que se le manda al tintero: abre Mi ruta con el código ya escrito. */
const inviteLink = (code) => `${window.location.origin}/ruta?codigo=${code}`;
const inviteText = (name, code) => `Hola ${name.split(' ')[0]}, este es tu enlace para Micra · Mi ruta: ${inviteLink(code)} (código ${code}, vence en 7 días). Entra con tu cuenta de Google.`;

async function api(path, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/v1/bi${path}`, {
    method,
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.detail || 'La API de Acero no respondió.'), { status: res.status });
  return data;
}

/** La ruta dentro del bucket a partir de la URL guardada (…/object/public/estudio/<ruta>). */
const bucketPath = (url) => (url || '').split('/estudio/')[1] ?? null;

// Una URL firmada por foto y por hora: se recuerda para no volver a pedirla
// (React en desarrollo monta dos veces; con muchos tinteros serían muchas peticiones)
const signed = new Map(); // path → Promise<signedUrl>
const signedUrlFor = (path) => {
  if (!signed.has(path)) {
    signed.set(path, supabase.storage.from('estudio').createSignedUrl(path, 3600).then(({ data }) => data?.signedUrl ?? null));
    setTimeout(() => signed.delete(path), 50 * 60 * 1000); // antes de que venza
  }
  return signed.get(path);
};

function Photo({ url, alt }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    const path = bucketPath(url);
    if (!path) return undefined;
    let alive = true;
    signedUrlFor(path).then((u) => { if (alive && u) setSrc(u); });
    return () => { alive = false; };
  }, [url]);
  if (!url) return <div className="piloto-nophoto" aria-hidden="true">Sin foto</div>;
  return src ? <img className="piloto-photo" src={src} alt={alt} loading="lazy" /> : <div className="piloto-nophoto">Cargando foto…</div>;
}

function Kpi({ label, value, foot, warn }) {
  return (
    <div className={`dash-kpi ${warn ? 'is-warn' : ''}`}>
      <span className="dash-kpi-label">{label}</span>
      <strong className="dash-kpi-num">{value}</strong>
      {foot && <span className="dash-kpi-foot">{foot}</span>}
    </div>
  );
}

export default function PilotoPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);
  const [tab, setTab] = useState('estudio'); // estudio · informe
  const [surveying, setSurveying] = useState(null); // el tintero que se está encuestando
  const [notice, setNotice] = useState(null);
  const [invite, setInvite] = useState(null); // { tintero, code } recién generado
  const [placing, setPlacing] = useState(null); // tintero sin GPS ni cuadra que se ubica tocando el mapa

  // Ubicar a mano: el punto tocado va a ese tintero y a los vecinos sin lugar con la misma
  // referencia (los carritos pegados de Plaza de las Américas), corridos unos metros para verse
  const place = async ({ lat, lng }) => {
    const t = placing;
    if (!t) return;
    setPlacing(null);
    const same = data.tinteros.filter((x) => x.id === t.id
      || (t.referencia && x.referencia === t.referencia && x.lat == null && x.carrera == null));
    try {
      for (const [i, x] of same.entries()) {
        await api(`/tinteros/${x.id}`, { method: 'PATCH', body: { lat: +(lat + i * 0.00003).toFixed(6), lng: +(lng + i * 0.00003).toFixed(6) } });
      }
      setNotice(`✓ ${same.map((x) => x.name).join(', ')} ${same.length === 1 ? 'quedó' : 'quedaron'} en el mapa.`);
      load();
    } catch (e) {
      setError(`No se guardó el lugar: ${e.message}`);
    }
  };

  const makeInvite = async (t) => {
    setNotice(null);
    const { data: res, error: err } = await supabase.rpc('tintero_invite', { p_tintero_id: t.id });
    if (err) { setError(err.message); return; }
    setInvite({ tintero: t, code: res.code });
  };

  const load = useCallback(() => {
    setLoading(true);
    api(`/piloto?days=${days}`).then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  // El mapa: ventas por cuadra → calor; tinteros → pines (sin nombres)
  const view = useMemo(() => {
    if (!data) return null;
    const byBlock = new Map();
    for (const s of data.sales) {
      const key = `${Math.round(s.carrera)}|${Math.round(s.calle)}`;
      const row = byBlock.get(key) ?? { carrera: Math.round(s.carrera), calle: Math.round(s.calle), cups: 0, zone: s.zone };
      row.cups += s.cups;
      byBlock.set(key, row);
    }
    const heatPoints = heatFromSales([...byBlock.values()]);
    const pinPoints = pinsFromTinteros(data.tinteros);
    const gpsCount = data.tinteros.filter((t) => t.lat != null).length;
    const all = [...byBlock.values(), ...data.tinteros.filter((t) => t.carrera != null)];
    // Centrar en lo que hay; sin datos, Chapinero
    const c = all.length ? all.reduce((n, r) => n + +r.carrera, 0) / all.length : 12;
    const k = all.length ? all.reduce((n, r) => n + +r.calle, 0) / all.length : 72;
    return { style: 'plano', c, k, ax: 0.5, ay: 0.5, s: 10, heat: 1, labels: 1.1, heatPoints, pinPoints, pins: pinPoints.length > 0, real: heatPoints.length + pinPoints.length + gpsCount > 0 };
  }, [data]);

  const w = data?.week;
  const cupsDelta = w ? delta(w.cur.cups, w.prev.cups) : null;
  const lastSurvey = useMemo(() => latestByTintero(data?.surveys), [data]);

  return (
    <div className="admin-page esp dash piloto">
      <header className="esp-head">
        <div className="esp-cota">
          <span>FIG. 05 — ESTUDIO DE CALLE · MVP</span>
          <span className="esp-badge">API DE ACERO · DATOS REALES</span>
        </div>
        <h1 className="esp-title">Estudio.</h1>
        <p className="esp-sub">Lo que levantas en la calle con «Tintero» en Micra llega aquí: cada tintero con su ficha, su encuesta y su punto de GPS en el mapa; cada taza vendida, con su lugar y su hora. Nada aquí es ejemplo.</p>
        <div className="esp-chips" role="group" aria-label="Ventana">
          {[[30, '30 días'], [90, '90 días'], [365, 'Un año']].map(([d, label]) => (
            <button key={d} type="button" className={`esp-chip ${days === d ? 'active' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>{label}</button>
          ))}
          <button type="button" className="esp-chip esp-chip-ghost" onClick={load} disabled={loading}>{loading ? 'Leyendo…' : '↻ Actualizar'}</button>
        </div>
      </header>

      {error && <p className="esp-notice" role="alert">No se pudo leer el estudio: {error}</p>}
      {notice && <p className="esp-notice ok" role="status">{notice}</p>}
      {data?.surveysReady === false && <p className="esp-notice" role="note">La encuesta y el informe completo se activan al aplicar en Supabase la migración de encuestas (20261022140000_tintero_surveys). Mientras tanto se ve lo de la ficha y las ventas.</p>}
      {!data && loading && <p className="dash-booting">LEYENDO EL ESTUDIO…</p>}

      {data && (
        <div className="piloto-tabs" role="tablist" aria-label="Vista del estudio">
          {[['estudio', 'Datos y mapa'], ['informe', 'Informe y presentación']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : undefined} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      )}

      {data && tab === 'informe' && (
        <Suspense fallback={<p className="dash-booting">ARMANDO EL INFORME…</p>}>
          <PilotReport data={data} onScenarioSaved={load} />
        </Suspense>
      )}

      {data && tab === 'estudio' && (
        <>
          <section className="dash-kpis" aria-label="Esta semana">
            <Kpi label={`Tazas en la calle · ${w.from} → ${w.to}`} value={num(w.cur.cups)} foot={cupsDelta === null ? `Semana anterior: ${num(w.prev.cups)}` : `${cupsDelta >= 0 ? '▲' : '▼'} ${Math.abs(cupsDelta)} % vs. ${num(w.prev.cups)} la semana anterior`} warn={cupsDelta !== null && cupsDelta < 0} />
            <Kpi label="Ingreso de la semana" value={money(w.cur.income)} foot={`${w.cur.sales} ventas · ${num(w.cur.kg, 2)} kg de café`} />
            <Kpi label="Cuadras con venta" value={num(w.cur.blocks)} foot={w.cur.zones.length ? w.cur.zones.join(' · ') : 'Aún sin lugar en las ventas'} />
            <Kpi label="Tinteros" value={num(data.study.surveyed)} foot={data.study.surveyed ? `${num(data.study.located ?? 0)} en el mapa · ${data.study.with_photo} con foto · tinto a ${data.study.tinto_price_avg ? money(data.study.tinto_price_avg) : '—'} · ${data.study.cups_per_hour_avg ?? '—'} tazas/h` : 'Registra el primero desde Micra › Tintero'} />
          </section>

          <section className="dash-sheet piloto-map" aria-label="Mapa del estudio">
            <div className="esp-cota"><span>MAPA · {view.real ? `ventas y tinteros de los últimos ${data.days} días` : 'todavía sin puntos reales'}</span><span>{data.study.zones.join(' · ') || '—'}</span></div>
            <div className="piloto-map-box">
              <PilotoMap sales={data.sales} tinteros={data.tinteros} routes={data.routes} fallbackView={view} placing={placing?.name ?? null} onPlace={place} label="Mapa de Bogotá con el calor de los tinteros y de las ventas en la calle" />
            </div>
            {!view.real && <p className="esp-muted">El mapa se llena solo: elige «Hoy vendo en» en la venta de Micra y registra tinteros con el botón «Tintero» de la cámara.</p>}
            {view.real && <p className="esp-muted piloto-geo-note">Los tinteros van en su punto de GPS; los que solo tienen cuadra, con una o dos cuadras de margen. Toca un tintero para ver su ficha.</p>}
          </section>

          <div className="piloto-cols">
            <section className="dash-sheet" aria-label="Ventas con lugar">
              <div className="esp-cota"><span>VENTAS EN LA CALLE</span><span>{data.sales.length}</span></div>
              {data.sales.length === 0 ? <p className="esp-muted">Aún no hay ventas con lugar en este periodo.</p> : (
                <ul className="piloto-list">
                  {data.sales.slice(0, 40).map((s) => (
                    <li key={s.id}>
                      <b>{cuadra(s)}</b>
                      <span>{when(s.at)} · {s.cups} {s.cups === 1 ? 'taza' : 'tazas'} · {money(s.total)}</span>
                      <small>{s.what}</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dash-sheet" aria-label="Tinteros">
              <div className="esp-cota"><span>TINTEROS</span><span>{data.tinteros.length}</span></div>
              {data.tinteros.length === 0 ? <p className="esp-muted">Aún no hay tinteros registrados.</p> : (
                <ul className="piloto-tinteros">
                  {data.tinteros.map((t) => {
                    const sv = lastSurvey.get(t.id);
                    return (
                      <li key={t.id} className="piloto-tintero">
                        {t.photo_consent ? <Photo url={t.photo_url} alt={`Puesto de ${t.name}`} /> : <div className="piloto-nophoto">Sin permiso de foto</div>}
                        <div>
                          <b>{t.name}</b>
                          <span>{t.localidad && t.localidad !== t.zone ? `${t.localidad} · ` : ''}{cuadra(t)}</span>
                          {howSells(t) && <span>{howSells(t)}</span>}
                          {whoBuys(t) && <span>{whoBuys(t)}</span>}
                          <span>{STAGE_LABEL[t.stage] ?? t.stage}{t.tinto_price ? ` · tinto a ${money(t.tinto_price)}` : ''}{t.cups_per_hour ? ` · ${t.cups_per_hour} tazas/h` : ''}</span>
                          {t.notes && <small>{t.notes}</small>}
                          <span className={`piloto-survey ${sv ? 'is-done' : ''}`}>{sv ? `Encuestado el ${shortDate(sv.surveyed_at)}` : 'Sin encuesta'}</span>
                          {data.surveysReady !== false && (
                            // La encuesta se hace en la calle con «Tintero» en Micra; aquí solo se completa la que quedó pendiente
                            <button type="button" className="esp-chip piloto-survey-btn" onClick={() => { setNotice(null); setSurveying(t); }}>{sv ? 'Corregir encuesta' : 'Completar encuesta'}</button>
                          )}
                          {t.lat == null && t.carrera == null && (
                            <button type="button" className="esp-chip piloto-survey-btn" aria-pressed={placing?.id === t.id}
                              onClick={() => { setNotice(null); setPlacing(placing?.id === t.id ? null : t); document.querySelector('.piloto-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                              {placing?.id === t.id ? 'Cancelar: no ubicar' : '📍 Ubicar en el mapa'}
                            </button>
                          )}
                          {data.routesReady && (t.linked ? (
                            <span className="piloto-survey is-done">Usa Mi ruta{t.tracking_consent_at ? '' : ' · sin permiso de ubicación'}</span>
                          ) : (
                            <button type="button" className="esp-chip piloto-survey-btn" onClick={() => makeInvite(t)}>Invitar a Mi ruta</button>
                          ))}
                          {invite?.tintero.id === t.id && (
                            <div className="piloto-invite" role="status">
                              <span>Código <b data-testid="invite-code">{invite.code}</b> · vence en 7 días</span>
                              <a className="esp-chip" href={`https://wa.me/?text=${encodeURIComponent(inviteText(t.name, invite.code))}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
                              <button type="button" className="esp-chip esp-chip-ghost" onClick={() => navigator.clipboard?.writeText(inviteLink(invite.code)).then(() => setNotice(`✓ Enlace de ${t.name} copiado.`), () => {})}>Copiar enlace</button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {data.routesReady && (
            <section className="dash-sheet" aria-label="Recorridos">
              <div className="esp-cota"><span>RECORRIDOS · MI RUTA</span><span>{data.routes.length}</span></div>
              {data.routes.length === 0 ? <p className="esp-muted">Aún no hay recorridos. Invita a un tintero a Mi ruta desde su ficha.</p> : (
                <ul className="piloto-list">
                  {data.routes.slice(0, 40).map((r) => (
                    <li key={r.id}>
                      <b>{data.tinteros.find((t) => t.id === r.tintero_id)?.name ?? 'Tintero'}</b>
                      <span>{when(r.started_at)} · {span(r.started_at, r.ended_at)} · {km(r.distance_m)} · {(r.stops ?? []).length} {(r.stops ?? []).length === 1 ? 'parada' : 'paradas'}</span>
                      {(r.stops ?? []).length > 0 && <small>{r.stops.map((p) => `${p.minutes} min${p.calle ? ` en Calle ${p.calle} con ${p.carrera}` : ''}`).join(' · ')}</small>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {data.routesReady === false && <p className="esp-notice" role="note">Los recorridos de Mi ruta se activan al aplicar en Supabase la migración 20261023120000_tintero_routes.</p>}
        </>
      )}

      {surveying && (
        <Suspense fallback={null}>
        <SurveyDialog
          tintero={surveying}
          onClose={() => setSurveying(null)}
          onSaved={() => { setNotice(`✓ Encuesta de ${surveying.name} guardada.`); setSurveying(null); load(); }}
        />
        </Suspense>
      )}
    </div>
  );
}

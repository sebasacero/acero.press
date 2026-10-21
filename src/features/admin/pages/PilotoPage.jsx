import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import PilotoMap from './PilotoMap.jsx';
import { heatFromSales, pinsFromTinteros } from '../../../shared/lib/streetMap.js';

// Piloto del estudio de calle: la página que se abre en la reunión. Mapa con
// las ventas y los tinteros reales, los números de la semana y las fichas con
// foto. Todo sale de /api/v1/bi/piloto (solo el owner); las fotos viven en el
// bucket privado «estudio» y se piden firmadas con la sesión de quien mira.

const STAGE_LABEL = { prospecto: 'Prospecto', piloto: 'Piloto', activo: 'Activo', pausa: 'En pausa', salio: 'Salió' };
const money = (n) => `$${Math.round(n ?? 0).toLocaleString('es-CO')}`;
const num = (n, d = 0) => (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const when = (iso) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const cuadra = (r) => (r.carrera == null ? '—' : `Calle ${r.calle} con ${r.carrera}${r.zone ? ` · ${r.zone}` : ''}`);
const delta = (cur, prev) => (!prev ? null : Math.round(((cur - prev) / prev) * 100));

async function api(path) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/v1/bi${path}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
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
    const all = [...byBlock.values(), ...data.tinteros.filter((t) => t.carrera != null)];
    // Centrar en lo que hay; sin datos, Chapinero
    const c = all.length ? all.reduce((n, r) => n + +r.carrera, 0) / all.length : 12;
    const k = all.length ? all.reduce((n, r) => n + +r.calle, 0) / all.length : 72;
    return { style: 'plano', c, k, ax: 0.5, ay: 0.5, s: 10, heat: 1, labels: 1.1, heatPoints, pinPoints, pins: pinPoints.length > 0, real: heatPoints.length + pinPoints.length > 0 };
  }, [data]);

  const w = data?.week;
  const cupsDelta = w ? delta(w.cur.cups, w.prev.cups) : null;

  return (
    <div className="admin-page esp dash piloto">
      <header className="esp-head">
        <div className="esp-cota">
          <span>FIG. 05 — PILOTO CHAPINERO / ESTUDIO DE CALLE</span>
          <span className="esp-badge">API DE ACERO · DATOS REALES</span>
        </div>
        <h1 className="esp-title">Piloto.</h1>
        <p className="esp-sub">Cada taza vendida en la calle queda con su cuadra y su hora; cada tintero mapeado, con su ficha. Esta página es la que se abre en la reunión: nada aquí es ejemplo.</p>
        <div className="esp-chips" role="group" aria-label="Ventana">
          {[[30, '30 días'], [90, '90 días'], [365, 'Un año']].map(([d, label]) => (
            <button key={d} type="button" className={`esp-chip ${days === d ? 'active' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>{label}</button>
          ))}
          <button type="button" className="esp-chip esp-chip-ghost" onClick={load} disabled={loading}>{loading ? 'Leyendo…' : '↻ Actualizar'}</button>
        </div>
      </header>

      {error && <p className="esp-notice" role="alert">No se pudo leer el piloto: {error}</p>}
      {!data && loading && <p className="dash-booting">LEYENDO EL ESTUDIO…</p>}

      {data && (
        <>
          <section className="dash-kpis" aria-label="Esta semana">
            <Kpi label={`Tazas en la calle · ${w.from} → ${w.to}`} value={num(w.cur.cups)} foot={cupsDelta === null ? `Semana anterior: ${num(w.prev.cups)}` : `${cupsDelta >= 0 ? '▲' : '▼'} ${Math.abs(cupsDelta)} % vs. ${num(w.prev.cups)} la semana anterior`} warn={cupsDelta !== null && cupsDelta < 0} />
            <Kpi label="Ingreso de la semana" value={money(w.cur.income)} foot={`${w.cur.sales} ventas · ${num(w.cur.kg, 2)} kg de café`} />
            <Kpi label="Cuadras con venta" value={num(w.cur.blocks)} foot={w.cur.zones.length ? w.cur.zones.join(' · ') : 'Aún sin lugar en las ventas'} />
            <Kpi label="Tinteros mapeados" value={num(data.study.surveyed)} foot={data.study.surveyed ? `${data.study.with_photo} con foto · tinto a ${data.study.tinto_price_avg ? money(data.study.tinto_price_avg) : '—'} · ${data.study.cups_per_hour_avg ?? '—'} tazas/h` : 'Registra el primero desde Micra › Tintero'} />
          </section>

          <section className="dash-sheet piloto-map" aria-label="Mapa del estudio">
            <div className="esp-cota"><span>MAPA · {view.real ? `ventas y tinteros de los últimos ${data.days} días` : 'todavía sin puntos reales'}</span><span>{data.study.zones.join(' · ') || '—'}</span></div>
            <div className="piloto-map-box">
              <PilotoMap sales={data.sales} tinteros={data.tinteros} fallbackView={view} label="Mapa de Bogotá con el calor de las ventas en la calle y los tinteros mapeados" />
            </div>
            {!view.real && <p className="esp-muted">El mapa se llena solo: elige «Hoy vendo en» en la venta de Micra y registra tinteros con el botón «Tintero» de la cámara.</p>}
            {view.real && <p className="esp-muted piloto-geo-note">Ubicación por cuadra (calle y carrera), con una o dos cuadras de margen. Toca un tintero para ver su ficha.</p>}
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
                  {data.tinteros.map((t) => (
                    <li key={t.id} className="piloto-tintero">
                      {t.photo_consent ? <Photo url={t.photo_url} alt={`Puesto de ${t.name}`} /> : <div className="piloto-nophoto">Sin permiso de foto</div>}
                      <div>
                        <b>{t.name}</b>
                        <span>{cuadra(t)}</span>
                        <span>{STAGE_LABEL[t.stage] ?? t.stage}{t.tinto_price ? ` · tinto a ${money(t.tinto_price)}` : ''}{t.cups_per_hour ? ` · ${t.cups_per_hour} tazas/h` : ''}</span>
                        {t.notes && <small>{t.notes}</small>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

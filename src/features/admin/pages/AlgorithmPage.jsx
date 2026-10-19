import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

// Algoritmo Micra: la inteligencia de negocio del plan (estudio de tinteros +
// plan de contenido). Todo se calcula en la API de Acero (FastAPI,
// /api/v1/bi), la misma que usará el asistente de WhatsApp: aquí solo se
// muestra y se registran los tinteros.

const PRIORITY = { 1: 'Hoy', 2: 'Esta semana', 3: 'Cuando se pueda' };
const AREA = { operacion: 'Operación', red: 'Red', negocio: 'Negocio', redes: 'Redes', mercado: 'Mercado' };
const STATUS = { ok: ['●', 'En rango'], warn: ['▲', 'Atención'], alert: ['■', 'Alerta'], nodata: ['○', 'Sin datos'] };
const STAGES = ['prospecto', 'piloto', 'activo', 'pausa', 'salio'];
const STAGE_LABEL = { prospecto: 'Prospecto', piloto: 'Piloto', activo: 'Activo', pausa: 'En pausa', salio: 'Salió' };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const money = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const dec = (n, d) => n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });

function fmt(k) {
  if (k.value === null || k.value === undefined) return '—';
  const v = k.value;
  switch (k.unit) {
    case 'cop': return money(v);
    case 'pct': return `${dec(v, v < 1 && v > 0 ? 3 : 1)} %`;
    case 'kg': return `${dec(v, 2)} kg`;
    case 'per_h': return `${dec(v, 1)}/h`;
    case 'cents_lb': return `${dec(v, 2)} ¢/lb`;
    case 'c': return `${Math.round(v)} °C`;
    default: return Math.round(v).toLocaleString('es-CO');
  }
}

function Delta({ k }) {
  if (k.delta_pct === null || k.delta_pct === undefined) return null;
  const dir = k.delta_pct > 0 ? 'up' : k.delta_pct < 0 ? 'down' : 'flat';
  const d = Math.abs(k.delta_pct);
  return <span className={`algo-delta is-${dir}`}>{{ up: '▲', down: '▼', flat: '=' }[dir]} {dec(d, d < 10 ? 1 : 0)} %</span>;
}

async function api(path, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/v1/bi${path}`, {
    method,
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    const msg = Array.isArray(detail) ? detail.map((d) => d.msg).join(' · ') : detail;
    throw Object.assign(new Error(msg || 'La API de Acero no respondió.'), { status: res.status });
  }
  return data;
}

// Campos vacíos fuera; números como números
const clean = (form, numeric) => Object.fromEntries(
  Object.entries(form)
    .filter(([, v]) => v !== '' && v !== null)
    .map(([k, v]) => [k, numeric.includes(k) ? Number(v) : v]),
);

function Field({ label, children }) {
  return (
    <label className="esp-field">
      <span className="esp-field-label"><span>{label}</span></span>
      {children}
    </label>
  );
}

function Tinteros({ onChange }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [person, setPerson] = useState({ name: '', phone: '', zone: '', stage: 'prospecto', baseline_income: '', baseline_cups: '' });
  const [dayForm, setDayForm] = useState({ tintero: '', day: today(), cups_specialty: '', cups_tinto: '', price_specialty: '', net_income: '', hours: '' });

  const load = useCallback(() => {
    api('/tinteros').then((rows) => { setList(rows); setError(null); }).catch((err) => setError(err));
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e, run, ok) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await run();
      setNotice({ ok: true, text: ok });
      load();
      onChange();
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    }
    setBusy(false);
  };

  if (error?.status === 409) {
    return <p className="esp-muted">La red de tinteros aún no tiene sus tablas en la base de datos (falta aplicar la migración <code>micra_tinteros</code>).</p>;
  }
  if (error) return <p className="esp-muted">No se pudo leer la red: {error.message}</p>;
  if (!list) return <p className="esp-muted">Cargando la red…</p>;

  const week = new Date(Date.now() - 6 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  return (
    <div className="algo-net">
      {list.length === 0 ? (
        <p className="esp-muted">Aún no hay tinteros. Empieza por la etapa 0: registra a quienes conoces con su línea base (lo que ganan y venden hoy).</p>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Tintero</th><th>Etapa</th><th>Base / día</th><th>Tazas esp. 7 d</th><th>Ingreso prom. 7 d</th></tr></thead>
            <tbody>
              {list.map((t) => {
                const days = t.days.filter((d) => d.day >= week);
                const incomes = days.map((d) => d.net_income).filter((v) => v !== null);
                const avg = incomes.length ? incomes.reduce((a, b) => a + b, 0) / incomes.length : null;
                return (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong>{t.zone ? <><br /><span className="esp-muted">{t.zone}</span></> : null}</td>
                    <td>{STAGE_LABEL[t.stage]}</td>
                    <td>{t.baseline_income ? money(t.baseline_income) : '—'}</td>
                    <td>{days.reduce((a, d) => a + d.cups_specialty, 0)}</td>
                    <td>
                      {avg === null ? '—' : money(avg)}
                      {avg !== null && t.baseline_income ? <span className={`algo-delta is-${avg >= t.baseline_income ? 'up' : 'down'}`}> {avg >= t.baseline_income ? '▲' : '▼'} {dec(Math.abs((avg - t.baseline_income) / t.baseline_income) * 100, 0)} %</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="algo-forms">
        <form className="algo-form" onSubmit={(e) => submit(e, () => api('/tinteros', { method: 'POST', body: clean(person, ['baseline_income', 'baseline_cups']) }), `${person.name} quedó en la red.`)}>
          <p className="algo-form-title">Nuevo tintero</p>
          <Field label="Nombre"><input className="esp-input" required minLength={2} maxLength={80} value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} /></Field>
          <div className="algo-form-row">
            <Field label="WhatsApp"><input className="esp-input" inputMode="numeric" pattern="[0-9]{7,15}" value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label="Zona"><input className="esp-input" maxLength={80} placeholder="Calle 72 con 11" value={person.zone} onChange={(e) => setPerson({ ...person, zone: e.target.value })} /></Field>
          </div>
          <div className="algo-form-row">
            <Field label="Etapa">
              <select className="esp-input" value={person.stage} onChange={(e) => setPerson({ ...person, stage: e.target.value })}>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field label="Ingreso neto / día hoy"><input className="esp-input" type="number" min="0" step="500" value={person.baseline_income} onChange={(e) => setPerson({ ...person, baseline_income: e.target.value })} /></Field>
            <Field label="Tintos / día hoy"><input className="esp-input" type="number" min="0" value={person.baseline_cups} onChange={(e) => setPerson({ ...person, baseline_cups: e.target.value })} /></Field>
          </div>
          <button type="submit" className="esp-btn esp-btn-primary" disabled={busy}>Registrar tintero</button>
        </form>

        <form
          className="algo-form"
          onSubmit={(e) => submit(
            e,
            () => api(`/tinteros/${dayForm.tintero}/days/${dayForm.day}`, { method: 'PUT', body: clean({ ...dayForm, tintero: '', day: '' }, ['cups_specialty', 'cups_tinto', 'price_specialty', 'net_income', 'hours']) }),
            'Día registrado.',
          )}
        >
          <p className="algo-form-title">Registrar el día</p>
          <div className="algo-form-row">
            <Field label="Tintero">
              <select className="esp-input" required value={dayForm.tintero} onChange={(e) => setDayForm({ ...dayForm, tintero: e.target.value })}>
                <option value="">Elige…</option>
                {list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Fecha"><input className="esp-input" type="date" required max={today()} value={dayForm.day} onChange={(e) => setDayForm({ ...dayForm, day: e.target.value })} /></Field>
          </div>
          <div className="algo-form-row">
            <Field label="Tazas especiales"><input className="esp-input" type="number" min="0" value={dayForm.cups_specialty} onChange={(e) => setDayForm({ ...dayForm, cups_specialty: e.target.value })} /></Field>
            <Field label="Tintos"><input className="esp-input" type="number" min="0" value={dayForm.cups_tinto} onChange={(e) => setDayForm({ ...dayForm, cups_tinto: e.target.value })} /></Field>
            <Field label="Precio taza esp."><input className="esp-input" type="number" min="0" step="100" value={dayForm.price_specialty} onChange={(e) => setDayForm({ ...dayForm, price_specialty: e.target.value })} /></Field>
          </div>
          <div className="algo-form-row">
            <Field label="Ingreso neto del día"><input className="esp-input" type="number" min="0" step="500" value={dayForm.net_income} onChange={(e) => setDayForm({ ...dayForm, net_income: e.target.value })} /></Field>
            <Field label="Horas en la calle"><input className="esp-input" type="number" min="0.5" max="24" step="0.5" value={dayForm.hours} onChange={(e) => setDayForm({ ...dayForm, hours: e.target.value })} /></Field>
          </div>
          <button type="submit" className="esp-btn esp-btn-primary" disabled={busy || !list.length}>Guardar el día</button>
        </form>
      </div>
      {notice && <p className={`esp-notice ${notice.ok ? 'ok' : ''}`} role="status">{notice.text}</p>}
    </div>
  );
}

export default function AlgorithmPage() {
  const [kind, setKind] = useState('daily');
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api(`/brief?kind=${kind}`)
      .then((b) => { setBrief(b); setError(null); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  };

  const north = brief?.scorecard.north;
  return (
    <div className="admin-page esp dash algo">
      <header className="esp-head">
        <div className="esp-cota">
          <span>FIG. 00 — ALGORITMO MICRA / INTELIGENCIA DE NEGOCIO</span>
          <span className="esp-badge">API DE ACERO · FASTAPI</span>
        </div>
        <h1 className="esp-title">Algoritmo.</h1>
        <p className="esp-sub">Lee los datos reales, los compara con la semana anterior y con las metas del estudio de tinteros, y te dice qué hacer hoy, en orden. Es el mismo cerebro que usará el asistente de WhatsApp.</p>
        <div className="esp-chips algo-kind" role="group" aria-label="Tipo de resumen">
          {[['daily', 'Diario'], ['weekly', 'Semanal']].map(([id, label]) => (
            <button key={id} type="button" className={`esp-chip ${kind === id ? 'active' : ''}`} aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>
          ))}
          <button type="button" className="esp-chip esp-chip-ghost" onClick={load} disabled={loading}>{loading ? 'Calculando…' : '↻ Recalcular'}</button>
        </div>
      </header>

      {error && <p className="esp-notice" role="alert">No se pudo calcular: {error}</p>}
      {!brief && loading && <p className="dash-booting">CALCULANDO EL ALGORITMO…</p>}

      {brief && (
        <>
          <section className="algo-north" aria-label="Métrica norte">
            <span className="dash-kpi-label">Norte · {north.label}</span>
            <strong>{fmt(north)}</strong>
            <span className="dash-kpi-foot">Semana anterior: {fmt({ ...north, value: north.prev })} <Delta k={north} /> · {brief.period.from} → {brief.period.to}</span>
            <span className="dash-kpi-foot">{north.note}</span>
          </section>

          <div className="algo-levels">
            {brief.scorecard.levels.map((lvl) => (
              <section key={lvl.id} className="dash-sheet">
                <div className="esp-cota"><span>{lvl.label}</span></div>
                <ul className="algo-kpis">
                  {lvl.kpis.map((k) => (
                    <li key={k.id} title={k.note ?? undefined}>
                      <span className="algo-kpi-label">{k.label}</span>
                      <strong>{fmt(k)}</strong>
                      <Delta k={k} />
                      {STATUS[k.status] && <span className={`algo-status is-${k.status}`}>{STATUS[k.status][0]} {STATUS[k.status][1]}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <section className="dash-sheet">
            <div className="esp-cota"><span>FIG. 01 — QUÉ HACER, EN ORDEN</span><span>{brief.actions.length} ACCIONES</span></div>
            <ol className="algo-actions">
              {brief.actions.map((a) => (
                <li key={a.id} className={`is-p${a.priority}`}>
                  <div className="algo-action-tags"><span className="algo-prio">{PRIORITY[a.priority]}</span><span>{AREA[a.area]}</span></div>
                  <strong>{a.title}</strong>
                  <p><b>Por qué:</b> {a.why}</p>
                  <p><b>Qué hacer:</b> {a.do}</p>
                  <p className="esp-muted">Vigila: {a.watch}</p>
                </li>
              ))}
            </ol>
          </section>

          <div className="dash-row">
            <section className="dash-sheet">
              <div className="esp-cota"><span>FIG. 02 — CONTENIDO</span><span>{brief.content.length === 1 ? 'HOY' : '7 DÍAS'}</span></div>
              <ul className="algo-content">
                {brief.content.map((c) => (
                  <li key={c.day}>
                    <span className="algo-kpi-label">{c.day} · {c.format} · {c.hour}</span>
                    <strong>{c.pillar}</strong>
                    <p>{c.idea}</p>
                  </li>
                ))}
              </ul>
            </section>
            <section className="dash-sheet">
              <div className="esp-cota"><span>FIG. 03 — PARA WHATSAPP</span></div>
              <pre className="algo-wa">{brief.text}</pre>
              <div className="esp-actions">
                <button type="button" className="esp-btn esp-btn-ghost" onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar'}</button>
                <a className="esp-btn esp-btn-primary" href={`https://wa.me/?text=${encodeURIComponent(brief.text)}`} target="_blank" rel="noreferrer">Abrir en WhatsApp</a>
              </div>
            </section>
          </div>

          {brief.missing.length > 0 && (
            <p className="esp-muted">No se pudo leer: {brief.missing.join(' · ')}</p>
          )}
        </>
      )}

      <section className="dash-sheet">
        <div className="esp-cota"><span>FIG. 04 — RED DE TINTEROS</span></div>
        <Tinteros onChange={load} />
      </section>
    </div>
  );
}

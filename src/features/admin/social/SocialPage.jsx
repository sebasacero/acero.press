// Redes: analizar lo publicado y crear lo que sigue, en una sola página.
// Lo que se puede probar sin React vive en social.js (con tests).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { instagramSync } from '../../../shared/lib/instagram.js';
import recipes from '../../recipes/data/recipes.js';
import {
  analyze, parseMetaCsv, buildIdea, weekPlan, mondayOf, planText, postText, mixOf,
  FORMATS, PILLARS, TOPICS, DAYS, SLOTS, bestOf, pillarById,
} from './social.js';
import './social.css';

const STORE = 'acero_social_v1'; // { csv: [...posts], plans: { [lunes]: [...ideas] } } solo en este navegador
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) ?? {}; } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

const CHAMPIONS = recipes.map((r) => ({ year: r.year, name: r.name }));
const pct = (x) => (x === null || x === undefined ? '—' : `${(Math.round(x * 10) / 10).toLocaleString('es-CO')} %`);
const num = (x) => (x === null || x === undefined ? '—' : Math.round(x).toLocaleString('es-CO'));
const fmtDay = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const addDays = (ymd, n) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const TABS = [
  { id: 'analizar', label: 'Analizar' },
  { id: 'crear', label: 'Crear' },
  { id: 'semana', label: 'Semana' },
];

export default function SocialPage({ onOpenTool }) {
  const openTool = (id) => onOpenTool?.(id);
  const [tab, setTab] = useState('analizar');
  const [store, setStore] = useState(load);
  const update = (fn) => setStore((s) => { const next = fn(s); save(next); return next; });

  // ── Datos ─────────────────────────────────────────────────────────────
  const [ig, setIg] = useState({ posts: [], daily: [], loading: true });
  const [queue, setQueue] = useState(null); // publicaciones pendientes de Micra
  const [days, setDays] = useState(90);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);

  const loadIg = useCallback(async () => {
    const [m, d, q] = await Promise.all([
      supabase.from('ig_media').select('id, media_product, media_type, caption, permalink, posted_at, like_count, comments_count, reach, views, saved, shares').order('posted_at', { ascending: false }).limit(500),
      supabase.from('ig_account_daily').select('day, followers_count').order('day', { ascending: true }).limit(400),
      supabase.from('publications').select('id', { count: 'exact', head: true }).eq('published', false),
    ]);
    setIg({ posts: m.data ?? [], daily: d.data ?? [], loading: false });
    setQueue(q.count ?? null);
  }, []);
  useEffect(() => { loadIg(); }, [loadIg]);

  const csvPosts = store.csv ?? [];
  const source = ig.posts.length ? 'instagram' : csvPosts.length ? 'csv' : 'none';
  const posts = source === 'instagram' ? ig.posts : csvPosts;
  const a = useMemo(() => analyze(posts, ig.daily, { days }), [posts, ig.daily, days]);
  const bestSlot = bestOf(a.bySlot)?.best.key ?? null;

  const sync = async () => {
    setBusy('sync'); setNotice(null);
    try {
      const r = await instagramSync();
      setNotice({ ok: true, text: `Sincronizados ${r.synced ?? 0} posts.` });
      await loadIg();
    } catch (err) {
      setNotice({ ok: false, text: `${err.message}. Revisa la conexión en Instagram o sube el CSV de Meta.` });
    }
    setBusy(null);
  };

  const importCsv = async (file) => {
    if (!file) return;
    const r = parseMetaCsv(await file.text());
    if (r.error) { setNotice({ ok: false, text: r.error }); return; }
    update((s) => ({ ...s, csv: r.posts }));
    setNotice({ ok: true, text: `Leídos ${r.posts.length} posts del CSV${r.skipped ? ` (${r.skipped} filas sin fecha)` : ''}. Quedan solo en este navegador.` });
  };

  // ── Crear ─────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState(() => buildIdea({ pillar: 'receta', format: 'reel', seed: Date.now(), champions: CHAMPIONS }));
  const [ai, setAi] = useState(null); // { loading, error, why, sources }
  const regen = (patch = {}) => {
    setAi(null);
    setDraft((d) => buildIdea({ pillar: d.pillar, format: d.format, series: d.series, ...patch, seed: Date.now(), champions: CHAMPIONS }));
  };
  const topics = draft.pillar === 'campeones' ? CHAMPIONS.map((c) => `${c.name} (${c.year})`) : TOPICS[draft.pillar] ?? [];

  const copy = async (text, ok = 'Copiado.') => {
    try { await navigator.clipboard.writeText(text); setNotice({ ok: true, text: ok }); }
    catch { setNotice({ ok: false, text: 'No se pudo copiar: selecciona el texto a mano.' }); }
  };

  const writeWithAi = async () => {
    setAi({ loading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/growth-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ action: 'social', idea: draft, findings: a.findings }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error === 'not-configured' ? 'Falta ANTHROPIC_API_KEY en Vercel.' : out.error || 'No se pudo escribir la pieza.');
      setDraft((d) => ({
        ...d,
        hook: out.hook || d.hook,
        shots: out.script?.length ? out.script : d.shots,
        caption: out.caption || d.caption,
        hashtags: out.hashtags?.length ? out.hashtags : d.hashtags,
      }));
      setAi({ why: out.why, sources: out.sources ?? [] });
    } catch (err) {
      setAi({ error: err.message });
    }
  };

  // ── Semana ────────────────────────────────────────────────────────────
  const [monday, setMonday] = useState(() => mondayOf());
  const plan = store.plans?.[monday] ?? null;
  const setPlan = (next) => update((s) => ({ ...s, plans: { ...(s.plans ?? {}), [monday]: next } }));
  const fillWeek = () => setPlan(weekPlan({ monday, champions: CHAMPIONS, bestSlot }));
  const addToWeek = () => {
    const base = plan ?? weekPlan({ monday, champions: CHAMPIONS, bestSlot });
    // Si la idea vino de un día de esta semana, vuelve a ese día; si no, al primer
    // día pendiente del mismo formato o, si no hay, al primero pendiente.
    const pending = (p) => !p.done;
    let i = base.findIndex((p) => p.date === draft.date);
    if (i < 0) i = base.findIndex((p) => pending(p) && p.format === draft.format);
    if (i < 0) i = base.findIndex(pending);
    if (i < 0) { setNotice({ ok: false, text: 'La semana ya está completa: pasa a la siguiente.' }); return; }
    const slot = base[i];
    const next = base.map((p, j) => (j === i ? { ...draft, id: slot.id, date: slot.date, day: slot.day, time: slot.time, series: slot.series, done: false } : p));
    setPlan(next);
    setNotice({ ok: true, text: `Agregada al ${DAYS[slot.day].toLowerCase()} ${fmtDay(`${slot.date}T17:00:00Z`)}.` });
  };
  const editFromWeek = (item) => { setDraft({ ...item }); setAi(null); setTab('crear'); };

  return (
    <div className="admin-page esp dash social">
      <header className="esp-head">
        <div className="esp-cota">
          <span>FIG. 08 — REDES / ANALIZAR Y CREAR</span>
          <span className="esp-badge">{source === 'instagram' ? 'INSTAGRAM' : source === 'csv' ? 'CSV DE META' : 'SIN MÉTRICAS'}</span>
        </div>
        <h1 className="esp-title">Redes.</h1>
        <p className="esp-sub">Qué está funcionando en Instagram, la idea que sigue lista para grabar y la semana de contenido del plan: 5 cortos, 1 carrusel e historias.</p>
      </header>

      <div className="social-tabs" role="tablist" aria-label="Redes">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`esp-chip ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {notice && <p className={`esp-notice ${notice.ok ? 'ok' : 'err'}`} role="status">{notice.text}</p>}

      {tab === 'analizar' && (
        <section aria-label="Analizar" className="social-stack">
          <div className="social-source">
            <p className="esp-muted">
              {ig.loading ? 'Cargando métricas…'
                : source === 'instagram' ? `${ig.posts.length} posts sincronizados de Instagram.`
                  : source === 'csv' ? `${csvPosts.length} posts del CSV de Meta (solo en este navegador).`
                    : 'Aún no hay métricas: trae las de Instagram o sube el CSV que exporta Meta Business Suite (Estadísticas › Contenido › Exportar).'}
            </p>
            <div className="esp-actions-row">
              <label className="social-window">
                <span>Ventana</span>
                <select className="esp-input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  {[30, 90, 180, 365].map((d) => <option key={d} value={d}>{d} días</option>)}
                </select>
              </label>
              <button type="button" className="esp-btn esp-btn-primary" disabled={!!busy} onClick={sync}>{busy === 'sync' ? 'Trayendo…' : 'Traer métricas'}</button>
              <label className="esp-btn esp-btn-ghost social-file">
                Subir CSV de Meta
                <input type="file" accept=".csv,text/csv" onChange={(e) => { importCsv(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {csvPosts.length > 0 && <button type="button" className="esp-btn esp-btn-ghost" onClick={() => update((s) => ({ ...s, csv: [] }))}>Quitar CSV</button>}
            </div>
          </div>

          <div className="dash-kpis">
            <div className="dash-kpi dash-kpi-hero">
              <span className="dash-kpi-label">Posts del feed</span>
              <strong className="dash-kpi-num">{a.totals.feed}</strong>
              <span className="dash-kpi-foot">{a.totals.perWeek.toLocaleString('es-CO')} por semana · {a.totals.stories} historias</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Alcance mediano</span>
              <strong className="dash-kpi-num">{num(a.totals.reach)}</strong>
              <span className="dash-kpi-foot">cuentas por post</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Interacción</span>
              <strong className="dash-kpi-num">{pct(a.totals.engagement)}</strong>
              <span className="dash-kpi-foot">del alcance (mediana)</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Compartidos</span>
              <strong className="dash-kpi-num">{pct(a.totals.shares)}</strong>
              <span className="dash-kpi-foot">la señal que más reparte</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Guardados</span>
              <strong className="dash-kpi-num">{pct(a.totals.saves)}</strong>
              <span className="dash-kpi-foot">del alcance</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Seguidores</span>
              <strong className="dash-kpi-num">{a.followers ? num(a.followers.now) : '—'}</strong>
              <span className="dash-kpi-foot">{a.followers?.delta != null ? `${a.followers.delta >= 0 ? '▲' : '▼'} ${Math.abs(a.followers.delta)} en ${days} días` : 'Sin historial todavía'}</span>
            </div>
          </div>

          <div className="dash-sheet">
            <div className="esp-cota"><span>Hallazgos</span><span>n mínimo por grupo: 3</span></div>
            <ul className="social-findings">
              {a.findings.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {queue ? (
              <p className="esp-muted">
                {queue} pieza{queue === 1 ? '' : 's'} de Micra esperan en Publicaciones.{' '}
                <button type="button" className="social-link" onClick={() => openTool('publications')}>Abrir Publicaciones</button>
              </p>
            ) : null}
          </div>

          <div className="dash-row">
            <Bars title="Por formato" groups={a.byFormat} label={(k) => FORMATS[k]?.label ?? k} />
            <Bars title="Por pilar" groups={a.byPillar} label={(k) => pillarById(k)?.label ?? 'Sin pilar'} />
            <Bars title="Por día" groups={a.byDay} label={(k) => DAYS[k]} />
            <Bars title="Por franja (hora de Bogotá)" groups={a.bySlot} label={(k) => SLOTS.find((s) => s.id === k)?.label ?? k} />
          </div>

          <div className="dash-sheet">
            <div className="esp-cota"><span>Los 5 que mejor funcionaron</span><span>puntaje = (envíos×3 + guardados×2 + comentarios×1,5 + me gusta) / alcance</span></div>
            {a.top.length === 0 ? <p className="esp-muted">Sin posts con alcance en la ventana.</p> : (
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead><tr><th>Post</th><th>Formato</th><th className="dash-num">Alcance</th><th className="dash-num">Compartidos</th><th className="dash-num">Guardados</th><th className="dash-num">Puntaje</th></tr></thead>
                  <tbody>
                    {a.top.map((p) => (
                      <tr key={p.id}>
                        <td className="social-cap">
                          {p.permalink ? <a href={p.permalink} target="_blank" rel="noopener noreferrer">{p.caption?.slice(0, 80) || 'Sin texto'}</a> : (p.caption?.slice(0, 80) || 'Sin texto')}
                          <span className="esp-muted"> · {fmtDay(p.posted_at)}</span>
                        </td>
                        <td>{FORMATS[p.format]?.label}</td>
                        <td className="dash-num">{num(p.reach)}</td>
                        <td className="dash-num">{pct(p.rates.shares)}</td>
                        <td className="dash-num">{pct(p.rates.saves)}</td>
                        <td className="dash-num">{pct(p.rates.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'crear' && (
        <section aria-label="Crear" className="esp-layout">
          <div className="esp-steps">
            <div className="esp-step">
              <div className="esp-step-head"><span className="esp-step-num">01</span><div><h3 className="esp-step-title">Pilar</h3><p className="esp-step-hint">Lo que cuenta la pieza. Entre paréntesis, cuánto le toca del mes.</p></div></div>
              <div className="esp-chips">
                {PILLARS.map((p) => (
                  <button key={p.id} type="button" aria-pressed={draft.pillar === p.id} className={`esp-chip ${draft.pillar === p.id ? 'active' : ''}`} onClick={() => regen({ pillar: p.id, topic: undefined, series: null })}>
                    {p.label} ({Math.round(p.share * 100)} %)
                  </button>
                ))}
              </div>
            </div>
            <div className="esp-step">
              <div className="esp-step-head"><span className="esp-step-num">02</span><div><h3 className="esp-step-title">Formato</h3></div></div>
              <div className="esp-chips">
                {Object.entries(FORMATS).map(([id, f]) => (
                  <button key={id} type="button" aria-pressed={draft.format === id} className={`esp-chip ${draft.format === id ? 'active' : ''}`} onClick={() => regen({ format: id, topic: draft.topic })} title={f.hint}>{f.label}</button>
                ))}
              </div>
            </div>
            <div className="esp-step">
              <div className="esp-step-head"><span className="esp-step-num">03</span><div><h3 className="esp-step-title">Tema</h3><p className="esp-step-hint">Escoge uno o escribe el tuyo.</p></div></div>
              <input className="esp-input" list="social-topics" aria-label="Tema" value={draft.topic} onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))} />
              <datalist id="social-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
              <div className="esp-actions-row">
                <button type="button" className="esp-btn esp-btn-ghost" onClick={() => regen({ topic: draft.topic })}>Otro gancho</button>
                <button type="button" className="esp-btn esp-btn-ghost" onClick={() => regen({ topic: undefined })}>Otra idea</button>
              </div>
            </div>
          </div>

          <div className="esp-preview" aria-label="La pieza">
            <div className="esp-cota esp-cota-dark">
              <span>{FORMATS[draft.format]?.label} · {FORMATS[draft.format]?.hint}</span>
              <span className="esp-badge">{pillarById(draft.pillar)?.label}</span>
            </div>
            <label className="social-field">
              <span>Gancho (en pantalla)</span>
              <textarea className="esp-input social-hook" rows={2} value={draft.hook} onChange={(e) => setDraft((d) => ({ ...d, hook: e.target.value }))} />
            </label>
            <div className="social-field">
              <span>Guion</span>
              <ol className="social-shots">{draft.shots.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
            <label className="social-field">
              <span>Texto</span>
              <textarea className="esp-input" rows={6} value={draft.caption} onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))} />
            </label>
            <p className="social-tags">{draft.hashtags.join(' ')}</p>
            <div className="esp-actions">
              <button type="button" className="esp-btn esp-btn-primary" onClick={() => copy(postText(draft), 'Texto copiado: pégalo en Instagram.')}>Copiar texto</button>
              <button type="button" className="esp-btn esp-btn-ghost" disabled={ai?.loading} onClick={writeWithAi}>{ai?.loading ? 'Escribiendo…' : 'Escribir con IA'}</button>
              <button type="button" className="esp-btn esp-btn-ghost" onClick={addToWeek}>Agregar a la semana</button>
              <button type="button" className="esp-btn esp-btn-ghost" onClick={() => openTool('espresale')}>Grabar en Micra</button>
            </div>
            {ai?.error && <p className="esp-notice err">{ai.error}</p>}
            {ai?.why && <p className="esp-muted social-why">{ai.why}</p>}
            {ai?.sources?.length > 0 && (
              <ul className="social-sources">{ai.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a></li>)}</ul>
            )}
          </div>
        </section>
      )}

      {tab === 'semana' && (
        <section aria-label="Semana" className="social-stack">
          <div className="social-weekbar">
            <button type="button" className="esp-btn esp-btn-ghost" aria-label="Semana anterior" onClick={() => setMonday((m) => addDays(m, -7))}>‹</button>
            <strong>Semana del {fmtDay(`${monday}T17:00:00Z`)} al {fmtDay(`${addDays(monday, 6)}T17:00:00Z`)}</strong>
            <button type="button" className="esp-btn esp-btn-ghost" aria-label="Semana siguiente" onClick={() => setMonday((m) => addDays(m, 7))}>›</button>
            <span className="social-grow" />
            <button type="button" className="esp-btn esp-btn-primary" onClick={fillWeek}>{plan ? 'Rehacer semana' : 'Armar semana'}</button>
            {plan && <button type="button" className="esp-btn esp-btn-ghost" onClick={() => copy(planText(plan), 'Semana copiada.')}>Copiar</button>}
            {plan && <a className="esp-btn esp-btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(planText(plan))}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          </div>
          <p className="esp-muted">
            Hora sugerida: {bestSlot ? `la franja que mejor te funciona (${SLOTS.find((s) => s.id === bestSlot).label.toLowerCase()})` : '7 p. m., hasta que haya datos para escoger la tuya'}. La semana se guarda en este navegador.
          </p>

          {!plan ? (
            <div className="dash-sheet"><p className="esp-muted">Esta semana todavía no tiene plan. «Armar semana» la llena con el plan: Receta del lunes, Campeón del miércoles, Viernes de calle, dos cortos más, un carrusel e historias.</p></div>
          ) : (
            <>
              <ol className="social-week">
                {plan.map((p, i) => (
                  <li key={p.id} className={`dash-sheet social-day ${p.done ? 'is-done' : ''}`}>
                    <div className="esp-cota"><span>{DAYS[p.day]} {fmtDay(`${p.date}T17:00:00Z`)} · {p.time}</span><span>{FORMATS[p.format]?.label}</span></div>
                    {p.series && <span className="social-series">{p.series}</span>}
                    <p className="social-day-hook">{p.hook}</p>
                    <p className="esp-muted">{pillarById(p.pillar)?.label}</p>
                    <div className="esp-actions-row">
                      <label className="social-check">
                        <input type="checkbox" checked={!!p.done} onChange={() => setPlan(plan.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
                        Publicado
                      </label>
                      <button type="button" className="esp-btn esp-btn-ghost" onClick={() => editFromWeek(p)}>Abrir</button>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="dash-sheet">
                <div className="esp-cota"><span>Mezcla de la semana vs. plan del mes</span><span>{plan.filter((p) => p.done).length}/{plan.length} publicadas</span></div>
                <ul className="dash-rank">
                  {mixOf(plan).map((m, i) => (
                    <li key={m.id}>
                      <span className="dash-rank-idx">{String(i + 1).padStart(2, '0')}</span>
                      <span className="dash-rank-name">{m.label}</span>
                      <span className="dash-rank-track"><span style={{ width: `${Math.round(m.actual * 100)}%` }} /></span>
                      <strong>{Math.round(m.actual * 100)}/{Math.round(m.target * 100)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function Bars({ title, groups, label }) {
  const max = Math.max(...groups.map((g) => g.score ?? 0), 0) || 1;
  return (
    <div className="dash-sheet">
      <div className="esp-cota"><span>{title}</span><span>puntaje · n</span></div>
      <ul className="dash-rank">
        {groups.map((g) => (
          <li key={String(g.key)} className={g.n < 3 ? 'social-few' : ''}>
            <span className="dash-rank-idx">{g.n}</span>
            <span className="dash-rank-name">{label(g.key)}</span>
            <span className="dash-rank-track"><span style={{ width: `${g.score ? Math.round((g.score / max) * 100) : 0}%` }} /></span>
            <strong>{g.score === null ? '—' : Math.round(g.score)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

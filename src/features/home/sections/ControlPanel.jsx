import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { useIsOwner } from '../../admin/useAdminAuth.js';
import { panelState } from '../lib/controlPanel.js';

// El panel ancho (mapa, avisos) va en su propio pedazo: la portada no lo descarga
const ControlRoom = lazy(() => import('./ControlRoom.jsx'));

// El centro de control de Micra en la portada (pedido del usuario, 10 nov 2026): en vez del
// celular, la operación en tiempo real. Cualquiera ve lo público (quién está en la calle entre
// los baristas que aceptaron salir en el mapa y cuántas tazas les apartaron); el dueño ve el día
// completo del equipo, lo que hay que atender y los controles. Se refresca cada 20 s con la
// sección a la vista y la pestaña abierta.
const REFRESH_MS = 20000;
// Las pruebas lo acortan (window.__ctlPollMs) para no esperar 20 s
const pollMs = () => (typeof window !== 'undefined' && Number(window.__ctlPollMs)) || REFRESH_MS;
const money = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export default function ControlPanel({ on, wide = false }) {
  const { t } = useLanguage();
  const p = t('page.panel');
  const isOwner = useIsOwner();
  const [state, setState] = useState(null);
  const [at, setAt] = useState(null);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  // Lo que leyó la última vez, para el panel ancho (el mapa y los avisos lo completan)
  const [places, setPlaces] = useState([]);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const baristas = await rpc('micra_baristas');
      let owner = null, pending = null;
      if (isOwner) {
        owner = await rpc('micra_owner_day').catch(() => null);
        pending = await rpc('micra_posts_pending').then((r) => (r ?? []).length).catch(() => null);
      }
      const next = panelState({ baristas: baristas ?? [], owner, pending });
      setState(next);
      setPlaces(baristas ?? []);
      setAt(new Date());
      setFailed(false);
    } catch {
      setFailed(true);
      setState((s) => s ?? panelState({}));
    } finally {
      busy.current = false;
    }
  }, [isOwner]);

  useEffect(() => {
    if (!on) return undefined;
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, pollMs());
    return () => clearInterval(id);
  }, [on, load]);

  const s = state;
  const k = s?.kpis;
  const max = Math.max(1, ...(s?.week ?? []).map((d) => d.cups || 0));
  const clock = at ? at.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' }) : '…';

  return (
    <section className={`pg-ctl${s?.owner ? ' is-owner' : ''}${wide ? ' is-wide' : ''}`} aria-label={p.label} data-testid="control-panel">
      <header className="pg-ctl-top">
        <p className="pg-ctl-kicker"><i className="is-live" />{p.kicker}</p>
        <span className="pg-ctl-who">{s?.owner ? p.team : p.public}</span>
        <time aria-live="polite">{failed ? p.error : `${p.updated} ${clock}`}</time>
      </header>

      <dl className="pg-ctl-kpis">
        <div className="is-hot"><dd data-testid="ctl-live">{k ? k.live : '–'}</dd><dt>{p.kpis.live}<small> / {k?.baristas ?? '–'} {p.kpis.baristas}</small></dt></div>
        <div><dd data-testid="ctl-waiting">{k ? k.waiting : '–'}</dd><dt>{p.kpis.waiting}</dt></div>
        {s?.owner && <div><dd data-testid="ctl-cups">{k.cups}</dd><dt>{p.kpis.cups}<small> · {k.served} {p.kpis.served}</small></dt></div>}
        {s?.owner && <div><dd>{money(k.total)}</dd><dt>{p.kpis.total}</dt></div>}
      </dl>

      {wide && s && <Suspense fallback={null}><ControlRoom state={s} places={places} at={at} p={p} /></Suspense>}

      <div className="pg-ctl-grid">
        <div className="pg-ctl-card">
          <h3>{p.street}</h3>
          {s && s.rows.filter((r) => r.live).length === 0 && <p className="pg-ctl-empty">{p.empty}</p>}
          <ul className="pg-ctl-list">
            {(s?.rows ?? []).slice(0, wide ? 40 : 6).map((r) => (
              <li key={r.id} className={r.live ? 'is-live' : ''}>
                <i aria-hidden="true" />
                <div><b>{r.name}</b><span>{r.where || '—'}</span></div>
                <em>
                  {!r.live && p.off}
                  {r.waiting > 0 && <> {r.waiting} {p.waitingN}</>}
                  {r.cups > 0 && <> · {r.cups} {p.cupsN}</>}
                </em>
              </li>
            ))}
          </ul>
        </div>

        {s?.owner ? (
          <div className="pg-ctl-card">
            <h3>{p.alertsTitle}</h3>
            {s.alerts.length === 0 ? <p className="pg-ctl-empty">{p.allGood}</p> : (
              <ul className="pg-ctl-alerts">
                {s.alerts.map((a) => <li key={a.key}><a href={a.href}><b>{a.n}</b> {p.alerts[a.key]}</a></li>)}
              </ul>
            )}
            {s.week?.length > 0 && (
              <div className="pg-ctl-week" aria-label={p.week}>
                <small>{p.week}</small>
                <div>{s.week.map((d) => <span key={d.day} style={{ height: `${8 + (92 * (d.cups || 0)) / max}%` }} title={`${d.day}: ${d.cups}`} />)}</div>
              </div>
            )}
            <h3>{p.controls}</h3>
            <nav className="pg-ctl-actions" aria-label={p.controls}>
              {p.actions.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
            </nav>
          </div>
        ) : (
          <div className="pg-ctl-card pg-ctl-lock">
            <h3>{p.controls}</h3>
            <ul className="pg-ctl-ghost" aria-hidden="true">{p.actions.map(([label]) => <li key={label}>{label}</li>)}</ul>
            <p>{p.locked}</p>
            <a className="pg-btn pg-btn--hot" href="/micra/equipo">{p.enter}</a>
          </div>
        )}
      </div>
    </section>
  );
}

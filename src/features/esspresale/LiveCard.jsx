import { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { sortBaristas, windowLabel, menuOf, money, baristaPath } from '../micra-app/micraApp.js';
import { personaSrc } from '../home/sections/StreetPeople.jsx';

// El banner «Pide café» con la app viva: quién está en la calle ahora (las
// mismas fichas públicas de micra_baristas que ve la app) y «Apártame». Sin
// nadie publicado, lo dice y lleva al mapa: nunca un barista de ejemplo.

const CUP = <svg viewBox="0 0 26 24" aria-hidden="true"><path d="M3 4h16v8a8 8 0 0 1-16 0z" /></svg>;

export function useLiveBaristas() {
  const [list, setList] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => supabase.rpc('micra_baristas').then(({ data, error }) => { if (alive) setList(error ? [] : sortBaristas(data ?? [])); }, () => alive && setList([]));
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return list;
}

export default function LiveCard() {
  const { t } = useLanguage();
  const L = t('essp.live');
  const list = useLiveBaristas();
  const out = (list ?? []).filter((b) => b.status === 'live' || b.status === 'usual');
  const b = out[0] ?? null;
  const tinto = b ? menuOf(b).find((m) => m.id === 'tinto') : null;
  const win = b ? windowLabel(b.hora_inicio, b.hora_fin) : null;
  const waiting = b?.waiting ?? 0;
  return (
    <div className="essp-live" aria-label={L.label} data-testid="hero-live">
      <span className="essp-live-tag">{L.label}</span>
      <img className="essp-live-persona" src={personaSrc('aeropress')} alt="" decoding="async" aria-hidden="true" />
      <div className="essp-live-who">
        {list === null ? <span className="essp-live-pill is-wait">…</span> : b ? (
          <>
            <span className="essp-live-pill"><i aria-hidden="true" />{out.length} {b.status === 'live' ? L.live : L.usual}</span>
            <p className="essp-live-name">{b.name}</p>
            <p className="essp-live-place">{[b.referencia || b.localidad, tinto ? `${L.tinto} ${money(tinto.price)}` : null].filter(Boolean).join(' · ')}</p>
            {win && <p className="essp-live-win"><b>{L.passes} {win}</b></p>}
            {waiting > 0 && <p className="essp-live-cups" aria-label={`${waiting}`}>{Array.from({ length: 6 }, (_, i) => <span key={i} className={i < waiting ? 'is-on' : ''}>{CUP}</span>)}</p>}
            <a className="essp-btn" href={b.takes_holds ? baristaPath(b.id) : '/micra'}>{b.takes_holds ? L.hold : L.map}</a>
          </>
        ) : (
          <>
            <span className="essp-live-pill is-off">{L.off}</span>
            <p className="essp-live-place">{L.offText}</p>
            <a className="essp-btn" href="/micra">{L.map}</a>
          </>
        )}
      </div>
      <div className="essp-live-how">
        <p>{L.how}</p>
        <ol>{L.steps.map((s, i) => <li key={s}><b>{i + 1}</b>{s}</li>)}</ol>
      </div>
      <i className="essp-live-anden" aria-hidden="true" />
    </div>
  );
}

/** El banner «Vive del café»: así se ve el día del barista en la app (ejemplo, marcado). */
export function DayCard() {
  const { t } = useLanguage();
  const L = t('essp.live');
  return (
    <div className="essp-live is-day" aria-label={L.dayTag}>
      <span className="essp-live-tag">{L.dayTag} · {L.example}</span>
      <img className="essp-live-persona" src={personaSrc('carrito')} alt="" decoding="async" aria-hidden="true" />
      <div className="essp-live-who">
        <p className="essp-live-cota">{L.streak}</p>
        <p className="essp-live-name">{L.streakN}</p>
        <p className="essp-live-place">{L.streakSub}</p>
        <p className="essp-live-win"><b>{L.goal}</b><br />{L.goalSub}</p>
        <p className="essp-live-coffee">{L.coffee} · <u>{L.order}</u></p>
      </div>
      <i className="essp-live-anden" aria-hidden="true" />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import * as api from './api.js';
import platform from './platform.js';
import { bogota } from './micraApp.js';
import { summarize, aPais, pct, sampleSize, parseLista, sortear, inviteUrl, inviteText, refCode, MUESTRA_META } from './presencia.js';

// Equipo › Hoy › Fincas (9 nov 2026): la presencia digital de las fincas cafeteras, medida.
// La cifra que vale es la de la muestra al azar: una lista que no escogimos (un comité, una
// cooperativa) sorteada aquí con semilla, a cada finca un enlace con &m=1. Lo que llega por
// otros caminos se ve aparte, porque quien encuentra Micra solo ya está en internet.

const n0 = (v) => Math.round(v).toLocaleString('es-CO');

function Cifra({ label, x, base }) {
  const pais = aPais(x);
  return (
    <div className="mapp-fp-cifra">
      <dd>{pct(x.p)}</dd>
      <dt>{label}</dt>
      <small>{x.p == null ? 'Sin respuestas' : `Entre ${pct(x.lo)} y ${pct(x.hi)} · ${x.k} de ${base}`}</small>
      {pais && <small>En el país: {n0(pais.lo)} a {n0(pais.hi)} fincas</small>}
    </div>
  );
}

function Sorteo() {
  const [raw, setRaw] = useState('');
  const [ref, setRef] = useState('');
  const [semilla, setSemilla] = useState(() => `muestra-${bogota().day}`);
  const [n, setN] = useState(MUESTRA_META);
  const [out, setOut] = useState(null);
  const lista = useMemo(() => parseLista(raw), [raw]);
  const code = refCode(ref);
  const url = inviteUrl(platform.siteUrl(''), code, true);
  const run = () => setOut(sortear(lista, Number(n) || MUESTRA_META, semilla));
  return (
    <details className="mapp-fp-tool" data-testid="fp-sorteo">
      <summary>Sortear la muestra</summary>
      <p className="mapp-fine">Pega la lista de un comité o una cooperativa, una finca por línea («nombre, celular»). El sorteo con la misma semilla sale igual: anótala para poder mostrarlo.</p>
      <label className="mapp-field"><span>Lista ({lista.length} fincas)</span><textarea rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} data-testid="fp-lista" /></label>
      <label className="mapp-field"><span>De dónde es la lista (código)</span><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="coop-pitalito" data-testid="fp-ref" /></label>
      <label className="mapp-field"><span>Semilla</span><input value={semilla} onChange={(e) => setSemilla(e.target.value)} /></label>
      <label className="mapp-field"><span>Cuántas</span><input type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} inputMode="numeric" /></label>
      <button type="button" className="mapp-btn is-small" onClick={run} disabled={!lista.length || !code} data-testid="fp-sortear">Sortear</button>
      {out && (
        <ol className="mapp-fp-list" data-testid="fp-sorteadas">
          {out.map((f) => (
            <li key={`${f.nombre}${f.celular ?? ''}`}>
              <span>{f.nombre}</span>
              {f.celular
                ? <a className="mapp-link" href={`https://wa.me/${f.celular}?text=${encodeURIComponent(inviteText({ url, nombre: f.nombre }))}`} target="_blank" rel="noopener noreferrer">WhatsApp ›</a>
                : <small>sin celular</small>}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

function Enlace() {
  const [ref, setRef] = useState('');
  const code = refCode(ref);
  const url = inviteUrl(platform.siteUrl(''), code);
  return (
    <details className="mapp-fp-tool" data-testid="fp-enlace">
      <summary>Enlace para invitar fincas</summary>
      <p className="mapp-fine">Un código por comité, cooperativa o feria para saber quién trajo cada finca. Estas fincas no cuentan en la muestra.</p>
      <label className="mapp-field"><span>Código</span><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="feria-cafes-huila" /></label>
      <p className="mapp-fp-url" data-testid="fp-url">{url}</p>
      <a className="mapp-btn is-small is-ghost" href={`https://wa.me/?text=${encodeURIComponent(inviteText({ url }))}`} target="_blank" rel="noopener noreferrer">Mandar por WhatsApp</a>
    </details>
  );
}

export default function FincasPanel() {
  const [rows, setRows] = useState(null);
  const [state, setState] = useState('cargando');
  const [solo, setSolo] = useState(null);
  useEffect(() => {
    api.fincaPresenciaList()
      .then((r) => { setRows(Array.isArray(r) ? r : []); setState('ok'); })
      .catch((e) => setState(e.missing ? 'falta' : 'error'));
  }, []);
  const hayMuestra = (rows ?? []).some((r) => r.muestra);
  const soloMuestra = solo ?? hayMuestra;
  const s = useMemo(() => summarize(rows ?? [], { soloMuestra }), [rows, soloMuestra]);
  const siInteres = s.interes.find((i) => i.id === 'si')?.k ?? 0;
  return (
    <section className="mapp-glass mapp-fp" aria-label="Fincas en internet" data-testid="fincas-panel">
      <p className="mapp-cota">Fincas en internet</p>
      {state === 'falta' && <p className="mapp-notice" data-testid="fp-falta">Falta aplicar la migración del estudio de fincas (20261109090000). Las respuestas siguen llegando por WhatsApp.</p>}
      {state === 'error' && <p className="mapp-notice">No se pudo leer el estudio de fincas.</p>}
      {state === 'ok' && (
        <>
          <div className="mapp-chips" role="tablist" aria-label="Qué respuestas contar">
            <button type="button" role="tab" aria-selected={soloMuestra} className={soloMuestra ? 'on' : ''} onClick={() => setSolo(true)}>Muestra al azar</button>
            <button type="button" role="tab" aria-selected={!soloMuestra} className={!soloMuestra ? 'on' : ''} onClick={() => setSolo(false)}>Todas</button>
          </div>
          {!soloMuestra && <p className="mapp-fine">Todas las respuestas: quien llega solo a Micra ya está en internet, así que esta cifra sale más alta que la real.</p>}
          <p className="mapp-fine" data-testid="fp-n">{s.n} {s.n === 1 ? 'finca' : 'fincas'}{soloMuestra ? ` de ${MUESTRA_META} para un margen de ±3 puntos` : ''}{soloMuestra && s.faltan ? ` · faltan ${s.faltan}` : ''}</p>
          <dl className="mapp-fp-cifras" data-testid="fp-cifras">
            <Cifra label="con cuenta propia de la finca" x={s.cuenta} base={s.n} />
            <Cifra label="con web o tienda en línea" x={s.web} base={s.n} />
          </dl>
          {s.n > 0 && (
            <>
              <p className="mapp-kicker">Por nivel</p>
              <ul className="mapp-fp-bars">{s.niveles.map((l) => <li key={l.key}><span>{l.label}</span><i style={{ '--w': `${Math.round((l.p ?? 0) * 100)}%` }} /><b>{pct(l.p)}</b></li>)}</ul>
              <p className="mapp-kicker">Lo que más tienen</p>
              <ul className="mapp-fp-bars">{s.canales.filter((c) => c.k).slice(0, 5).map((c) => <li key={c.id}><span>{c.label}</span><i style={{ '--w': `${Math.round((c.k / s.n) * 100)}%` }} /><b>{c.k}</b></li>)}</ul>
              <p className="mapp-kicker">Por departamento</p>
              <ul className="mapp-fp-bars">{s.porDepto.map((d) => <li key={d.departamento}><span>{d.departamento}</span><i style={{ '--w': `${Math.round((d.cuenta / d.n) * 100)}%` }} /><b>{d.cuenta} de {d.n}</b></li>)}</ul>
              <p className="mapp-fine">{siInteres} de {s.n} quieren venderles a baristas · venden a: {s.venta.filter((v) => v.k).map((v) => `${v.label.toLowerCase()} (${v.k})`).join(', ') || '—'}</p>
            </>
          )}
          <p className="mapp-fine">Para ±3 puntos con una cifra cerca del 5 % hacen falta {sampleSize(0.05, 0.03)} fincas al azar; para ±5, {sampleSize(0.05, 0.05)}.</p>
        </>
      )}
      <Sorteo />
      <Enlace />
    </section>
  );
}

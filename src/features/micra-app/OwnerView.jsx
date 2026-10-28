import { useCallback, useEffect, useState } from 'react';
import { money, cupsLabel, weekBars, weekdayLetter, baristaPath } from './micraApp.js';
import * as api from './api.js';
import platform from './platform.js';
import { Cargando } from './Animado.jsx';

// Modo equipo: el día de todos (tazas, plata, apartados, quién está en la
// calle), qué le falta a cada barista para vender por Micra y el código para
// enlazarlo. «Actuar como» abre su modo barista.

const STAGE = { prospecto: 'Prospecto', piloto: 'Piloto', activo: 'Activo', pausa: 'Pausa' };

/** Lo que le falta a un barista para recibir apartados, en orden. */
function missingStep(b) {
  if (!b.public) return 'Falta su permiso para salir en público (ficha › publicidad)';
  if (!b.linked) return 'Falta enlazar su cuenta';
  if (!b.has_prices) return 'Faltan sus precios';
  return null;
}

export default function OwnerView({ onActAs, go }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [codes, setCodes] = useState({});
  const load = useCallback(() => {
    api.ownerDay().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.missing ? 'Falta activar las tablas de Micra en la base (migración 20261026210000_micra_app).' : e.message));
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const makeCode = async (b) => {
    try {
      const r = await api.invite(b.id);
      setCodes((c) => ({ ...c, [b.id]: r.code }));
    } catch (e) { setError(e.message); }
  };
  const sendCode = (b, code) => {
    const url = platform.siteUrl(`/micra/barista?codigo=${code}`);
    platform.openExternal(`https://wa.me/?text=${encodeURIComponent(`Hola, ${b.name.split(' ')[0]}. Este es tu enlace para entrar a Micra: ${url} (tu código es ${code}, vence en 7 días).`)}`);
  };

  if (error && !data) return <p className="mapp-error" role="alert">{error}</p>;
  if (!data) return <Cargando fig="molino">Cargando el día…</Cargando>;

  const list = data.baristas;
  const tot = list.reduce((a, b) => ({ cups: a.cups + b.cups, total: a.total + Number(b.total), waiting: a.waiting + b.waiting, served: a.served + b.served, live: a.live + (b.live_until ? 1 : 0) }), { cups: 0, total: 0, waiting: 0, served: 0, live: 0 });
  const ready = list.filter((b) => !missingStep(b)).length;
  const bars = weekBars(data.week);

  return (
    <div className="mapp-owner">
      <section className="mapp-hello">
        <p className="mapp-kicker">Equipo · hoy</p>
        <h1 className="mapp-title is-small">El día de Micra</h1>
      </section>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <dl className="mapp-kpis">
        <div><dt>Tazas</dt><dd data-testid="owner-cups">{tot.cups}</dd></div>
        <div><dt>Vendido</dt><dd>{money(tot.total)}</dd></div>
        <div><dt>Apartados</dt><dd>{tot.waiting + tot.served}<small> · {tot.served} entregados</small></dd></div>
        <div><dt>En la calle</dt><dd>{tot.live}<small> de {list.length}</small></dd></div>
      </dl>

      <section className="mapp-glass">
        <p className="mapp-cota">Tazas por día · 7 días</p>
        <div className="mapp-week">
          {bars.map((d) => (
            <span key={d.day} className={d.today ? 'is-today' : ''} title={`${d.cups} tazas · ${d.holds} apartados`}>
              <i style={{ height: `${Math.max(4, d.h * 100)}%` }} />
              <small>{weekdayLetter(d.day)}</small>
            </span>
          ))}
        </div>
      </section>

      <section className="mapp-glass">
        <p className="mapp-cota">Baristas · {ready} de {list.length} listos para vender por Micra</p>
        <ul className="mapp-team">
          {list.map((b) => {
            const step = missingStep(b);
            const code = codes[b.id] ?? b.invite_code;
            return (
              <li key={b.id}>
                <div className="mapp-team-head">
                  <b>{b.name}</b>
                  <span className={`mapp-badge is-${b.live_until ? 'live' : 'off'}`}>{b.live_until ? 'En la calle' : STAGE[b.stage] ?? b.stage}</span>
                </div>
                <span className="mapp-muted">{b.referencia || b.localidad || 'Sin lugar'} · {cupsLabel(b.cups)} · {money(b.total)}{b.waiting ? ` · ${b.waiting} esperando` : ''}</span>
                {step && <span className="mapp-todo">{step}</span>}
                <span className="mapp-row-btns">
                  {!b.linked && (code
                    ? <><code className="mapp-code-chip">{code}</code><button type="button" className="mapp-link" onClick={() => sendCode(b, code)}>Enviar por WhatsApp</button></>
                    : <button type="button" className="mapp-link" onClick={() => makeCode(b)}>Generar código</button>)}
                  <button type="button" className="mapp-link" onClick={() => onActAs(b.id)}>Actuar como</button>
                  {b.public && <button type="button" className="mapp-link" onClick={() => go(baristaPath(b.id))}>Su página</button>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <a className="mapp-link" href={platform.siteUrl('/admin')}>Abrir el panel completo</a>
    </div>
  );
}

// Celestra en Equipo › Hoy (antes «Jefe de turno»): la inteligencia de Micra,
// solo para el dueño. Arriba el parte del día con 3 propuestas que el dueño
// aprueba, marca como hechas o descarta (eso es su memoria); abajo, preguntas
// sueltas. Responde /api/micra-agent con las herramientas del servidor MCP de
// Micra (mcp/micra/). Lee; lo único que guarda es su propia memoria.
// Sin 20261111200000_celestra.sql el parte y lo decidido quedan en este celular.
// Dos modos (12 nov 2026, pedido del usuario): «Algoritmo» escribe el parte en el celular con
// reglas (mcp/micra/algoritmo.js), gratis y sin la IA; sin señal usa la última lectura guardada.
// «Con IA» llama a /api/micra-agent; si no responde, escribe el algoritmo y lo dice.
// Y el juego (celestraJuego.js): puntos por decidir y hacer, nivel, racha y el camino a la meta.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { apiUrl } from '../../shared/lib/apiBase.js';
import { TOPE_USD } from '../../../mcp/micra/celestra.js';
import { decideLocal, localEstado, saveLocalParte } from './celestraLocal.js';
import { parteAlgoritmo, responder } from '../../../mcp/micra/algoritmo.js';
import { lecturasDeHoy } from './celestraSource.js';
import { META, avance, camino, ganado, juego, statsFromEstado } from './celestraJuego.js';

const MODO_KEY = 'micra_celestra_modo';
const readModo = () => { try { return window.localStorage.getItem(MODO_KEY) === 'ia' ? 'ia' : 'algoritmo'; } catch { return 'algoritmo'; } };

const SUGGESTIONS = ['¿Cómo vamos hoy?', '¿Dónde voy a encuestar?', '¿Cómo les va a los apartados?', '¿Cómo está el precio del café?'];
const TOOL_LABEL = {
  estudio_resumen: 'estudio', encuestas_pendientes: 'encuestas pendientes', mapa_en_vivo: 'mapa en vivo', dia_del_equipo: 'día del equipo',
  apartados: 'apartados', precio_cafe: 'precio del café', fincas: 'fincas',
};
const OFICIO = { estudio: 'Estudio', calle: 'Calle', clientes: 'Clientes', mercado: 'Mercado', fincas: 'Fincas', equipo: 'Equipo' };
const ESTADO = { aprobada: 'Aprobada', hecha: 'Hecha', descartada: 'Descartada' };

const bogotaDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const usd = (v) => `US$${Number(v ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const store = () => { try { return window.localStorage; } catch { return null; } };

async function post(body) {
  const { data: { session } } = await supabase.auth.getSession();
  let res;
  try {
    res = await fetch(apiUrl('/api/micra-agent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    });
  } catch {
    // Sin señal o el sitio no respondió: el navegador solo dice «Load failed»
    throw new Error('No se pudo hablar con Celestra. Revisa la señal e intenta de nuevo.');
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || 'No respondió. Intenta de nuevo.'), { estado: out.estado });
  return out;
}

/** La estrella térmica de Celestra: frío afuera, el núcleo caliente. */
export function CelestraStar({ size = 44 }) {
  return (
    <svg className="mapp-celestra-star" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="celestra-heat" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--t-7, #FFF3B0)" />
          <stop offset=".22" stopColor="var(--t-6, #FFC23C)" />
          <stop offset=".45" stopColor="var(--t-5, #F2542D)" />
          <stop offset=".65" stopColor="var(--t-4, #DE1B1B)" />
          <stop offset=".85" stopColor="var(--t-3, #B0127A)" />
          <stop offset="1" stopColor="var(--t-2, #5A1E9E)" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="var(--t-0, #0D0820)" />
      <path d="M24 5 C25.6 17 31 22.4 43 24 C31 25.6 25.6 31 24 43 C22.4 31 17 25.6 5 24 C17 22.4 22.4 17 24 5 Z" fill="url(#celestra-heat)" />
      <circle cx="24" cy="24" r="3.2" fill="var(--t-7, #FFF3B0)" />
    </svg>
  );
}

function Propuesta({ p, busy, onDecide }) {
  const [descartando, setDescartando] = useState(false);
  const [nota, setNota] = useState('');
  const decided = p.estado && p.estado !== 'pendiente';
  return (
    <li className={`mapp-celestra-prop${decided ? ` is-${p.estado}` : ''}`} data-testid="celestra-prop">
      <p className="mapp-celestra-oficio">{OFICIO[p.oficio] ?? 'Equipo'}{decided && <b> · {ESTADO[p.estado]}</b>}</p>
      <p className="mapp-celestra-titulo">{p.titulo}</p>
      <p className="mapp-celestra-why">{p.por_que}</p>
      {p.accion && <p className="mapp-celestra-accion">Hoy: {p.accion}</p>}
      {p.nota && <p className="mapp-fine">Tu nota: {p.nota}</p>}
      {!decided && !descartando && (
        <div className="mapp-celestra-acts">
          <button type="button" className="mapp-btn is-small is-cta" disabled={busy} onClick={() => onDecide(p, 'aprobada')}>Aprobar</button>
          <button type="button" className="mapp-btn is-small is-ghost" disabled={busy} onClick={() => onDecide(p, 'hecha')}>Ya la hice</button>
          <button type="button" className="mapp-btn is-small is-ghost" disabled={busy} onClick={() => setDescartando(true)}>Descartar</button>
        </div>
      )}
      {!decided && descartando && (
        <form className="mapp-celestra-acts" onSubmit={(e) => { e.preventDefault(); onDecide(p, 'descartada', nota); }}>
          <label className="mapp-field">
            <span>¿Por qué no? (opcional, Celestra lo recuerda)</span>
            <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Ya fuimos, no aplica…" />
          </label>
          <button type="submit" className="mapp-btn is-small" disabled={busy}>Descartar</button>
          <button type="button" className="mapp-btn is-small is-ghost" onClick={() => setDescartando(false)}>Volver</button>
        </form>
      )}
      {decided && p.estado === 'aprobada' && (
        <div className="mapp-celestra-acts">
          <button type="button" className="mapp-btn is-small is-ghost" disabled={busy} onClick={() => onDecide(p, 'hecha')}>Ya la hice</button>
        </div>
      )}
    </li>
  );
}

export default function Celestra() {
  const today = bogotaDay();
  const [estado, setEstado] = useState(null); // la forma de celestra_estado(), o la del celular (local: true)
  const [writing, setWriting] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState([]); // { q, answer, tools }
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modo, setModo] = useState(readModo);
  const [lect, setLect] = useState(null); // { l, redes, tienda, cached }: lo que lee el algoritmo
  const [historia, setHistoria] = useState(null); // celestra_juego(), o null si no está en la base
  const [gano, setGano] = useState(0);

  const loadHistoria = useCallback(() => {
    supabase.rpc('celestra_juego').then(({ data, error: e }) => setHistoria(!e && data ? data : null), () => setHistoria(null));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      let next;
      try {
        const { data, error: e } = await supabase.rpc('celestra_estado');
        next = !e && data ? data : null;
      } catch { next = null; }
      const mine = localEstado(store(), today);
      // Lo escrito sin señal sube a la base al volver: el parte y, por posición, lo decidido
      if (next && !next.parte && mine.parte) {
        try {
          const { data, error: e } = await supabase.rpc('celestra_guardar', { p: { kind: 'parte', model: 'algoritmo', cost_usd: 0, tools: [], parte: mine.parte } });
          if (!e && data?.parte) {
            next = data;
            for (const lp of mine.parte.propuestas.filter((x) => x.estado !== 'pendiente')) {
              const id = next.parte.propuestas.find((x) => x.pos === lp.pos)?.id;
              if (!id) continue;
              const r = await supabase.rpc('celestra_decidir', { p_id: id, p_estado: lp.estado, p_nota: lp.nota });
              if (!r.error && r.data) next = r.data;
            }
          }
        } catch { /* sigue con lo de la base */ }
      }
      if (!alive) return;
      setEstado(next ?? mine);
      if (next) loadHistoria();
    })();
    lecturasDeHoy(store()).then((b) => alive && setLect(b), () => {});
    return () => { alive = false; };
  }, [today, loadHistoria]);

  const local = estado?.local === true;
  const parte = estado?.parte ?? null;
  const over = !local && Number(estado?.gastado_mes ?? 0) >= TOPE_USD;
  const conIa = modo === 'ia' && !over;
  const j = juego(historia ?? statsFromEstado(estado ?? {}), today);
  const tramos = lect ? camino(lect.l, lect) : [];
  const pctCamino = avance(tramos);

  function pickModo(m) {
    setModo(m);
    try { window.localStorage.setItem(MODO_KEY, m); } catch { /* sin espacio: vale por esta vez */ }
  }

  // El parte del algoritmo: se arma aquí y se guarda en la base (costo 0) o, sin ella, en el celular
  async function writeAlgoritmo() {
    const b = await lecturasDeHoy(store());
    setLect(b);
    const p = parteAlgoritmo(b.l, { today, decisions: estado?.decisiones ?? [], redes: b.redes, tienda: b.tienda, cached: b.cached });
    if (!local) {
      try {
        const { data, error: e } = await supabase.rpc('celestra_guardar', { p: { kind: 'parte', model: 'algoritmo', cost_usd: 0, tools: [], parte: { resumen: p.resumen, propuestas: p.propuestas } } });
        if (!e && data?.parte) { setEstado(data); loadHistoria(); return; }
      } catch { /* sin señal: queda en el celular */ }
    }
    setEstado(saveLocalParte(store(), today, p));
  }

  async function writeParte() {
    if (writing) return;
    setWriting(true);
    setError('');
    setAviso('');
    try {
      if (!conIa) await writeAlgoritmo();
      else {
        try {
          const out = await post({ action: 'parte', decisions: local ? estado.decisiones : undefined });
          if (out.estado) { setEstado(out.estado); loadHistoria(); } else if (out.parte) setEstado(saveLocalParte(store(), today, out.parte));
        } catch (err) {
          if (err.estado) setEstado(err.estado);
          await writeAlgoritmo();
          setAviso(`La IA no respondió (${err.message}) Lo escribió el algoritmo.`);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setWriting(false);
    }
  }

  async function decide(p, next, nota = '') {
    setDeciding(true);
    setError('');
    try {
      const pendientes = (parte?.propuestas ?? []).filter((x) => x.estado === 'pendiente');
      const sumar = ganado(next, { ultima: pendientes.length === 1 && pendientes[0].id === p.id }) - (p.estado === 'aprobada' ? ganado('aprobada') : 0);
      if (local) setEstado(decideLocal(store(), today, p.id, next, nota.trim() || null));
      else {
        const { data, error: e } = await supabase.rpc('celestra_decidir', { p_id: p.id, p_estado: next, p_nota: nota.trim() || null });
        if (e) throw new Error('No se guardó tu decisión. Intenta de nuevo.');
        setEstado(data);
        loadHistoria();
      }
      setGano(sumar);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeciding(false);
    }
  }

  async function ask(text) {
    const q = String(text ?? question).trim();
    if (!q || asking) return;
    setAsking(true);
    setError('');
    try {
      if (!conIa) {
        const b = lect ?? await lecturasDeHoy(store());
        if (!lect) setLect(b);
        const r = responder(q, b.l);
        if (!r) throw new Error('Esa pregunta necesita la IA: el algoritmo responde las cuatro de arriba. Cambia a «Con IA».');
        setTurns((t) => [...t, { q, answer: r.answer, tools: r.tools }].slice(-4));
        setQuestion('');
        return;
      }
      const history = turns.flatMap((t) => [{ role: 'user', content: t.q }, { role: 'assistant', content: t.answer }]);
      const out = await post({ question: q, history });
      if (out.estado) setEstado(out.estado);
      setTurns((t) => [...t, { q, answer: out.answer, tools: out.tools ?? [] }].slice(-4));
      setQuestion('');
    } catch (err) {
      if (err.estado) setEstado(err.estado);
      setError(err.message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="mapp-glass mapp-jefe mapp-celestra" aria-label="Celestra" data-testid="owner-agent">
      <header className="mapp-celestra-head">
        <CelestraStar />
        <div>
          <p className="mapp-celestra-name">Celestra</p>
          <p className="mapp-fine">Lee Micra, te propone. Tú decides.</p>
        </div>
      </header>

      <div className="mapp-celestra-juego" data-testid="celestra-juego">
        <div className="mapp-celestra-nivel">
          <p><b>Nivel {j.nivel.n} · {j.nivel.nombre}</b>{gano > 0 && <span className="mapp-celestra-gano" role="status"> +{gano} puntos</span>}</p>
          <p className="mapp-fine">{j.xp} puntos{j.nivel.siguiente ? ` · faltan ${j.nivel.faltan} para ${j.nivel.siguiente}` : ''}{j.racha > 0 ? ` · racha de ${j.racha} ${j.racha === 1 ? 'día' : 'días'}` : ''}</p>
        </div>
        <div className="mapp-celestra-bar" role="progressbar" aria-label="Avance del nivel" aria-valuemin={0} aria-valuemax={100} aria-valuenow={j.nivel.pct}><i style={{ width: `${j.nivel.pct}%` }} /></div>
        {tramos.length > 0 && (
          <details className="mapp-celestra-camino" data-testid="celestra-camino">
            <summary>Camino al {META}{pctCamino != null ? ` · ${pctCamino} %` : ''}</summary>
            <ul>
              {tramos.map((t) => (
                <li key={t.id} className={t.valor == null ? 'is-off' : ''}>
                  <span>{t.nombre}</span>
                  <div className="mapp-celestra-bar"><i style={{ width: `${t.pct}%` }} /></div>
                  <small>{t.texto}</small>
                </li>
              ))}
            </ul>
            <p className="mapp-fine">Cada tramo sale de un dato real de Micra. Las metas son un primer listón.</p>
          </details>
        )}
      </div>

      <div className="mapp-celestra-modo" role="group" aria-label="Cómo escribe Celestra">
        <button type="button" className={modo === 'algoritmo' ? 'on' : ''} aria-pressed={modo === 'algoritmo'} onClick={() => pickModo('algoritmo')} data-testid="celestra-modo-algoritmo">Algoritmo</button>
        <button type="button" className={modo === 'ia' ? 'on' : ''} aria-pressed={modo === 'ia'} onClick={() => pickModo('ia')} data-testid="celestra-modo-ia">Con IA</button>
      </div>

      <div className="mapp-celestra-parte" data-testid="celestra-parte">
        <p className="mapp-cota">Parte de hoy</p>
        {!estado && <p className="mapp-fine">Cargando…</p>}
        {estado && !parte && (
          <>
            <p className="mapp-fine">Celestra lee el día, el estudio, los apartados y el mercado, y te deja 3 propuestas.</p>
            <button type="button" className="mapp-btn is-cta" disabled={writing} onClick={writeParte} data-testid="celestra-write">
              {writing ? 'Celestra está leyendo Micra…' : 'Escribir el parte de hoy'}
            </button>
          </>
        )}
        {parte && (
          <>
            <p className="mapp-celestra-resumen">{parte.resumen}</p>
            <ol className="mapp-celestra-props">
              {(parte.propuestas ?? []).map((p) => <Propuesta key={p.id} p={p} busy={deciding} onDecide={decide} />)}
            </ol>
          </>
        )}
      </div>

      {turns.map((t, i) => (
        <div key={i} className="mapp-jefe-turn" data-testid="agent-turn">
          <p className="mapp-jefe-q">{t.q}</p>
          <p className="mapp-jefe-a">{t.answer}</p>
          {t.tools.length > 0 && <p className="mapp-fine">Leyó: {t.tools.map((x) => TOOL_LABEL[x] ?? x).join(', ')}</p>}
        </div>
      ))}
      {turns.length === 0 && (
        <div className="mapp-chips is-wrap">
          {SUGGESTIONS.map((s) => <button key={s} type="button" disabled={asking} onClick={() => ask(s)}>{s}</button>)}
        </div>
      )}
      <form className="mapp-jefe-form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <label className="mapp-field">
          <span>Pregúntale a Celestra</span>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={600} placeholder="¿Quién no ha salido hoy?" data-testid="agent-input" />
        </label>
        <button type="submit" className="mapp-btn is-small is-cta" disabled={asking || !question.trim()}>{asking ? 'Pensando…' : 'Preguntar'}</button>
      </form>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      {aviso && <p className="mapp-fine" role="status" data-testid="celestra-aviso">{aviso}</p>}
      <p className="mapp-fine" data-testid="celestra-gasto">
        {local
          ? 'El parte y tus decisiones se guardan solo en este celular; suben a la base cuando vuelva la señal.'
          : `Este mes: ${usd(estado?.gastado_mes)} de ${usd(TOPE_USD)}${over ? ' · llegó al tope: sigue el algoritmo' : ''}. Solo lee: no cambia nada en Micra.`}
        {!conIa && ' El algoritmo no gasta.'}{lect?.cached && ' Sin señal: usa la última lectura guardada.'}
      </p>
    </section>
  );
}

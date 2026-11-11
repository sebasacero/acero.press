// Celestra en Equipo › Hoy (antes «Jefe de turno»): la inteligencia de Micra,
// solo para el dueño. Arriba el parte del día con 3 propuestas que el dueño
// aprueba, marca como hechas o descarta (eso es su memoria); abajo, preguntas
// sueltas. Responde /api/micra-agent con las herramientas del servidor MCP de
// Micra (mcp/micra/). Lee; lo único que guarda es su propia memoria.
// Sin 20261111200000_celestra.sql el parte y lo decidido quedan en este celular.
import { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { apiUrl } from '../../shared/lib/apiBase.js';
import { TOPE_USD } from '../../../mcp/micra/celestra.js';
import { decideLocal, localEstado, saveLocalParte } from './celestraLocal.js';

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
  const res = await fetch(apiUrl('/api/micra-agent'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  });
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

  useEffect(() => {
    let alive = true;
    supabase.rpc('celestra_estado').then(({ data, error: e }) => {
      if (!alive) return;
      setEstado(!e && data ? data : localEstado(store(), today));
    }, () => alive && setEstado(localEstado(store(), today)));
    return () => { alive = false; };
  }, [today]);

  const local = estado?.local === true;
  const parte = estado?.parte ?? null;
  const over = !local && Number(estado?.gastado_mes ?? 0) >= TOPE_USD;

  async function writeParte() {
    if (writing) return;
    setWriting(true);
    setError('');
    try {
      const out = await post({ action: 'parte', decisions: local ? estado.decisiones : undefined });
      if (out.estado) setEstado(out.estado);
      else if (out.parte) setEstado(saveLocalParte(store(), today, out.parte));
    } catch (err) {
      if (err.estado) setEstado(err.estado);
      setError(err.message);
    } finally {
      setWriting(false);
    }
  }

  async function decide(p, next, nota = '') {
    setDeciding(true);
    setError('');
    try {
      if (local) setEstado(decideLocal(store(), today, p.id, next, nota.trim() || null));
      else {
        const { data, error: e } = await supabase.rpc('celestra_decidir', { p_id: p.id, p_estado: next, p_nota: nota.trim() || null });
        if (e) throw new Error('No se guardó tu decisión. Intenta de nuevo.');
        setEstado(data);
      }
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

      <div className="mapp-celestra-parte" data-testid="celestra-parte">
        <p className="mapp-cota">Parte de hoy</p>
        {!estado && <p className="mapp-fine">Cargando…</p>}
        {estado && !parte && (
          <>
            <p className="mapp-fine">Celestra lee el día, el estudio, los apartados y el mercado, y te deja 3 propuestas.</p>
            <button type="button" className="mapp-btn is-cta" disabled={writing || over} onClick={writeParte} data-testid="celestra-write">
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
          {SUGGESTIONS.map((s) => <button key={s} type="button" disabled={asking || over} onClick={() => ask(s)}>{s}</button>)}
        </div>
      )}
      <form className="mapp-jefe-form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <label className="mapp-field">
          <span>Pregúntale a Celestra</span>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={600} placeholder="¿Quién no ha salido hoy?" data-testid="agent-input" />
        </label>
        <button type="submit" className="mapp-btn is-small is-cta" disabled={asking || over || !question.trim()}>{asking ? 'Pensando…' : 'Preguntar'}</button>
      </form>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <p className="mapp-fine" data-testid="celestra-gasto">
        {local
          ? 'El parte y tus decisiones se guardan solo en este celular hasta aplicar la memoria de Celestra en la base; el tope del mes aún no se cuenta.'
          : `Este mes: ${usd(estado?.gastado_mes)} de ${usd(TOPE_USD)}${over ? ' · llegó al tope' : ''}. Solo lee: no cambia nada en Micra.`}
      </p>
    </section>
  );
}

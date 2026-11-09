// «Jefe de turno» en Equipo › Hoy: el dueño le pregunta a Claude por el día,
// el mapa, el estudio o el precio del café. Responde /api/micra-agent con las
// herramientas del servidor MCP de Micra (mcp/micra/). Solo lee.
import { useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { apiUrl } from '../../shared/lib/apiBase.js';

const SUGGESTIONS = ['¿Cómo vamos hoy?', '¿Dónde buscan café ahora?', '¿Qué dice el estudio del precio del tinto?', '¿Cómo está el precio del café?'];
const TOOL_LABEL = { estudio_resumen: 'estudio', mapa_en_vivo: 'mapa en vivo', dia_del_equipo: 'día del equipo', precio_cafe: 'precio del café' };

export default function JefeDeTurno() {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState([]); // { q, answer, tools }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function ask(text) {
    const q = String(text ?? question).trim();
    if (!q || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const history = turns.flatMap((t) => [{ role: 'user', content: t.q }, { role: 'assistant', content: t.answer }]);
      const res = await fetch(apiUrl('/api/micra-agent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ question: q, history }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No respondió. Intenta de nuevo.');
      setTurns((t) => [...t, { q, answer: body.answer, tools: body.tools ?? [] }].slice(-4));
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mapp-glass mapp-jefe" aria-label="Jefe de turno" data-testid="owner-agent">
      <p className="mapp-cota">Jefe de turno · pregúntale</p>
      {turns.length === 0 && (
        <div className="mapp-chips is-wrap">
          {SUGGESTIONS.map((s) => <button key={s} type="button" disabled={busy} onClick={() => ask(s)}>{s}</button>)}
        </div>
      )}
      {turns.map((t, i) => (
        <div key={i} className="mapp-jefe-turn" data-testid="agent-turn">
          <p className="mapp-jefe-q">{t.q}</p>
          <p className="mapp-jefe-a">{t.answer}</p>
          {t.tools.length > 0 && <p className="mapp-fine">Leyó: {t.tools.map((x) => TOOL_LABEL[x] ?? x).join(', ')}</p>}
        </div>
      ))}
      <form className="mapp-jefe-form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <label className="mapp-field">
          <span>Tu pregunta</span>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={600} placeholder="¿Quién no ha salido hoy?" data-testid="agent-input" />
        </label>
        <button type="submit" className="mapp-btn is-small is-cta" disabled={busy || !question.trim()}>{busy ? 'Pensando…' : 'Preguntar'}</button>
      </form>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <p className="mapp-fine">Solo lee: no cambia nada en Micra.</p>
    </section>
  );
}

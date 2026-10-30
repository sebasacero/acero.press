import { useEffect, useState } from 'react';
import * as api from './api.js';
import platform from './platform.js';

// La tarjeta de sellos del cliente y el pago directo al barista (Nequi,
// Daviplata). Si la base aún no tiene sus funciones, no se muestran.

/** Cada taza entregada es un sello; con 10, un tinto gratis que el barista canjea al entregar. */
export function StampsCard() {
  const [s, setS] = useState(null);
  useEffect(() => { api.myStamps().then(setS).catch(() => setS(null)); }, []);
  // Sin datos de sellos (o con una respuesta rara) no se muestra la tarjeta
  if (!s || !Number.isFinite(s.toward)) return null;
  const per = s.per ?? 10;
  return (
    <section className="mapp-glass mapp-stamps" aria-label="Tus sellos" data-testid="stamps">
      <p className="mapp-cota">Tu tarjeta · {per} tazas = 1 tinto gratis<b>{s.toward} de {per}</b></p>
      <ol className="mapp-stamps-row" aria-label={`${s.toward} de ${per} sellos`}>
        {Array.from({ length: per }, (_, i) => (
          <li key={i} className={`${i < s.toward ? 'on' : ''} ${i === per - 1 ? 'is-gift' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 24 26"><path d="M3 6h15v9a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7z" /><path d="M18 9h2a3 3 0 0 1 0 6h-2" /></svg>
          </li>
        ))}
      </ol>
      {s.available > 0
        ? <p className="mapp-stamps-free" role="status">🎁 Tienes {s.available === 1 ? 'un tinto gratis' : `${s.available} tintos gratis`}: díselo a tu barista al recibir.</p>
        : <p className="mapp-muted">{s.cups === 0 ? 'Aparta y recoge tus tintos: cada taza entregada suma un sello.' : `Te faltan ${per - s.toward} para tu tinto gratis.`}</p>}
    </section>
  );
}

const pretty = (n) => `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;

/** Pagarle directo al barista: su número y un botón para copiarlo (el dinero no pasa por Micra). */
export function PayBarista({ id, name, total }) {
  const [p, setP] = useState(null);
  const [copied, setCopied] = useState(null);
  useEffect(() => { api.baristaPay(id).then(setP).catch(() => setP(null)); }, [id]);
  if (!p || (!p.nequi && !p.daviplata)) return null;
  const copy = async (k, n) => {
    try { await navigator.clipboard.writeText(n); setCopied(k); setTimeout(() => setCopied(null), 2500); } catch { /* sin portapapeles: el número se ve igual */ }
  };
  const open = (k) => platform.openExternal(k === 'nequi' ? 'https://www.nequi.com.co/' : 'https://www.daviplata.com/');
  return (
    <section className="mapp-glass mapp-pay" aria-label={`Pagarle a ${name}`} data-testid="pay-barista">
      <p className="mapp-cota">Págale directo{total ? ` · ${total}` : ''}</p>
      {[['nequi', 'Nequi'], ['daviplata', 'Daviplata']].filter(([k]) => p[k]).map(([k, label]) => (
        <div key={k} className="mapp-pay-row">
          <span><b>{label}</b> {pretty(p[k])}</span>
          <span className="mapp-row-btns">
            <button type="button" className="mapp-btn is-small" onClick={() => copy(k, p[k])}>{copied === k ? '✓ Copiado' : 'Copiar'}</button>
            <button type="button" className="mapp-link" onClick={() => open(k)}>Abrir {label}</button>
          </span>
        </div>
      ))}
      <p className="mapp-fine">El pago va directo de tu cuenta a la de {name}; Micra no lo cobra ni lo guarda.</p>
    </section>
  );
}

/** El barista pone sus números para que le paguen por Nequi o Daviplata. */
export function PaySettings({ day, asId, onSaved }) {
  const [nequi, setNequi] = useState(day.pay_nequi ?? '');
  const [davi, setDavi] = useState(day.pay_daviplata ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try { await api.setPay({ nequi, daviplata: davi }, asId); setMsg({ ok: true, text: 'Listo: tus clientes ya ven cómo pagarte.' }); onSaved?.(); } catch (err) { setMsg({ ok: false, text: err.missing ? 'Los pagos abren muy pronto.' : err.message }); }
    setBusy(false);
  };
  return (
    <form className="mapp-glass" onSubmit={save} data-testid="pay-settings">
      <p className="mapp-cota">Cómo te pagan</p>
      <p className="mapp-muted">Tus clientes ven tu número para pagarte directo. Déjalo vacío si no usas esa app.</p>
      <label className="mapp-field"><span>Nequi</span><input type="tel" inputMode="numeric" placeholder="300 123 4567" value={nequi} onChange={(e) => setNequi(e.target.value)} /></label>
      <label className="mapp-field"><span>Daviplata</span><input type="tel" inputMode="numeric" placeholder="300 123 4567" value={davi} onChange={(e) => setDavi(e.target.value)} /></label>
      {msg && <p className={msg.ok ? 'mapp-notice' : 'mapp-error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <button type="submit" className="mapp-btn is-small" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
    </form>
  );
}

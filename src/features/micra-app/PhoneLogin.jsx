import { useEffect, useState } from 'react';
import * as api from './api.js';
import platform from './platform.js';
import { normalizeCoPhone, formatCoPhone, cleanOtp, resendIn, smsError } from './phone.js';

// La entrada del barista por SMS (BaristaJoin la carga aparte): el número, el
// código y, si su número no está, el WhatsApp del equipo.

/** El botón al WhatsApp del equipo, con el número que escribió (para que lo agreguen). */
export function TeamWhatsApp({ phone }) {
  const [number, setNumber] = useState(null);
  useEffect(() => { let alive = true; api.teamWhatsApp().then((n) => alive && setNumber(n)); return () => { alive = false; }; }, []);
  if (!number) return null;
  const text = `Hola, soy barista y quiero entrar a Micra${phone ? ` con mi celular ${formatCoPhone(phone)}` : ''}.`;
  return <button type="button" className="mapp-link" onClick={() => platform.openExternal(`https://wa.me/${number}?text=${encodeURIComponent(text)}`)}>Escribirle al equipo por WhatsApp</button>;
}

/**
 * Entrar con el celular: el número, el SMS y los seis números. Sin enlaces ni
 * ida y vuelta por el navegador (igual en la app instalada). Con `preview` es
 * la vista del equipo: se ve igual, pero no manda SMS ni cambia su sesión.
 */
export default function PhoneLogin({ preview = false }) {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const e164 = normalizeCoPhone(phone);
  const wait = resendIn(sentAt, now);
  useEffect(() => {
    if (step !== 'code' || !wait) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step, wait]);

  const send = async (e) => {
    e?.preventDefault();
    setError(null);
    if (!e164) { setError('Escribe tu celular: son 10 números y empieza por 3.'); return; }
    if (preview) { setNote('Vista del equipo: aquí el barista recibe un SMS con su código. No se mandó nada.'); setStep('code'); setSentAt(Date.now()); setNow(Date.now()); return; }
    setBusy(true);
    try {
      await api.sendSmsCode(e164);
      setStep('code');
      setCode('');
      setSentAt(Date.now());
      setNow(Date.now());
    } catch (err) { setError(smsError(err)); }
    setBusy(false);
  };
  const verify = async (token) => {
    if (busy || token.length !== 6) return;
    setError(null);
    if (preview) { setNote('Vista del equipo: con el código, el barista entra directo a su inicio. Para verlo, usa «Actuar como» en Equipo.'); return; }
    setBusy(true);
    // Con la sesión, MicraApp vuelve a montar BaristaJoin y busca su perfil por el número
    try { await api.verifySmsCode(e164, token); } catch (err) { setError(smsError(err)); setBusy(false); }
  };

  if (step === 'code') {
    return (
      <form className="mapp-phone-login" onSubmit={(e) => { e.preventDefault(); verify(code); }} data-testid="sms-code">
        <p className="mapp-lede">Te mandamos un SMS al <b>{formatCoPhone(phone)}</b>. Escribe los seis números.</p>
        <label className="mapp-field">
          <span>Código del SMS</span>
          <input
            className="mapp-code" value={code} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" autoFocus
            onChange={(e) => { const v = cleanOtp(e.target.value); setCode(v); if (v.length === 6) verify(v); }}
          />
        </label>
        {error && <p className="mapp-error" role="alert">{error}</p>}
        {note && <p className="mapp-notice" role="status">{note}</p>}
        <button type="submit" className="mapp-btn is-cta" disabled={busy || code.length !== 6}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <span className="mapp-row-btns">
          <button type="button" className="mapp-link" disabled={busy || wait > 0} onClick={() => send()}>{wait > 0 ? `Reenviar en ${wait} s` : 'Reenviar el código'}</button>
          <button type="button" className="mapp-link" onClick={() => { setStep('phone'); setCode(''); setError(null); setNote(null); }}>Cambiar número</button>
        </span>
      </form>
    );
  }
  return (
    <form className="mapp-phone-login" onSubmit={send} data-testid="sms-phone">
      <label className="mapp-field">
        <span>Tu celular</span>
        <span className="mapp-phone">
          <i>+57</i>
          <input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="300 123 4567" value={phone} onChange={(e) => setPhone(formatCoPhone(e.target.value))} aria-label="Tu celular" />
        </span>
      </label>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <button type="submit" className="mapp-btn is-cta" disabled={busy || !e164}>{busy ? 'Enviando…' : 'Enviarme el código'}</button>
      <p className="mapp-fine">Te llega un SMS con seis números. Usa el celular que le diste al equipo de Micra.</p>
    </form>
  );
}

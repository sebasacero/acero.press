import { useEffect, useRef } from 'react';
import Termo from './Termo.jsx';

// El «globito»: el aviso que baja arriba de la pantalla como una notificación
// del celular (el termo, el título, una línea y «ahora»). Se toca para ir a lo
// que avisa, se cierra con la X y se va solo a los 9 s. Lo que dice sale de
// alerts.js.

/**
 * Un tono corto de dos notas y una vibración, si el celular lo deja. El
 * navegador no deja vibrar ni sonar antes del primer toque en la página: ahí
 * solo sale el globito.
 */
export function ping() {
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { navigator.vibrate?.([80, 60, 80]); } catch { /* sin vibración */ }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ping.ctx = ping.ctx ?? new Ctx();
    const ctx = ping.ctx;
    ctx.resume?.().catch(() => {});
    [[880, 0], [1175, 0.14]].forEach(([f, t]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const at = ctx.currentTime + t;
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(at);
      o.stop(at + 0.25);
    });
  } catch { /* sin sonido */ }
}

export default function Globito({ title, body, onOpen, onClose, ms = 9000 }) {
  // Con la última función de cerrar, sin reiniciar el tiempo en cada pintada
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const id = setTimeout(() => close.current?.(), ms);
    return () => clearTimeout(id);
  }, [title, body, ms]);
  return (
    <div className="mapp-globito" role="status" aria-live="polite" data-testid="globito">
      <button type="button" className="mapp-globito-main" onClick={onOpen}>
        <span className="mapp-globito-ico" aria-hidden="true"><Termo /></span>
        <span className="mapp-globito-copy"><b>{title}</b><span>{body}</span></span>
        <small>ahora</small>
      </button>
      <button type="button" className="mapp-globito-x" onClick={onClose} aria-label="Cerrar aviso">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

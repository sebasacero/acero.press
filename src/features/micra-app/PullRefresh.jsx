import { useEffect, useRef, useState } from 'react';
import { pullProgress } from './alerts.js';
import Termo from './Termo.jsx';

// «Desliza para recargar»: con la pantalla arriba del todo, arrastrar hacia
// abajo baja el termo; al soltar pasado el punto, recarga (onRefresh) y gira
// mientras tanto. Solo con el dedo, en vertical y sin hojas abiertas, para no
// pelear con las filas que se deslizan de lado ni con los formularios.

export default function PullRefresh({ onRefresh, disabled = false }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef(null);
  const dyRef = useRef(0);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    if (disabled || busy) return undefined;
    const blocked = () => window.scrollY > 0 || !!document.querySelector('[aria-modal="true"]');
    const down = (e) => {
      start.current = e.touches.length === 1 && !blocked() ? { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false } : null;
    };
    const move = (e) => {
      const s = start.current;
      if (!s) return;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;
      if (!s.on) {
        if (dy > 8 && dy > Math.abs(dx) * 1.3 && window.scrollY <= 0) s.on = true;
        else { if (Math.abs(dx) > 8 || dy < -4) start.current = null; return; }
      }
      if (e.cancelable) e.preventDefault();
      dyRef.current = dy;
      setPull(dy);
    };
    const up = async () => {
      const s = start.current;
      start.current = null;
      if (!s?.on) return;
      const { ready } = pullProgress(dyRef.current);
      dyRef.current = 0;
      if (!ready) { setPull(0); return; }
      setBusy(true);
      // Gira al menos un momento, para que se note que recargó
      await Promise.all([Promise.resolve(refresh.current?.()), new Promise((r) => { setTimeout(r, 700); })]);
      setBusy(false);
      setPull(0);
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
    };
  }, [disabled, busy]);

  const p = pullProgress(pull);
  if (!pull && !busy) return null;
  return (
    <div
      className={`mapp-pull ${busy ? 'is-busy' : ''} ${p.ready ? 'is-ready' : ''}`}
      style={{ '--pull': `${busy ? 52 : p.offset}px`, '--turn': `${Math.round(p.progress * 300)}deg` }}
      role="status" aria-label={busy ? 'Recargando' : p.ready ? 'Suelta para recargar' : 'Desliza para recargar'} data-testid="pull-refresh"
    >
      <span className="mapp-pull-ico"><Termo /></span>
    </div>
  );
}

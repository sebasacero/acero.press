// Celestra aparece como un asistente (12 nov 2026, pedido del usuario: «como aparece Siri en
// iPhone»): un orbe de galaxia flota abajo en las pantallas del equipo; al tocarlo la pantalla
// se oscurece, el orbe crece y Celestra sube en una hoja. Solo dentro de Micra: iOS no deja
// que una app salga sobre la pantalla de inicio.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { TONOS, estrellas, punto } from './galaxia.js';

const Celestra = lazy(() => import('./Celestra.jsx'));

/** La galaxia que gira. Se detiene con la pestaña escondida y con «menos movimiento» queda quieta. */
export function Galaxia({ size = 58, fast = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const R = size / 2;
    const es = estrellas(Math.round(160 + size * 6));
    const k = Math.max(0.55, size / 110);
    const quiet = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let rot = 0.6;
    let last = 0;
    let raf = 0;
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, size, size);
      // El aura del espacio: índigo que se desvanece hacia el borde, sin corte
      const sky = ctx.createRadialGradient(R, R, 0, R, R, R);
      sky.addColorStop(0, 'rgba(42,22,112,1)');
      sky.addColorStop(0.45, 'rgba(26,14,70,.95)');
      sky.addColorStop(0.72, 'rgba(34,18,90,.55)');
      sky.addColorStop(0.9, 'rgba(90,30,158,.18)');
      sky.addColorStop(1, 'rgba(90,30,158,0)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';
      for (const e of es) {
        const p = punto(e, rot);
        // Las estrellas del borde se apagan: la galaxia se disuelve en el aura
        const d = Math.hypot(p.x, p.y);
        ctx.globalAlpha = e.alpha * (d > 0.62 ? Math.max(0, 1 - (d - 0.62) / 0.3) : 1);
        ctx.fillStyle = TONOS[e.tono];
        ctx.beginPath();
        ctx.arc(R + p.x * R * 0.9, R + p.y * R * 0.9, e.size * k, 0, Math.PI * 2);
        ctx.fill();
      }
      // El núcleo: blanco caliente que se apaga en rosa
      ctx.globalAlpha = 1;
      const core = ctx.createRadialGradient(R, R, 0, R, R, R * 0.42);
      core.addColorStop(0, 'rgba(255,255,255,.95)');
      core.addColorStop(0.25, 'rgba(255,243,176,.7)');
      core.addColorStop(0.6, 'rgba(255,179,199,.28)');
      core.addColorStop(1, 'rgba(176,18,122,0)');
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, size, size);
    };
    const step = (now) => {
      rot += (Math.min(64, now - (last || now)) / 1000) * (fast ? 0.55 : 0.22);
      last = now;
      draw();
      raf = requestAnimationFrame(step);
    };
    const start = () => { cancelAnimationFrame(raf); last = 0; if (!quiet && !document.hidden) raf = requestAnimationFrame(step); };
    draw();
    start();
    document.addEventListener('visibilitychange', start);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', start); };
  }, [size, fast]);
  return <canvas ref={ref} className="mapp-orb-galaxia" style={{ width: size, height: size }} aria-hidden="true" />;
}

export default function CelestraOrb() {
  const [open, setOpen] = useState(false);
  // Celestra se monta la primera vez que se abre y se queda: no pierde lo escrito al cerrar
  const [seen, setSeen] = useState(false);
  const orb = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const toggle = () => { setSeen(true); setOpen((v) => !v); };
  return (
    <>
      {seen && (
        <div className="mapp-orb-layer" role="dialog" aria-modal="true" aria-label="Celestra" hidden={!open} data-testid="celestra-layer">
          <button type="button" className="mapp-orb-scrim" onClick={() => setOpen(false)} aria-label="Cerrar Celestra" tabIndex={-1} />
          <div className="mapp-orb-sheet">
            <Suspense fallback={<p className="mapp-orb-wait" role="status">Celestra está llegando…</p>}><Celestra /></Suspense>
          </div>
        </div>
      )}
      <button ref={orb} type="button" className={`mapp-orb ${open ? 'is-open' : ''}`} onClick={toggle}
        aria-label={open ? 'Cerrar Celestra' : 'Abrir Celestra'} aria-expanded={open} data-testid="celestra-orb">
        <Galaxia size={open ? 132 : 72} fast={open} />
      </button>
    </>
  );
}

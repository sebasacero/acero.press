import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Segs } from '../esspresale/parts.jsx';
import { BASE_RECIPE, BREW_STEPS, brewStepAt, untilNext, clock } from './school.js';

// «Prepara conmigo»: el cronómetro de la receta base a pantalla completa, como el
// «modo cocina» de las apps de recetas. Se usa con las manos ocupadas y el celular
// en la mesa: números grandes, botones grandes, la pantalla no se apaga (Wake Lock,
// donde el navegador lo permite) y un toque de vibración en cada paso (Android).

/** Reloj de la receta: corre, se pausa, se reinicia. Sigue andando si se cierra la pantalla completa. */
export function useBrewTimer(total = BASE_RECIPE.total) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;

  useEffect(() => {
    if (!running) return undefined;
    const t0 = performance.now();
    const from = elapsedRef.current;
    const id = window.setInterval(() => {
      const s = Math.min(total, from + (performance.now() - t0) / 1000);
      setElapsed(s);
      if (s >= total) setRunning(false);
    }, 200);
    return () => window.clearInterval(id);
  }, [running, total]);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback(() => { setRunning(false); setElapsed(0); }, []);
  return { elapsed, running, total, start, pause, reset, done: elapsed >= total };
}

/** Mantiene la pantalla encendida mientras `on`; el navegador la suelta al ocultar la página, así que se vuelve a pedir. */
function useWakeLock(on) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;
    const ask = () => {
      navigator.wakeLock.request('screen').then((l) => {
        if (cancelled) l.release().catch(() => {});
        else lock = l;
      }).catch(() => { /* sin permiso o sin batería: sigue sin ella */ });
    };
    const onVisible = () => { if (document.visibilityState === 'visible' && (!lock || lock.released)) ask(); };
    ask();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [on]);
}

export default function CookMode({ open, onClose, timer, figure, t }) {
  const dialogRef = useRef(null);
  const lastStep = useRef(-1);
  // El reloj vuelve a pintar 5 veces por segundo: el cierre va por referencia para no reabrir el diálogo en cada tic
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const i = brewStepAt(timer.elapsed);
  const wait = untilNext(timer.elapsed);
  const started = timer.elapsed > 0;
  const step = figure.steps[i];
  const next = figure.steps[i + 1];

  useWakeLock(open && timer.running);

  // Un toque en cada paso: se puede preparar sin mirar la pantalla
  useEffect(() => {
    if (!open || !timer.running) { lastStep.current = i; return; }
    if (i !== lastStep.current) {
      if (lastStep.current !== -1) navigator.vibrate?.(i === BREW_STEPS.length - 1 ? [90, 60, 90] : 70);
      lastStep.current = i;
    }
  }, [i, open, timer.running]);

  // Diálogo: foco adentro, Esc cierra, la página de atrás no se mueve; al cerrar, el foco vuelve
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      // Tab da la vuelta dentro del diálogo: la página de atrás no recibe el foco
      const items = [...dialogRef.current.querySelectorAll('button:not([disabled]), [href], input')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === dialogRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (at === last || !dialogRef.current.contains(at))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (before && typeof before.focus === 'function') before.focus();
    };
  }, [open]);

  if (!open) return null;

  const primary = timer.done
    ? { label: t('school.timer.again'), run: () => { timer.reset(); timer.start(); } }
    : timer.running
      ? { label: t('school.timer.pause'), run: timer.pause }
      : { label: started ? t('school.timer.resume') : t('school.timer.start'), run: timer.start };

  return createPortal(
    <div className="cook" role="dialog" aria-modal="true" aria-labelledby="cook-title" ref={dialogRef} tabIndex={-1}>
      <div className="cook-in">
        <header className="cook-head">
          <div>
            <span className="cook-fig">FIG. 05.2</span>
            <h2 id="cook-title">{t('school.timer.title')}</h2>
          </div>
          <button type="button" className="cook-close" onClick={onClose} aria-label={t('school.timer.close')}>×</button>
        </header>
        <ul className="cook-recipe">{figure.recipe.map((r) => <li key={r}>{r}</li>)}</ul>

        <div className="cook-clock" aria-hidden="true">{clock(timer.elapsed)}</div>
        <Segs filled={Math.round((timer.elapsed / timer.total) * 20)} className="essp-bar cook-bar" />

        <div className="cook-now" aria-live="polite">
          <span className="cook-count">{i + 1} / {BREW_STEPS.length}</span>
          <b>{step.title}</b>
          <p>{step.detail}</p>
        </div>
        {next && (
          <p className="cook-next">
            {t('school.timer.after')}: <b>{next.title}</b>
            {started && wait !== null && <span> · {t('school.timer.inSec').replace('{s}', Math.ceil(wait))}</span>}
          </p>
        )}

        <div className="cook-actions">
          <button type="button" className="essp-btn cook-primary" onClick={primary.run}>{primary.label}</button>
          {started && !timer.done && (
            <button type="button" className="essp-btn is-ghost cook-secondary" onClick={timer.reset}>{t('school.timer.reset')}</button>
          )}
        </div>
        <p className="cook-awake">{t('school.timer.awake')}</p>
      </div>
    </div>,
    document.body,
  );
}

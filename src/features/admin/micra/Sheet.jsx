import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hoja de Micra. En el celular sube desde abajo (se cierra arrastrando la
 * manija hacia abajo); en escritorio queda acoplada como inspector a la
 * derecha (`docked`). Mientras está abierta (y no acoplada) el foco queda
 * dentro y al cerrarla vuelve a donde estaba.
 */
export default function Sheet({ title, aside, onClose, docked = false, size = 'auto', footer, children, className = '', label }) {
  const ref = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (docked) return undefined;
    const prev = document.activeElement;
    const first = ref.current?.querySelector(FOCUSABLE);
    (first ?? ref.current)?.focus({ preventScroll: true });
    return () => { if (prev && document.contains(prev)) prev.focus?.({ preventScroll: true }); };
  }, [docked]);

  const onKeyDown = (e) => {
    if (docked || e.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const lastEl = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
  };

  // Arrastrar la manija hacia abajo cierra la hoja (solo transform, sin re-render)
  const onGrabDown = (e) => {
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onGrabMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, e.clientY - d.y);
    ref.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onGrabUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.dy > 90) { onClose?.(); return; }
    ref.current.style.transition = 'transform .18s ease';
    ref.current.style.transform = '';
    setTimeout(() => { if (ref.current) ref.current.style.transition = ''; }, 200);
  };

  return (
    <>
      {!docked && <div className="msheet-backdrop" onClick={onClose} aria-hidden="true" />}
      <section
        ref={ref}
        className={`msheet ${docked ? 'is-docked' : ''} ${size === 'tall' ? 'is-tall' : ''} ${className}`}
        role="dialog"
        aria-modal={docked ? undefined : true}
        aria-label={label ?? title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {!docked && (
          <div className="msheet-grab" onPointerDown={onGrabDown} onPointerMove={onGrabMove} onPointerUp={onGrabUp} onPointerCancel={onGrabUp} aria-hidden="true">
            <i />
          </div>
        )}
        <header className="msheet-head">
          <h2 className="msheet-title">{title}</h2>
          {aside}
          {onClose && !docked && (
            <button type="button" className="msheet-x" onClick={onClose} aria-label="Cerrar">×</button>
          )}
        </header>
        <div className="msheet-body">{children}</div>
        {footer && <footer className="msheet-foot">{footer}</footer>}
      </section>
    </>
  );
}

import { useEffect, useRef } from 'react';

const HOLD_MS = 300;

/**
 * Carrusel de filtros: el del centro es el elegido y, en la cámara, el
 * disparador. Tocarlo toma la foto; mantenerlo presionado (300 ms) graba video
 * mientras se sostiene, como en Instagram. Deslizar o mover más de 8 px
 * cancela el "mantener" y el toque que sigue a una grabación no toma foto.
 */
export default function FilterCarousel({ filters, selectedId, onSelect, onShutter, onHoldStart, onHoldEnd, shutterClass = '', shutterLabel, disabled, locked }) {
  const ref = useRef(null);
  const settle = useRef(0);
  const hold = useRef(null); // { timer, x, y, active }
  const swallowClick = useRef(false);

  // El elegido siempre queda en el centro (al abrir y al cambiar de sección)
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-id="${CSS.escape(String(selectedId ?? ''))}"]`);
    if (el) ref.current.scrollTo({ left: el.offsetLeft - (ref.current.clientWidth - el.offsetWidth) / 2, behavior: 'instant' });
  }, [selectedId, filters]);

  const cancelHold = () => {
    const h = hold.current;
    if (h && !h.active) { clearTimeout(h.timer); hold.current = null; }
  };

  // Al soltar el carrusel, el filtro que quedó en el centro es el elegido
  const onScroll = () => {
    cancelHold();
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const box = ref.current;
      if (!box) return;
      const mid = box.scrollLeft + box.clientWidth / 2;
      let best = null;
      for (const el of box.querySelectorAll('[data-id]')) {
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
        if (!best || d < best.d) best = { d, id: el.dataset.id };
      }
      if (best && best.id !== String(selectedId)) onSelect(best.id);
    }, 110);
  };
  useEffect(() => () => { clearTimeout(settle.current); clearTimeout(hold.current?.timer); }, []);

  // Mientras se graba manteniendo, el dedo puede moverse sin que el navegador
  // arrastre el carrusel (eso cancelaría el toque y cortaría el video)
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const block = (e) => { if (hold.current?.active) e.preventDefault(); };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  const endHold = () => {
    const h = hold.current;
    hold.current = null;
    if (!h) return;
    clearTimeout(h.timer);
    if (h.end) {
      window.removeEventListener('pointerup', h.end);
      window.removeEventListener('touchend', h.end);
    }
    if (h.active) {
      swallowClick.current = true;
      onHoldEnd?.();
    }
  };
  // Ya grabando, solo soltar termina (no un cancel del navegador ni salirse del botón)
  const softEnd = () => { if (hold.current?.active) return; cancelHold(); };

  return (
    <div className={`mc-carousel-wrap ${locked ? 'is-locked' : ''}`}>
      <div className="mc-carousel" ref={ref} onScroll={onScroll} role="listbox" aria-label="Filtros">
        {filters.map((f) => {
          const on = String(f.id) === String(selectedId);
          return (
            <button
              key={f.id}
              type="button"
              data-id={f.id}
              role="option"
              aria-selected={on}
              aria-label={on && onShutter ? `${f.name}: ${shutterLabel || 'tomar'}` : f.name}
              className={`mc-filter ${on ? 'on' : ''}`}
              disabled={disabled && !on}
              onPointerDown={on && onHoldStart ? (e) => {
                const h = { x: e.clientX, y: e.clientY, active: false, timer: 0, pointerId: e.pointerId, btn: e.currentTarget };
                h.timer = setTimeout(() => {
                  h.active = true;
                  // Solo soltar el dedo del disparador termina (no otro dedo en la pantalla)
                  h.end = (ev) => {
                    if (ev.type === 'pointerup' && ev.pointerId !== h.pointerId) return;
                    if (ev.type === 'touchend' && [...ev.touches].some((t) => h.btn.contains(t.target))) return;
                    endHold();
                  };
                  window.addEventListener('pointerup', h.end);
                  window.addEventListener('touchend', h.end);
                  onHoldStart();
                }, HOLD_MS);
                hold.current = h;
              } : undefined}
              onPointerMove={on && onHoldStart ? (e) => {
                const h = hold.current;
                if (h && !h.active && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 8) cancelHold();
              } : undefined}
              onPointerUp={on && onHoldStart ? (e) => { if (!hold.current || e.pointerId === hold.current.pointerId) endHold(); } : undefined}
              onPointerCancel={on && onHoldStart ? softEnd : undefined}
              onPointerLeave={on && onHoldStart ? softEnd : undefined}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => {
                if (swallowClick.current) { swallowClick.current = false; return; }
                if (on) { onShutter?.(); return; }
                onSelect(String(f.id));
                e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
              }}
            >
              {f.thumb ? <img src={f.thumb} alt="" loading="lazy" draggable={false} /> : <span className="mc-filter-glyph" aria-hidden="true">{f.glyph ?? f.name.slice(0, 1)}</span>}
            </button>
          );
        })}
      </div>
      {onShutter && <span className={`mc-shutter-ring ${shutterClass}`} aria-hidden="true">{shutterLabel && <b>{shutterLabel}</b>}</span>}
    </div>
  );
}

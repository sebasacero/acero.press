import { useLayoutEffect, useRef, useState } from 'react';
import { toPct } from './cardLayout.js';
import { ELEMENT_META } from './cardModel.js';
import { useDragSnap } from './useDragSnap.js';
import { IconTrash } from './icons.jsx';

const pad = (b, W, H, px) => {
  const p = toPct(b, W, H);
  return { left: `calc(${p.left} - ${px}px)`, top: `calc(${p.top} - ${px}px)`, width: `calc(${p.width} + ${px * 2}px)`, height: `calc(${p.height} + ${px * 2}px)` };
};

/**
 * Capa táctil sobre la tarjeta: una caja por pieza (botones enfocables con
 * Tab), el contorno de la seleccionada, las posiciones al arrastrar y la
 * papelera. Las cajas salen de `canvas.__layout` (las del último dibujo).
 */
export default function SelectionLayer({ drawn, cardRef, selection, disabled, onSelect, onEditText, onSlot, onSlotStep, onHide, isText }) {
  const layerRef = useRef(null);
  const selRef = useRef(null);
  const ghostRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);
  const layout = (drawn?.layout ?? []).filter((b) => ELEMENT_META[b.id]?.hit);
  const live = useRef({});
  live.current = { drawn, layout, slots: drawn?.slots, selection, disabled };

  // Al empezar a arrastrar, la pieza "se levanta": su recorte sigue al dedo
  const snapshot = (id) => {
    const b = live.current.layout.find((x) => x.id === id);
    const src = cardRef.current;
    const c = ghostRef.current;
    if (!b || !src || !c) return;
    c.width = Math.max(1, Math.round(b.w));
    c.height = Math.max(1, Math.round(b.h));
    c.getContext('2d').drawImage(src, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height);
  };

  // (después del render: si la pieza recién se seleccionó, su contorno aún no existía)
  useLayoutEffect(() => { if (drag) snapshot(drag); }, [drag]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlers = useDragSnap({
    layerRef, selRef, getState: () => live.current,
    onSelect, onEditText, onSlot, onHide, isText,
    onDrag: setDrag,
    onHover: (id) => setHover((h) => (h === id ? h : id)),
  });

  if (!drawn) return null;
  const { W, H } = drawn;
  const selBox = selection && layout.find((b) => b.id === selection);
  const slots = drag ? drawn.slots?.[drag] ?? [] : [];

  return (
    <div
      ref={layerRef}
      className={`mst-hits ${drag ? 'is-dragging' : ''}`}
      {...handlers}
    >
      {layout.map((b) => (
        <button
          key={b.id}
          type="button"
          tabIndex={0}
          className={`mst-hit ${hover === b.id && b.id !== selection ? 'is-hover' : ''}`}
          style={toPct(b, W, H)}
          aria-label={`${ELEMENT_META[b.id].label}. Toca para editar`}
          aria-pressed={b.id === selection}
          onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) onSelect(b.id); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (b.id !== selection) onSelect(b.id);
              else if (isText(b.id)) onEditText(b.id);
            } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onHide(b.id); }
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); onSlotStep(b.id, e.key === 'ArrowLeft' ? -1 : 1); }
          }}
        />
      ))}

      {slots.map((s) => (
        <div key={s.slot} data-slot={s.slot} className="mst-slot" style={toPct(s, W, H)} aria-hidden="true" />
      ))}

      {selBox && (
        <div ref={selRef} className={`mst-sel ${drag ? 'is-lifted' : ''}`} style={pad(selBox, W, H, 6)} aria-hidden="true">
          <canvas ref={ghostRef} className="mst-sel-ghost" />
          <i className="mst-tick is-tl" /><i className="mst-tick is-tr" /><i className="mst-tick is-bl" /><i className="mst-tick is-br" />
          <span className="mst-sel-tag">{ELEMENT_META[selBox.id].tag}</span>
        </div>
      )}

      {drag && (
        <div className="mst-trash" aria-hidden="true">
          <IconTrash />
          <span>Soltar para ocultar</span>
        </div>
      )}
    </div>
  );
}

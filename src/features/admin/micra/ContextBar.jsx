import { useEffect, useState } from 'react';
import { LOGO_VARIANTS, currentSlot, movableSlots, slotPatch } from './cardLayout.js';
import { ELEMENT_META } from './cardModel.js';
import {
  IconCells, IconCheck, IconCompact, IconEyeOff, IconImage, IconMoney, IconMove, IconPen, IconReset, IconRuler, IconSize, IconStyle, IconTrash,
} from './icons.jsx';

const SLOT_LABEL = {
  left: 'Izquierda', center: 'Centro', right: 'Derecha', top: 'Arriba', bottom: 'Abajo', middle: 'Centro',
  'under-title': 'Bajo el título', 'over-block': 'Sobre el cajetín',
};
const SIZES = [['s', 'S'], ['m', 'M'], ['l', 'L']];
const CELLS = [['weather', 'Clima'], ['time', 'Hora'], ['date', 'Fecha'], ['sign', 'Firma']];

const HIDE = { id: 'hide', label: 'Ocultar', Icon: IconEyeOff };
const REMOVE = { id: 'hide', label: 'Quitar', Icon: IconTrash };
const EDIT = { id: 'edit', label: 'Editar', Icon: IconPen };
const RESET = { id: 'reset', label: 'Restablecer', Icon: IconReset };
const SIZE = { id: 'size', label: 'Tamaño', Icon: IconSize, row: true };
const MOVE = { id: 'move', label: 'Mover', Icon: IconMove, row: true };

// Acciones de cada pieza, en el orden de la barra
function actionsFor(id, kind) {
  switch (id) {
    case 'logo': return [{ id: 'style', label: 'Estilo', Icon: IconStyle, row: true }, SIZE, MOVE, HIDE];
    case 'cobrand': return [{ id: 'cobrand', label: 'Cambiar', Icon: IconImage }, REMOVE];
    case 'fig': return [EDIT, { id: 'measures', label: 'Medidas', Icon: IconRuler, toggle: 'showSize' }, RESET, HIDE];
    case 'title': return [EDIT, SIZE, MOVE, RESET, HIDE];
    case 'subtitle': return [EDIT, RESET, HIDE];
    case 'free': return [EDIT, SIZE, MOVE, REMOVE];
    case 'price': return [{ id: 'sale', label: 'Presentación', Icon: IconMoney }, MOVE, REMOVE];
    case 'handle': case 'place': return [EDIT, MOVE, REMOVE];
    case 'drawing': return [HIDE];
    case 'panel': return [EDIT, ...(kind === 'recipe' ? [{ id: 'compact', label: 'Compacto', Icon: IconCompact, toggle: 'compact' }] : []), MOVE, HIDE];
    case 'block': return [{ id: 'cells', label: 'Celdas', Icon: IconCells, row: true }, { id: 'sign', label: 'Firma', Icon: IconPen }, HIDE];
    default: return [HIDE];
  }
}

/**
 * Barra de la pieza seleccionada (reemplaza a la de abajo). Las acciones con
 * opciones abren una fila de fichas encima.
 */
export default function ContextBar({ id, el, kind, onPhoto, note, onSet, onHide, onEdit, onReset, onSale, onCobrand, onDone }) {
  const [row, setRow] = useState(null);
  useEffect(() => { setRow(null); }, [id]);
  const e = el[id];
  if (!e) return null;
  const slots = movableSlots(el, id, onPhoto);
  // «Mover» solo si hay a dónde
  const actions = actionsFor(id, kind).filter((a) => a.id !== 'move' || slots.length > 1);

  const chips = (() => {
    if (row === 'style') return LOGO_VARIANTS.map((v) => ({ key: v.id, label: v.label, on: e.variant === v.id, run: () => onSet({ variant: v.id }), cls: `is-logo is-${v.id}` }));
    if (row === 'size') return SIZES.map(([s, label]) => ({ key: s, label, on: e.size === s, run: () => onSet({ size: s }) }));
    if (row === 'move') {
      const cur = currentSlot(el, id, onPhoto);
      return slots.map((s) => ({ key: s, label: SLOT_LABEL[s], on: cur === s, run: () => onSet(slotPatch(id, s, onPhoto)) }));
    }
    if (row === 'cells') {
      // La última celda encendida no se apaga (sin celdas el cajetín no se podría volver a mostrar)
      const onCount = CELLS.filter(([c]) => e.cells?.[c]).length;
      return CELLS.map(([c, label]) => ({ key: c, label, on: !!e.cells?.[c], disabled: !!e.cells?.[c] && onCount === 1, run: () => onSet({ cells: { [c]: !e.cells?.[c] } }) }));
    }
    return null;
  })();

  const run = (a) => {
    if (a.row) { setRow((r) => (r === a.id ? null : a.id)); return; }
    setRow(null);
    if (a.toggle) { onSet({ [a.toggle]: !e[a.toggle] }); return; }
    if (a.id === 'hide') onHide();
    else if (a.id === 'sign') {
      // La firma está en su celda: si estaba apagada, se enciende para poder escribirla
      if (!e.cells?.sign) onSet({ cells: { sign: true } });
      onEdit('sign');
    } else if (a.id === 'edit') onEdit(null);
    else if (a.id === 'reset') onReset();
    else if (a.id === 'sale') onSale();
    else if (a.id === 'cobrand') onCobrand();
  };

  return (
    <div className="mst-ctx-wrap">
      {note && <p className="mst-fit" role="status">{note}</p>}
      {chips && (
        <div className="mst-ctx-row" role="group" aria-label={actions.find((a) => a.id === row)?.label}>
          {chips.map((c) => (
            <button key={c.key} type="button" className={`mst-ctx-chip ${c.on ? 'on' : ''} ${c.cls ?? ''}`} aria-pressed={c.on} disabled={c.disabled} onClick={c.run}>{c.label}</button>
          ))}
        </div>
      )}
      <div className="mst-ctx" role="toolbar" aria-label={`Editar: ${ELEMENT_META[id].label}`}>
        {actions.map((a) => {
          const pressed = a.toggle ? !!e[a.toggle] : a.row ? row === a.id : undefined;
          const label = a.id === 'compact' && e.compact ? 'Completo' : a.label;
          return (
            <button key={a.id} type="button" className={`mst-ctx-btn ${pressed ? 'on' : ''}`} aria-pressed={pressed} onClick={() => run(a)}>
              <a.Icon /><span>{label}</span>
            </button>
          );
        })}
        <button type="button" className="mst-ctx-btn is-done" onClick={onDone}><IconCheck /><span>Listo</span></button>
      </div>
    </div>
  );
}

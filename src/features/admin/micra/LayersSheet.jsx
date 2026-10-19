import { ELEMENT_META, LAYER_ORDER, STYLES } from './cardModel.js';
import Sheet from './Sheet.jsx';
import { IconEye, IconEyeOff } from './icons.jsx';

const oneLine = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

/** Capas: un ojo por pieza, estilos de un toque y «Restablecer diseño». */
export default function LayersSheet({ elements, kind, previews, fit, onToggle, onSelect, onStyle, onReset, canReset, onClose, docked }) {
  const status = (id) => {
    const e = elements[id];
    if (!e.visible) return { text: 'Oculto' };
    if (id === 'fig' && fit?.fig === 'short') return { text: 'Reducido', warn: true };
    if ((id === 'fig' && fit?.fig === 'hidden') || (id === 'panel' && fit?.panel === 'hidden')) return { text: 'Sin espacio', warn: true };
    return null;
  };
  return (
    <Sheet
      title="Capas"
      onClose={onClose}
      docked={docked}
      size="tall"
      footer={<button type="button" className="msheet-btn is-ghost" disabled={!canReset} onClick={onReset}>Restablecer diseño</button>}
    >
      <p className="msheet-label">Estilos</p>
      <div className="msheet-chips">
        {STYLES.map((s) => (
          <button key={s.id} type="button" className="msheet-chip" onClick={() => onStyle(s.id)}>
            {kind !== 'recipe' && s.labelMessage ? s.labelMessage : s.label}
          </button>
        ))}
      </div>
      <ul className="msheet-layers">
        {LAYER_ORDER.filter((id) => id !== 'cobrand' || elements.cobrand.available).map((id) => {
          const e = elements[id];
          const meta = ELEMENT_META[id];
          const reason = !e.available ? (id === 'drawing' ? 'Solo con fondo Plano' : id === 'shade' ? 'Solo con foto o video' : id === 'block' ? 'Sin celdas' : null) : null;
          const st = status(id);
          const prev = oneLine(previews[id]);
          return (
            <li key={id} className={`msheet-layer ${!e.visible ? 'is-off' : ''} ${id === 'logo' && !e.visible ? 'is-alert' : ''} ${reason && id !== 'block' ? 'is-na' : ''}`}>
              <button
                type="button"
                className="msheet-eye"
                aria-pressed={!!e.visible}
                aria-label={`${e.visible ? 'Ocultar' : 'Mostrar'} ${meta.label.toLowerCase()}`}
                disabled={!!reason && id !== 'block'}
                onClick={() => onToggle(id)}
              >
                {e.visible ? <IconEye /> : <IconEyeOff />}
              </button>
              <button type="button" className="msheet-layer-name" disabled={!meta.hit || !e.shown} onClick={() => onSelect(id)}>
                <b>{meta.label}</b>
                {reason ? <small>{reason}</small> : prev ? <small>{prev}</small> : null}
              </button>
              {st && <span className={`msheet-layer-st ${st.warn ? 'is-warn' : ''}`}>{st.text}</span>}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

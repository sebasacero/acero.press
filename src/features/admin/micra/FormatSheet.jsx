import { FORMATS } from '../espresaleCard.js';
import Sheet from './Sheet.jsx';

/** Los ocho formatos de las redes, con su proporción. La tarjeta se reacomoda a la zona segura del elegido. */
export default function FormatSheet({ format, onFormat, onClose, docked }) {
  const covers = FORMATS[format].covers?.map((c) => c.label).join(' · ');
  return (
    <Sheet title="Formato" onClose={onClose} docked={docked} footer={covers ? <p className="msheet-fine">Zona segura: {covers}</p> : null}>
      <div className="mc-formats" role="listbox" aria-label="Formato de la publicación">
        {Object.entries(FORMATS).map(([id, f]) => (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={id === format}
            className={id === format ? 'on' : ''}
            title={`${f.label} · ${f.w}×${f.h}`}
            onClick={() => { onFormat(id); onClose?.(); }}
          >
            <i className="mc-ratio" style={{ '--r': f.w / f.h }} aria-hidden="true" />
            <b>{f.short}</b>
            <small>{f.apps}</small>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

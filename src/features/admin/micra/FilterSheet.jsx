import { CARD_KINDS, PRESETS } from '../micraFilters.js';
import Sheet from './Sheet.jsx';

/** Filtro de la tarjeta desde el editor: sección y modelo (o variedad). */
export default function FilterSheet({ kind, onKind, varieties, varietyId, onVariety, presetId, onPreset, onClose, docked }) {
  const items = kind === 'recipe'
    ? (varieties ?? []).map((v) => ({ id: String(v.id), name: v.name, thumb: v.image_url, on: String(v.id) === String(varietyId), run: () => onVariety(v.id) }))
    : PRESETS[kind].map((p) => ({ id: p.id, name: p.name, glyph: p.glyph, on: p.id === presetId, run: () => onPreset(p.id) }));
  return (
    <Sheet title="Filtro" onClose={onClose} docked={docked}>
      <div className="mc-kinds is-sheet" role="tablist" aria-label="Sección">
        {CARD_KINDS.map((k) => (
          <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'on' : ''} onClick={() => onKind(k.id)}>{k.label}</button>
        ))}
      </div>
      <div className="msheet-filters" role="listbox" aria-label="Filtros">
        {items.map((f) => (
          <button key={f.id} type="button" role="option" aria-selected={f.on} className={`msheet-filter ${f.on ? 'on' : ''}`} onClick={f.run}>
            <span className="mc-filter">{f.thumb ? <img src={f.thumb} alt="" loading="lazy" /> : <span className="mc-filter-glyph" aria-hidden="true">{f.glyph ?? f.name.slice(0, 1)}</span>}</span>
            <small>{f.name}</small>
          </button>
        ))}
        {kind === 'recipe' && !items.length && <p className="msheet-empty">No hay cafés activos en el catálogo (categoría coffee_bag).</p>}
      </div>
    </Sheet>
  );
}

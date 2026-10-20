import { ELEMENT_META, STICKER_IDS } from './cardModel.js';
import Sheet from './Sheet.jsx';
import { IconPin } from './icons.jsx';

const HIDEABLE = ['logo', 'fig', 'title', 'subtitle', 'drawing', 'panel', 'block'];

/** Stickers para la tarjeta, y las piezas ocultas para volver a ponerlas. */
export default function StickerTray({ elements, texts, priceText, onFree, onShow, onSelect, onSale, onCobrand, hasCobrand, onClose, docked }) {
  const add = (id) => {
    if (elements[id].shown) { onSelect(id); return; }
    onShow(id);
  };
  const tiles = [
    { id: 'free', label: 'Texto libre', preview: <b className="is-marker">Aa</b>, run: onFree },
    {
      id: 'price', label: 'Precio',
      preview: priceText ? <b className="is-price">{priceText}</b> : <small>Elige presentación</small>,
      run: () => (priceText ? add('price') : onSale()),
    },
    { id: 'handle', label: 'Mención', preview: <b className="is-mono">{texts.handle || '@aceropress'}</b>, run: () => add('handle') },
    { id: 'place', label: 'Ubicación', preview: <b className="is-mono"><IconPin size={16} /> {texts.place || 'Chapinero, Bogotá'}</b>, run: () => add('place') },
    { id: 'cobrand', label: hasCobrand ? 'Cambiar logo aliado' : 'Logo aliado', preview: <small>Imagen del aliado</small>, run: onCobrand },
  ];
  const hidden = HIDEABLE.filter((id) => elements[id].available && !elements[id].visible);

  return (
    <Sheet title="Stickers" onClose={onClose} docked={docked}>
      <p className="msheet-label">Para tu tarjeta</p>
      <div className="msheet-tiles">
        {tiles.map((t) => {
          const on = STICKER_IDS.includes(t.id) && elements[t.id]?.shown;
          return (
            <button key={t.id} type="button" className={`msheet-tile ${on ? 'on' : ''}`} onClick={t.run} aria-pressed={STICKER_IDS.includes(t.id) ? !!on : undefined}>
              <span className="msheet-tile-prev">{t.preview}</span>
              <span className="msheet-tile-name">{t.label}{on ? ' ✓' : ''}</span>
            </button>
          );
        })}
      </div>
      {hidden.length > 0 && (
        <>
          <p className="msheet-label">Ocultos</p>
          <div className="msheet-tiles">
            {hidden.map((id) => (
              <button key={id} type="button" className="msheet-tile is-hidden" onClick={() => onShow(id)}>
                <span className="msheet-tile-prev"><small>{ELEMENT_META[id].tag}</small></span>
                <span className="msheet-tile-name">Mostrar {ELEMENT_META[id].label.toLowerCase()}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

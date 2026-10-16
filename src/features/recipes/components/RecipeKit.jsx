import { useState, useEffect, useRef } from 'react';
import { useCart } from '../../cart/context/CartContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const FALLBACK_IMG = '/image/bagsbeans.png';
const money = (n) => `$${Number(n).toLocaleString('es-CO')}`;
const cartName = (p) => (p.brand ? `${p.name} · ${p.brand}` : p.name);
const firstSize = (p) => p.sizes.find((s) => p.prices[s] != null) ?? p.sizes[0];

/**
 * "Prepárala en casa": el café recomendado para la receta + los extras del
 * kit (filtros, AeroPress…). El cliente elige tamaño y desmarca lo que ya tiene.
 */
export default function RecipeKit({ pairing, recipe, autoFocus = false }) {
  const { addItem } = useCart();
  const { t } = useLanguage();
  const [size, setSize] = useState(pairing.size);
  const [picked, setPicked] = useState(() => Object.fromEntries(pairing.extras.map((p) => [p.uuid, true])));
  const [added, setAdded] = useState(false);
  const btnRef = useRef(null);

  useEffect(() => { if (autoFocus) btnRef.current?.focus({ preventScroll: true }); }, [autoFocus]);

  const { coffee, extras, note } = pairing;
  const chosen = extras.filter((p) => picked[p.uuid]);
  const total = coffee.prices[size] + chosen.reduce((s, p) => s + p.prices[firstSize(p)], 0);

  const addKit = () => {
    addItem({ name: cartName(coffee), price: coffee.prices[size], variant: size, qty: 1, image: coffee.image, variantId: coffee.variantIds[size] });
    for (const p of chosen) {
      const s = firstSize(p);
      addItem({ name: cartName(p), price: p.prices[s], variant: s, qty: 1, image: p.image, variantId: p.variantIds[s] });
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <section className="kit" aria-label={t('kit.title')}>
      <div className="kit-head">
        <span className="kit-fig">{t('kit.fig')}</span>
        <h4>{t('kit.title')}</h4>
        {note && <p className="kit-note">{note}</p>}
      </div>

      <div className="kit-row kit-coffee">
        <img src={coffee.image || FALLBACK_IMG} alt="" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
        <div className="kit-row-info">
          <span className="kit-row-label">{t('kit.coffee')}</span>
          <strong>{coffee.name}</strong>
          {(coffee.brand || coffee.region) && <span className="kit-row-meta">{[coffee.brand, coffee.region].filter(Boolean).join(' · ')}</span>}
          {coffee.sizes.length > 1 && (
            <div className="kit-sizes" role="group" aria-label={t('product.size')}>
              {coffee.sizes.filter((s) => coffee.prices[s] != null).map((s) => (
                <button key={s} type="button" className={s === size ? 'active' : ''} aria-pressed={s === size} onClick={() => setSize(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
        <span className="kit-price">{money(coffee.prices[size])}</span>
      </div>

      {extras.length > 0 && (
        <>
          <p className="kit-sub">{t('kit.extrasHint')}</p>
          {extras.map((p) => (
            <label key={p.uuid} className={`kit-row kit-extra ${picked[p.uuid] ? '' : 'is-off'}`}>
              <input type="checkbox" checked={!!picked[p.uuid]} onChange={() => setPicked((m) => ({ ...m, [p.uuid]: !m[p.uuid] }))} />
              <img src={p.image || FALLBACK_IMG} alt="" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
              <div className="kit-row-info">
                <strong>{p.name}</strong>
                <span className="kit-row-meta">{firstSize(p)}</span>
              </div>
              <span className="kit-price">{money(p.prices[firstSize(p)])}</span>
            </label>
          ))}
        </>
      )}

      <button ref={btnRef} type="button" className={`kit-add ${added ? 'added' : ''}`} onClick={addKit}>
        {added
          ? t('product.added')
          : `${t('kit.add')} · ${1 + chosen.length} ${1 + chosen.length === 1 ? t('kit.item') : t('kit.items')} · ${money(total)}`}
      </button>
      <p className="kit-foot">{t('kit.foot').replace('{year}', recipe.year)}</p>
    </section>
  );
}

import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { useKitState, money, firstSize } from './RecipeKit.jsx';

const FALLBACK_IMG = '/image/bagsbeans.png';

/** Kit editable en la propia tarjeta: tamaño, extras y "Añadir kit" con el total. */
function CardKit({ pairing }) {
  const { t } = useLanguage();
  const { size, setSize, picked, toggle, chosen, total, added, addKit } = useKitState(pairing);
  const { coffee, extras } = pairing;
  return (
    <div className="recipe-pair">
      <div className="recipe-pair-top">
        <img src={coffee.image || FALLBACK_IMG} alt="" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
        <div className="recipe-pair-info">
          <span className="recipe-pair-label">{t('kit.brewWith')}</span>
          <strong>{coffee.name}</strong>
          <span className="recipe-pair-price">{money(coffee.prices[size])} · {size}</span>
        </div>
      </div>
      {coffee.sizes.length > 1 && (
        <div className="recipe-pair-sizes" role="group" aria-label={t('product.size')}>
          {coffee.sizes.filter((s) => coffee.prices[s] != null).map((s) => (
            <button key={s} type="button" className={s === size ? 'active' : ''} aria-pressed={s === size} onClick={() => setSize(s)}>{s}</button>
          ))}
        </div>
      )}
      {extras.length > 0 && (
        <div className="recipe-pair-extras">
          {extras.map((p) => (
            <label key={p.uuid} className={picked[p.uuid] ? '' : 'is-off'}>
              <input type="checkbox" checked={!!picked[p.uuid]} onChange={() => toggle(p.uuid)} />
              <span>{p.name}</span>
              <em>{money(p.prices[firstSize(p)])}</em>
            </label>
          ))}
        </div>
      )}
      <button type="button" className={`recipe-kit-btn ${added ? 'added' : ''}`} onClick={addKit}>
        {added ? t('product.added') : `${t('kit.add')} · ${money(total)}`}
      </button>
      {chosen.length > 0 && !added && <span className="recipe-pair-count">{1 + chosen.length} {t('kit.items')}</span>}
    </div>
  );
}

export default function RecipeCard({ recipe, pairing, onOpen, onAskBarista }) {
  const { lang, t } = useLanguage();

  return (
    <article className="recipe-card" data-year={recipe.year}>
      <div className="recipe-card-head">
        <span className="recipe-year">{recipe.year}</span>
        <span className="recipe-flag">{recipe.flag}</span>
      </div>
      <h3 className="recipe-name">{recipe.name}</h3>
      <div className="recipe-place">{recipe.place[lang]}</div>
      <div className="recipe-jp">世界チャンピオン · {recipe.year}年</div>

      <div className="recipe-specs">
        <div className="spec"><span className="spec-v">{recipe.dose}</span><span className="spec-l">{t('recipeCard.dose')}</span></div>
        <div className="spec"><span className="spec-v">{recipe.temp}</span><span className="spec-l">{t('recipeCard.temp')}</span></div>
        <div className="spec"><span className="spec-v">{t(`position.${recipe.position}`)}</span><span className="spec-l">{t('recipeCard.position')}</span></div>
      </div>

      {pairing ? (
        <CardKit key={`${pairing.coffee.uuid}-${pairing.size}`} pairing={pairing} />
      ) : (
        <button type="button" className="recipe-kit-btn is-barista" onClick={() => onAskBarista(recipe)}>
          {t('barista.cardCta')}
        </button>
      )}

      <div className="recipe-actions">
        <button className="recipe-toggle" aria-expanded="false" onClick={() => onOpen(recipe)}>
          {t('recipeCard.viewFull')} <span className="chev">▾</span>
        </button>
      </div>
    </article>
  );
}

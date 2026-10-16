import { useLanguage } from '../../i18n/LanguageContext.jsx';

const money = (n) => `$${Number(n).toLocaleString('es-CO')}`;

export default function RecipeCard({ recipe, pairing, onOpen }) {
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

      {pairing && (
        <div className="recipe-pair">
          <img src={pairing.coffee.image || '/image/bagsbeans.png'} alt="" onError={(e) => { e.currentTarget.src = '/image/bagsbeans.png'; }} />
          <div className="recipe-pair-info">
            <span className="recipe-pair-label">{t('kit.brewWith')}</span>
            <strong>{pairing.coffee.name}</strong>
            <span className="recipe-pair-price">{money(pairing.coffee.prices[pairing.size])} · {pairing.size}</span>
          </div>
        </div>
      )}

      <div className="recipe-actions">
        {pairing && (
          <button type="button" className="recipe-kit-btn" onClick={() => onOpen(recipe, { kit: true })}>
            {t('kit.add')}
          </button>
        )}
        <button className="recipe-toggle" aria-expanded="false" onClick={() => onOpen(recipe)}>
          {t('recipeCard.viewFull')} <span className="chev">▾</span>
        </button>
      </div>
    </article>
  );
}

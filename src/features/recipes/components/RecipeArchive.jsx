import { useState } from 'react';
import recipes from '../data/recipes.js';
import RecipeBanners from './RecipeBanners.jsx';
import RecipeModal from './RecipeModal.jsx';
import BaristaChat from './BaristaChat.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import useRecipePairings from '../hooks/useRecipePairings.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';
import { useEditableTexts } from '../../../shared/lib/editableTexts.js';

const HEAD_FIELDS = [
  { key: 'recipes_title', label: 'Título de la sección' },
  { key: 'recipes_desc', label: 'Descripción', multiline: true },
];
const BARISTA_FIELDS = [
  { key: 'barista_title', label: 'Título del barista' },
  { key: 'barista_sub', label: 'Texto del barista', multiline: true },
];

export default function RecipeArchive() {
  const { t } = useLanguage();
  const [text, reloadTexts] = useEditableTexts(['recipes_title', 'recipes_desc', 'barista_title', 'barista_sub']);
  const [openRecipe, setOpenRecipe] = useState(null);
  const [focusKit, setFocusKit] = useState(false);
  const pairings = useRecipePairings();
  const open = (recipe, opts = {}) => { setFocusKit(!!opts.kit); setOpenRecipe(recipe); };
  // Pregunta al barista desde una tarjeta sin kit: qué café de la tienda le va a esa receta.
  const [baristaAsk, setBaristaAsk] = useState(null);
  const askBarista = (recipe) =>
    setBaristaAsk({ id: Date.now(), text: t('barista.askPrompt').replace('{year}', recipe.year).replace('{name}', recipe.name) });

  return (
    <>
      <div className="section-label" id="metodo">
        <span className="num">{t('section.num')}</span>
        <span className="rule"></span>
        <span className="sub">{t('section.sub')}</span>
      </div>

      <div className="sp" style={{ position: 'relative' }}>
        <SectionEditButton section="Recetas · textos" fig="FIG. 03 — ARCHIVO" onSaved={reloadTexts} fields={HEAD_FIELDS} />
        <h2 className="sec-h2">{text('recipes_title', t('section.title'))}</h2>
        <p className="sec-desc">
          {text('recipes_desc', t('section.desc'))}
          <span className="jp" style={{ display: 'block', marginTop: '.4rem' }}>
            {t('section.descJp')}
          </span>
        </p>
      </div>

      <RecipeBanners recipes={recipes} pairings={pairings} onOpen={open} onAskBarista={askBarista} />

      <div className="sp barista-wrap" id="barista">
        <div className="barista-heading" style={{ position: 'relative' }}>
          <SectionEditButton section="Barista · textos" fig="FIG. 03.2 — BARRA ABIERTA" onSaved={reloadTexts} fields={BARISTA_FIELDS} />
          <span className="barista-fig">{t('barista.fig')}</span>
          <h3>{text('barista_title', t('barista.title'))}</h3>
          <p>{text('barista_sub', t('barista.sub'))}</p>
        </div>
        <BaristaChat
          request={baristaAsk}
          onOpenRecipe={(year) => { const r = recipes.find((x) => x.year === year); if (r) open(r); }}
        />
      </div>

      <RecipeModal
        recipe={openRecipe}
        pairing={openRecipe ? pairings[openRecipe.year] : null}
        focusKit={focusKit}
        onClose={() => setOpenRecipe(null)}
      />
    </>
  );
}

import { useState } from 'react';
import recipes from '../data/recipes.js';
import RecipeBanners from './RecipeBanners.jsx';
import RecipeModal from './RecipeModal.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import useRecipePairings from '../hooks/useRecipePairings.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';
import { useEditableTexts } from '../../../shared/lib/editableTexts.js';

const HEAD_FIELDS = [
  { key: 'recipes_desc', label: 'Descripción', multiline: true },
];

export default function RecipeArchive() {
  const { t } = useLanguage();
  const [text, reloadTexts] = useEditableTexts(['recipes_desc']);
  const [openRecipe, setOpenRecipe] = useState(null);
  const [focusKit, setFocusKit] = useState(false);
  const pairings = useRecipePairings();
  const open = (recipe, opts = {}) => { setFocusKit(!!opts.kit); setOpenRecipe(recipe); };

  return (
    <>
      <div className="pg-champ-head" id="metodo" style={{ position: 'relative' }}>
        <SectionEditButton section="Recetas · textos" fig="FIG. 03 — ARCHIVO" onSaved={reloadTexts} fields={HEAD_FIELDS} />
        <p className="pg-mono">{t('page.champ.kicker')}</p>
        <h2 className="pg-wac">World <em>AeroPress</em> Championship</h2>
        <p className="pg-wac-s">{text('recipes_desc', t('page.champ.text'))}</p>
      </div>

      <RecipeBanners recipes={recipes} pairings={pairings} onOpen={open} />

      <RecipeModal
        recipe={openRecipe}
        pairing={openRecipe ? pairings[openRecipe.year] : null}
        focusKit={focusKit}
        onClose={() => setOpenRecipe(null)}
      />
    </>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import recipes from '../data/recipes.js';
import RecipeCard from './RecipeCard.jsx';
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
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef(null);

  const visibleRecipes = recipes;

  const scrollByCards = (dir) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('.recipe-card');
    const amount = (card?.offsetWidth || 300) + 20;
    track.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  // Calcula qué tarjeta está más cerca del centro del carrusel para
  // mantener el índice sincronizado con el movimiento del usuario.
  const updateActiveIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.querySelectorAll('.recipe-card'));
    if (!cards.length) return;
    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;
    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(cardCenter - trackCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateActiveIndex();
    track.addEventListener('scroll', updateActiveIndex, { passive: true });
    window.addEventListener('resize', updateActiveIndex);
    return () => {
      track.removeEventListener('scroll', updateActiveIndex);
      window.removeEventListener('resize', updateActiveIndex);
    };
  }, [updateActiveIndex]);

  const activeRecipe = visibleRecipes[activeIndex];

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

      <div className="recipe-index" id="recipeIndex" aria-live="polite">
        <span className="recipe-index-count">
          {String(activeIndex + 1).padStart(2, '0')} / {String(visibleRecipes.length).padStart(2, '0')}
        </span>
        {activeRecipe && <span className="recipe-index-year">{activeRecipe.year}</span>}
      </div>

      <div className="recipe-carousel-wrap">
        <SectionEditButton section="Recetas · café y kit" toolId="recipes" />
        <button className="recipe-arrow prev" aria-label="Prev" onClick={() => scrollByCards(-1)}>‹</button>
        <div className="recipe-blog" ref={trackRef}>
          {visibleRecipes.map((recipe) => (
            <RecipeCard key={recipe.year} recipe={recipe} pairing={pairings[recipe.year]} onOpen={open} onAskBarista={askBarista} />
          ))}
        </div>
        <button className="recipe-arrow next" aria-label="Next" onClick={() => scrollByCards(1)}>›</button>
      </div>

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

import { useCallback, useEffect, useRef, useState } from 'react';
import recipes from '../data/recipes.js';
import RecipeCard from './RecipeCard.jsx';
import RecipeModal from './RecipeModal.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function RecipeArchive() {
  const { t } = useLanguage();
  const [openRecipe, setOpenRecipe] = useState(null);
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

      <div className="sp">
        <h2 className="sec-h2">{t('section.title')}</h2>
        <p className="sec-desc">
          {t('section.desc')}
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
        <button className="recipe-arrow prev" aria-label="Prev" onClick={() => scrollByCards(-1)}>‹</button>
        <div className="recipe-blog" ref={trackRef}>
          {visibleRecipes.map((recipe) => (
            <RecipeCard key={recipe.year} recipe={recipe} onOpen={setOpenRecipe} />
          ))}
        </div>
        <button className="recipe-arrow next" aria-label="Next" onClick={() => scrollByCards(1)}>›</button>
      </div>

      <RecipeModal recipe={openRecipe} onClose={() => setOpenRecipe(null)} />
    </>
  );
}

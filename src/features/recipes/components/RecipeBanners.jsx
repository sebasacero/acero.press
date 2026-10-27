import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';
import { money, firstSize } from './RecipeKit.jsx';
import { isDevice } from '../../../shared/lib/pairing.js';
import ChampionVideo from './ChampionVideo.jsx';
import ChampionPhoto from './ChampionPhoto.jsx';
import '../../esspresale/esspresale.css';

// Cada receta campeona es un banner como los de la barra (cold brew, latte…):
// video de fondo, el cuadro de vidrio con la receta y el botón del kit recomendado.
//
// Video de fondo, en orden: URL guardada con el lápiz (app_config
// recipe_video_<año>) → /image/video-<año>.mp4 → video de la casa.
const HOUSE_VIDEOS = ['/image/hero_main1.mp4', '/image/cans.mp4'];
const SEGMENTS = 20;

const doseDigits = (dose) => {
  const n = String(parseFloat(dose) || 0).padStart(3, '0').slice(-3);
  return [...n, 'g'];
};
// Barra roja: temperatura entre 75 °C (vacía) y 100 °C (llena).
const tempFill = (temp) => Math.max(1, Math.min(SEGMENTS, Math.round(((parseFloat(temp) - 75) / 25) * SEGMENTS)));

function useRecipeVideos() {
  const [urls, setUrls] = useState({});
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('app_config').select('key, value').like('key', 'recipe_video_%');
    if (error) return;
    setUrls(Object.fromEntries((data ?? []).filter((r) => r.value).map((r) => [r.key.replace('recipe_video_', ''), r.value])));
  }, []);
  useEffect(() => { load(); }, [load]);
  return [urls, load];
}

function RecipeVideo({ recipe, index, custom, active }) {
  const ref = useRef(null);
  const sources = [custom, `/image/video-${recipe.year}.mp4`, HOUSE_VIDEOS[index % HOUSE_VIDEOS.length]].filter(Boolean);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [custom]);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else v.pause();
  }, [active, i]);
  // Solo el banner visible carga su video.
  if (!active) return <div className="rb-video rb-video--idle" aria-hidden="true" />;
  return (
    <video
      ref={ref}
      key={sources[i]}
      className="rb-video"
      src={sources[i]}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      poster="/image/local.jpg"
      aria-hidden="true"
      onError={() => setI((n) => Math.min(n + 1, sources.length - 1))}
    />
  );
}

function RecipeBanner({ recipe, index, pairing, active, video, onVideoSaved, onOpen }) {
  const { lang, t } = useLanguage();
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.inert = !active; }, [active]);
  // Total del kit como lo arma el modal: café + extras, sin la prensa (va desmarcada).
  const total = pairing
    ? pairing.coffee.prices[pairing.size] + pairing.extras.filter((p) => !isDevice(p)).reduce((s, p) => s + p.prices[firstSize(p)], 0)
    : null;

  return (
    <section ref={ref} className="rb-slide" aria-roledescription="slide" aria-label={`${recipe.year} · ${recipe.name}`} aria-hidden={!active}>
      <RecipeVideo recipe={recipe} index={index} custom={video} active={active} />
      <div className="rb-overlay" aria-hidden="true" />
      <SectionEditButton
        section={`Video receta ${recipe.year}`}
        fig={`FIG. 03 — WAC ${recipe.year}`}
        placement="hero"
        onSaved={onVideoSaved}
        fields={[{ key: `recipe_video_${recipe.year}`, label: 'Video de fondo (URL .mp4)', i18n: false, type: 'url', hint: `Vacío = /image/video-${recipe.year}.mp4 o el video de la casa.` }]}
      />

      <div className="rb-in">
        <div className="rb-copy">
          <ChampionPhoto key={recipe.year} recipe={recipe} className="rb-champ" load={active} />
          <div className="rb-tag"><span className="rb-dot" />{t('recipesBanner.fig').replace('{year}', recipe.year)} <span className="rb-flag">{recipe.flag}</span></div>
          <h3 className="rb-name">{recipe.name}</h3>
          <div className="rb-place">{recipe.place[lang]}</div>
          <ChampionVideo recipe={recipe} className="rb-play" />
          {/* El subtítulo japonés solo en japonés: en español era un tercer idioma a la vista */}
          {lang === 'ja' && <div className="rb-jp">世界チャンピオン · {recipe.year}年</div>}
        </div>

        <div className="rb-col">
          <div className="odometer-panel rb-panel">
            <div className="cota cota-top">
              <span className="annot">{t('recipesBanner.panel').replace('{year}', recipe.year)}</span>
              <span className="cota-badge">{t(`position.${recipe.position}`)}</span>
            </div>
            <div className="fig-label">{t('recipesBanner.doseLabel')}</div>
            <div className="odometer-row">
              <div className="odometer">
                {doseDigits(recipe.dose).map((d, n) => <span className="digit" key={n}>{d}</span>)}
              </div>
              <span className="odometer-sep">/</span>
              <span className="odometer-target">{recipe.temp}</span>
            </div>
            <div className="seg-bar">
              {Array.from({ length: SEGMENTS }).map((_, n) => (
                <div key={n} className={`seg ${n < tempFill(recipe.temp) ? 'filled' : ''}`} />
              ))}
            </div>
            <div className="progress-caption">{recipe.coffee[lang]}</div>
            {pairing && (
              <div className="cota cota-price">
                <span className="annot">{t('recipesBanner.brewWith')}</span>
                <span className="price-value rb-coffee">{pairing.coffee.name}</span>
              </div>
            )}
          </div>

          {pairing && (
            <button type="button" className="bar-order-btn rb-kit-btn" onClick={() => onOpen(recipe, { kit: true })}>
              <span>{t('recipesBanner.kitCta')}</span>
              <span>{money(total)} →</span>
            </button>
          )}
          <button type="button" className="rb-full" onClick={() => onOpen(recipe)}>{t('recipeCard.viewFull')} ▾</button>
        </div>
      </div>
    </section>
  );
}

/** Carrusel de banners de las recetas campeonas. */
export default function RecipeBanners({ recipes, pairings, onOpen }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [videos, reloadVideos] = useRecipeVideos();
  const go = (i) => setIndex(((i % recipes.length) + recipes.length) % recipes.length);
  const touchX = useRef(null);

  return (
    <div className="rb" aria-roledescription="carousel" aria-label={t('section.title')}>
      <SectionEditButton section="Recetas · café y kit" toolId="recipes" />
      <div
        className="rb-viewport"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <div className="rb-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {recipes.map((r, i) => (
            <RecipeBanner
              key={r.year}
              recipe={r}
              index={i}
              pairing={pairings[r.year]}
              active={i === index}
              video={videos[r.year]}
              onVideoSaved={reloadVideos}
              onOpen={onOpen}
            />
          ))}
        </div>
        <button type="button" className="coldbrew-carousel-arrow left" onClick={() => go(index - 1)} aria-label={t('shop.prev')}>‹</button>
        <button type="button" className="coldbrew-carousel-arrow right" onClick={() => go(index + 1)} aria-label={t('shop.next')}>›</button>
      </div>

      <div className="rb-years" role="tablist" aria-label={t('section.title')}>
        <span className="rb-count" aria-hidden="true">{String(index + 1).padStart(2, '0')} / {String(recipes.length).padStart(2, '0')}</span>
        {recipes.map((r, i) => (
          <button key={r.year} type="button" role="tab" aria-selected={i === index} onClick={() => go(i)}>{r.year}</button>
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';
import { money, firstSize } from './RecipeKit.jsx';
import { isDevice } from '../../../shared/lib/pairing.js';
import ChampionVideo from './ChampionVideo.jsx';
import { championOf, backdropOf } from '../data/champions.js';
import '../../esspresale/esspresale.css';

// Cada receta campeona es un banner como los de la barra (cold brew, latte…):
// de fondo el campeón (su foto y su video), el cuadro de vidrio con la receta y
// el botón del kit recomendado. Fondo, en orden: URL guardada con el lápiz
// (app_config recipe_video_<año>) → foto + video del WAC → video de la casa.
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

// Video de la casa: el fondo cuando el campeón no tiene foto que cargue ni video.
function HouseVideo({ sources, active }) {
  const ref = useRef(null);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [sources[0]]);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else v.pause();
  }, [active, i]);
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

// Sin video de fondo con «ahorro de datos» o si la persona pidió menos movimiento:
// queda la foto quieta, que ya cuenta quién ganó.
const prefersStill = () =>
  Boolean(navigator.connection?.saveData) || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Fondo del banner, a pantalla completa: la foto del campeón (WAC) como fondo de
 * pantalla y, encima, su video sonando sin sonido mientras el banner se ve. El
 * video guardado con el lápiz manda; si la foto no carga y no hay video, el de la casa.
 * Solo el banner visible, con la sección en pantalla, pide foto y video.
 */
function RecipeBackdrop({ recipe, index, custom, active, visible }) {
  const { t } = useLanguage();
  const champ = championOf(recipe.year);
  const [failed, setFailed] = useState(false);
  const [still] = useState(prefersStill);
  const moving = champ && !custom && !still ? backdropOf(champ.video) : null;

  if (!active) return <div className="rb-bg rb-bg--idle" aria-hidden="true" />;
  if (custom) return <div className="rb-bg"><HouseVideo sources={[custom, `/image/video-${recipe.year}.mp4`]} active /></div>;
  const photoOk = champ && !failed;
  return (
    <div className={`rb-bg${moving && visible ? ' is-moving' : ''}`}>
      {photoOk && (
        <img
          className="rb-photo"
          src={champ.photo}
          alt={t('champ.alt').replace('{name}', recipe.name).replace('{year}', recipe.year)}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
      {!photoOk && !moving && <HouseVideo sources={[`/image/video-${recipe.year}.mp4`, HOUSE_VIDEOS[index % HOUSE_VIDEOS.length]]} active />}
      {moving && visible && (
        <iframe
          className="rb-bgvideo"
          src={moving}
          title={`${t(`champ.videoKind.${champ.videoKind}`)} · ${recipe.name} ${recipe.year}`}
          allow="autoplay; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/** ¿Está la sección en pantalla? Los videos de fondo solo corren mientras se ve. */
function useOnScreen(ref) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

function RecipeBanner({ recipe, index, pairing, active, visible, video, onVideoSaved, onOpen }) {
  const { lang, t } = useLanguage();
  const ref = useRef(null);
  const champ = championOf(recipe.year);
  useEffect(() => { if (ref.current) ref.current.inert = !active; }, [active]);
  // Total del kit como lo arma el modal: café + extras, sin la prensa (va desmarcada).
  const total = pairing
    ? pairing.coffee.prices[pairing.size] + pairing.extras.filter((p) => !isDevice(p)).reduce((s, p) => s + p.prices[firstSize(p)], 0)
    : null;

  return (
    <section ref={ref} className="rb-slide" aria-roledescription="slide" aria-label={`${recipe.year} · ${recipe.name}`} aria-hidden={!active}>
      <RecipeBackdrop recipe={recipe} index={index} custom={video} active={active} visible={visible} />
      <div className="rb-overlay" aria-hidden="true" />
      <SectionEditButton
        section={`Video receta ${recipe.year}`}
        fig={`FIG. 03 — WAC ${recipe.year}`}
        placement="hero"
        onSaved={onVideoSaved}
        fields={[{ key: `recipe_video_${recipe.year}`, label: 'Video de fondo (URL .mp4)', i18n: false, type: 'url', hint: 'Vacío = la foto del campeón con su video del WAC (o el video de la casa si no hay).' }]}
      />

      <div className="rb-in">
        <div className="rb-copy">
          <div className="rb-tag"><span className="rb-dot" />{t('recipesBanner.fig').replace('{year}', recipe.year)} <span className="rb-flag">{recipe.flag}</span></div>
          <h3 className="rb-name">{recipe.name}</h3>
          <div className="rb-place">{recipe.place[lang]}</div>
          <div className="rb-media">
            <ChampionVideo recipe={recipe} className="rb-play" />
            {champ && (
              <a className="rb-credit" href={champ.final} target="_blank" rel="noopener noreferrer">{t('champ.photo')}: {champ.credit} ↗</a>
            )}
          </div>
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
  const root = useRef(null);
  const visible = useOnScreen(root);

  return (
    <div className="rb" ref={root} aria-roledescription="carousel" aria-label={t('section.title')}>
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
              visible={visible}
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

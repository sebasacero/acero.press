import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Navbar from '../../shared/layout/Navbar.jsx';
import { SheetFrame } from '../esspresale/parts.jsx';
import StepScrolly from '../home/sections/StepScrolly.jsx';
import { personaSrc } from '../home/sections/StreetPeople.jsx';
import StreetScene from '../home/sections/StreetScene.jsx';
import { fetchAppConfig } from '../../shared/lib/appConfig.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../shared/layout/WhatsAppButton.jsx';
import { lessonsFor } from './lessons.js';
import { resumeIndex, totalMinutes, lessonHash, lessonFromHash, clock, BASE_RECIPE } from './school.js';
import { readSeen, writeSeen } from './progress.js';
import LessonFigure from './LessonFigure.jsx';
import SchoolVideo from './SchoolVideo.jsx';
import CookMode, { useBrewTimer } from './CookMode.jsx';
import { track } from '../../shared/lib/analytics.js';
import './school.css';

// /escuela, en tres tramos y en el orden de la caja de la AeroPress:
//   1. Arriba, qué es y dos botones: preparar ya (el cronómetro) o ir a las lecciones.
//   2. La receta oficial de AeroPress Original paso a paso con el scroll (como Aprende en la portada).
//   2b. El video de la AeroPress dentro de un celular, que avanza con el scroll (SchoolVideo).
//   3. Las seis lecciones en tarjetas; se abre una a la vez, en su lugar, en computador y en celular.
// /escuela#leccion-3 abre esa lección (para mandarla por WhatsApp).
const num = (i) => String(i + 1).padStart(2, '0');
// La persona de la calle que acompaña cada lección en su tarjeta (ilustraciones, sin nombre)
const LESSON_PERSONA = { meet: 'aeropress', first: 'carrito', measure: 'ruana', taste: 'pareja', street: 'sombrilla', price: 'ruta' };
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Lo que tiene cada lección: entrada, la figura, la lista, el consejo, la práctica y para dónde seguir. */
function LessonBody({ lesson, index, count, isSeen, t, timer, onOpenTimer, onPrev, onNext, onFinish }) {
  const Points = lesson.numbered ? 'ol' : 'ul';
  return (
    <>
      <p className="sl-lead">{lesson.lead}</p>
      <div className="sl-grid">
        <LessonFigure lesson={lesson} index={index} t={t} timer={timer} onOpenTimer={onOpenTimer} />
        <div className="sl-text">
          <h3 className="sl-label">{lesson.pointsLabel}</h3>
          <Points className={`sl-points${lesson.numbered ? ' is-numbered' : ''}`}>
            {lesson.points.map((p) => <li key={p}>{p}</li>)}
          </Points>
          <aside className="sl-tip">
            <b>{t('school.tipLabel')}</b>
            <p>{lesson.tip}</p>
          </aside>
          <details className="sl-more">
            <summary>{t('school.practiceLabel')}</summary>
            <ol className="sl-practice">{lesson.practice.map((p) => <li key={p}>{p}</li>)}</ol>
          </details>
        </div>
      </div>
      <div className="sl-nav">
        {index > 0 && <button type="button" className="essp-btn is-ghost" onClick={onPrev}>← {t('school.prev')}</button>}
        {index < count - 1 ? (
          <button type="button" className="essp-btn" onClick={onNext}>{t('school.next')} →</button>
        ) : (
          // aria-disabled y no disabled: el botón conserva el foco después de terminar
          <button type="button" className="essp-btn" onClick={isSeen ? undefined : onFinish} aria-disabled={isSeen || undefined}>
            {isSeen ? `✓ ${t('school.seen')}` : t('school.finish')}
          </button>
        )}
      </div>
    </>
  );
}

export default function SchoolPage({ navOpen, onOpenNavDrawer }) {
  const { t, lang } = useLanguage();
  const lessons = lessonsFor(lang);
  const keysRef = useRef([]);
  keysRef.current = lessons.map((l) => l.key); // para medir sin rehacer open() en cada render
  const [seen, setSeen] = useState(() => readSeen());
  // Ninguna abierta al llegar: se ve el temario entero; #leccion-3 abre esa
  const [active, setActive] = useState(() => lessonFromHash(window.location.hash, lessons.length));
  const [whatsapp, setWhatsapp] = useState(`https://wa.me/${FALLBACK_WHATSAPP_NUMBER}`);
  const [cookOpen, setCookOpen] = useState(false);
  const timer = useBrewTimer();
  // A dónde llevar la vista (y el foco) después de pintar. Es estado y no ref: pedir la lección que
  // ya está abierta también tiene que mover la vista. Al llegar con #leccion-3, desde el primer cuadro.
  const [scrollReq, setScrollReq] = useState(() => {
    const i = lessonFromHash(window.location.hash, lessons.length);
    return i === null ? null : { i, focus: false };
  });
  const touched = useRef(false);
  const brew = lessons.find((l) => l.figure.kind === 'brew');

  useEffect(() => {
    const prev = document.title;
    document.title = t('school.metaTitle');
    return () => { document.title = prev; };
  }, [t]);
  useEffect(() => {
    fetchAppConfig('whatsapp_number', FALLBACK_WHATSAPP_NUMBER).then((n) => setWhatsapp(`https://wa.me/${n}`));
  }, []);

  // La dirección dice qué lección está abierta (se puede copiar y mandar); solo cuando la persona cambia de lección
  useEffect(() => {
    if (!touched.current) return;
    const { pathname, search } = window.location; // con ?utm=… de Instagram o WhatsApp intactos
    window.history.replaceState(null, '', `${pathname}${search}${active === null ? '' : lessonHash(active)}`);
  }, [active]);

  // Llevar la vista a la lección pedida (al llegar con #leccion-3, con «Siguiente» o desde el avance)
  useEffect(() => {
    if (!scrollReq) return;
    const { i, focus } = scrollReq;
    const el = document.getElementById(`leccion-${i + 1}`);
    if (el) {
      const top = el.getBoundingClientRect().top;
      // 'instant' y no 'auto': la página tiene scroll-behavior: smooth y 'auto' lo seguiría
      if (top < 0 || top > window.innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'instant' : 'smooth' });
    }
    // El botón que tenía el foco se fue con la lección cerrada: el foco pasa al título de la nueva
    if (focus) document.getElementById(`sa-btn-${lessons[i].key}`)?.focus({ preventScroll: true });
  }, [scrollReq, lessons]);
  const open = useCallback((i, { scroll = true, focus = false } = {}) => {
    touched.current = true;
    setActive(i);
    if (i !== null && keysRef.current[i]) track('school_lesson', { lesson: keysRef.current[i], index: i + 1 });
    if (scroll && i !== null) setScrollReq({ i, focus });
  }, []);
  // Un enlace a otra lección estando ya en /escuela (o atrás y adelante) solo cambia el #: abrir esa
  useEffect(() => {
    const onHash = () => {
      const i = lessonFromHash(window.location.hash, lessons.length);
      if (i !== null) open(i);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [lessons.length, open]);
  const markSeen = useCallback((key) => setSeen((s) => {
    if (s.includes(key)) return s;
    track('school_lesson_done', { lesson: key, seen: s.length + 1 });
    const next = [...s, key];
    writeSeen(next);
    return next;
  }), []);
  const goNext = (i) => { markSeen(lessons[i].key); open(i + 1, { focus: true }); };
  const goPrev = (i) => open(i - 1, { focus: true });
  const openCook = () => { track('school_timer'); setCookOpen(true); };
  const closeCook = useCallback(() => setCookOpen(false), []);

  const done = lessons.filter((l) => seen.includes(l.key)).length;
  const resume = resumeIndex(lessons, seen);
  const titleLines = t('school.titleLines');
  const minutes = totalMinutes(lessons);
  const recipe = t('school.recipe');
  const progressCta = done === 0
    ? { label: t('school.start'), to: 0 }
    : resume === -1
      ? { label: t('school.review'), to: 0 }
      : { label: t('school.resume').replace('{n}', resume + 1), to: resume };
  // El cronómetro sigue andando si se cierra: el botón lo dice y vuelve a él
  const timerLabel = timer.elapsed > 0 && timer.elapsed < BASE_RECIPE.total
    ? `${t('school.timer.back')} · ${clock(timer.elapsed)}`
    : t('school.timer.open');

  const bodyProps = (i) => ({
    lesson: lessons[i],
    index: i,
    count: lessons.length,
    isSeen: seen.includes(lessons[i].key),
    t,
    timer,
    onOpenTimer: openCook,
    onPrev: () => goPrev(i),
    onNext: () => goNext(i),
    onFinish: () => markSeen(lessons[i].key),
  });

  return (
    <main className="school school-page">
      <div className="school-sheet sp-sheet">
        <SheetFrame />
        {/* La calle del guion al pie: la cabecera, la persona y las cifras se paran en el andén */}
        <StreetScene className="sp-street" seed={11} />
        <Navbar variant="sheet" tone="paper" navOpen={navOpen} onOpenNavDrawer={onOpenNavDrawer} />
        <div className="school-in">
          <hr className="essp-dash" />
          <header className="sp-head">
            <div className="sp-copy">
              <div className="essp-tag">{t('school.tag')} <span className="essp-new">{t('school.badge')}</span></div>
              <h1 className="essp-title school-title" id="school-title">
                {titleLines[0]}{' '}<br />{titleLines[1]}
                <span className="essp-script">{t('school.script')}</span>
              </h1>
              <p className="essp-lede school-lede">{t('school.lede')}</p>
              <div className="essp-ctas">
                <button type="button" className="essp-btn" onClick={openCook}>{timerLabel}</button>
                <a className="essp-btn is-ghost" href="#lecciones">{t('school.lessonsCta')} ↓</a>
              </div>
              <div className="essp-loc">{t('school.loc')} · {t('school.total').replace('{min}', minutes)}</div>
            </div>
            {/* Una persona de la calle con su carrito: la Escuela es para quien prepara en la calle */}
            <img className="sp-persona" src={personaSrc('carrito')} alt="" decoding="async" aria-hidden="true" />
            {/* La receta de un vistazo, como las cifras de Micra en la portada */}
            <ul className="sp-glance" aria-label={t('school.glanceLabel')}>
              {t('school.glance').map(([v, k]) => <li key={v}><b>{v}</b><span>{k}</span></li>)}
            </ul>
          </header>
        </div>
      </div>

      <StepScrolly
        id="receta"
        tag={recipe.tag}
        badge={recipe.badge}
        title={recipe.title}
        script={recipe.script}
        steps={recipe.steps}
        labels={{ dots: recipe.dots, goStep: recipe.goStep, swipe: recipe.swipe }}
        source={recipe.source}
        persona={personaSrc('aeropress')}
        streetSeed={5}
        ctas={<button type="button" className="essp-btn" onClick={openCook}>{timerLabel}</button>}
      />

      <SchoolVideo
        t={t}
        ctas={(
          <>
            <button type="button" className="essp-btn" onClick={openCook}>{timerLabel}</button>
            <a className="essp-btn is-ghost" href="#lecciones">{t('school.lessonsCta')} ↓</a>
          </>
        )}
      />

      <div className="school-sheet school-lessons" id="lecciones">
        <SheetFrame />
        <StreetScene className="sp-street" seed={23} noon />
        <div className="school-in">
          <section className="sc" aria-labelledby="lecciones-title">
            <header className="sc-head">
              <div className="essp-tag">{t('school.lessonsTag')}</div>
              <h2 className="essp-title sc-title" id="lecciones-title">{t('school.lessonsTitle')}</h2>
              <p className="sc-text">{t('school.lessonsText')}</p>
              <div className="sp-progress" aria-label={t('school.progressLabel')}>
                <span className="sp-segs" aria-hidden="true">
                  {lessons.map((l) => <i key={l.key} className={seen.includes(l.key) ? 'on' : undefined} />)}
                </span>
                <span className="sp-progress-text">
                  {resume === -1 ? t('school.allDone') : t('school.progress').replace('{n}', done).replace('{total}', lessons.length)}
                </span>
                <button type="button" className="essp-btn is-ghost" onClick={() => open(progressCta.to, { focus: true })}>{progressCta.label}</button>
              </div>
            </header>

            <ol className="sa">
              {lessons.map((l, i) => {
                const isOpen = active === i;
                const isSeen = seen.includes(l.key);
                return (
                  <li key={l.key} id={`leccion-${i + 1}`} className={`sa-item${isOpen ? ' is-open' : ''}${isSeen ? ' is-seen' : ''}`}>
                    <h3 className="sa-h">
                      <button
                        type="button"
                        id={`sa-btn-${l.key}`}
                        aria-expanded={isOpen}
                        aria-controls={`sa-panel-${l.key}`}
                        onClick={() => open(isOpen ? null : i, { scroll: !isOpen })}
                      >
                        <span className="school-num">{num(i)}</span>
                        <span className="school-list-body">
                          <b>{l.title}</b>
                          {!isOpen && <span className="sa-lead">{l.lead}</span>}
                          <small>{l.mins} {t('school.min')}{isSeen ? ` · ✓ ${t('school.seen')}` : ''}</small>
                        </span>
                        {!isOpen && <img className="sa-persona" src={personaSrc(LESSON_PERSONA[l.key] ?? 'aeropress')} alt="" loading="lazy" decoding="async" aria-hidden="true" />}
                        <span className="sa-chev" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                      </button>
                    </h3>
                    {isOpen && (
                      <div className="sa-panel sl" id={`sa-panel-${l.key}`} role="region" aria-labelledby={`sa-btn-${l.key}`}>
                        <LessonBody {...bodyProps(i)} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="school-cta">
            <div>
              <b>{t('school.ctaTitle')}</b>
              <span>{t('school.ctaText')}</span>
            </div>
            <div className="essp-ctas">
              <a className="essp-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">{t('school.cta')}</a>
              <a className="essp-btn is-ghost" href="/#metodo">{t('school.ctaRecipes')}</a>
            </div>
          </div>
        </div>
      </div>
      {brew && <CookMode open={cookOpen} onClose={closeCook} timer={timer} figure={brew.figure} t={t} />}
    </main>
  );
}

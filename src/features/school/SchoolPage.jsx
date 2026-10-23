import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Navbar from '../../shared/layout/Navbar.jsx';
import { SheetFrame, Odometer } from '../esspresale/parts.jsx';
import { fetchAppConfig } from '../../shared/lib/appConfig.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../shared/layout/WhatsAppButton.jsx';
import { lessonsFor } from './lessons.js';
import { resumeIndex, totalMinutes, lessonHash, lessonFromHash } from './school.js';
import { readSeen, writeSeen } from './progress.js';
import LessonFigure from './LessonFigure.jsx';
import CookMode, { useBrewTimer } from './CookMode.jsx';
import './school.css';

// /escuela: la Escuela en su propia página, en la hoja de plano de la portada.
// En computador, el temario a la izquierda y la lección a la derecha (pestañas,
// también con flechas del teclado). En celular, el temario completo a la vista y
// cada lección se abre debajo de su título (acordeón): ninguna lección queda escondida.
// /escuela#leccion-3 abre esa lección (para mandarla por WhatsApp).
const NARROW = '(max-width: 760px)';
const num = (i) => String(i + 1).padStart(2, '0');
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function useNarrow() {
  const [narrow, setNarrow] = useState(() => !!window.matchMedia?.(NARROW).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW);
    if (!mq) return undefined;
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return narrow;
}

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
          <h3 className="sl-label">{t('school.practiceLabel')}</h3>
          <ol className="sl-practice">{lesson.practice.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      </div>
      <div className="sl-nav">
        {index > 0 && <button type="button" className="essp-btn is-ghost" onClick={onPrev}>← {t('school.prev')}</button>}
        {index < count - 1 ? (
          <button type="button" className="essp-btn" onClick={onNext}>{t('school.next')} →</button>
        ) : (
          <button type="button" className="essp-btn" onClick={onFinish} disabled={isSeen}>
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
  const narrow = useNarrow();
  const [seen, setSeen] = useState(() => readSeen());
  // En celular puede no haber ninguna abierta (se ve el temario entero); en computador siempre hay una
  const [active, setActive] = useState(() => lessonFromHash(window.location.hash, lessons.length) ?? (window.matchMedia?.(NARROW).matches ? null : 0));
  const [whatsapp, setWhatsapp] = useState(`https://wa.me/${FALLBACK_WHATSAPP_NUMBER}`);
  const [cookOpen, setCookOpen] = useState(false);
  const timer = useBrewTimer();
  const tabRefs = useRef([]);
  // A dónde llevar la vista después de pintar: al llegar con #leccion-3, ya en el primer cuadro
  const scrollTo = useRef(lessonFromHash(window.location.hash, lessons.length));
  const touched = useRef(false);
  const shown = active ?? (narrow ? null : 0);
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
    const url = shown === null ? window.location.pathname : `${window.location.pathname}${lessonHash(shown)}`;
    window.history.replaceState(null, '', url);
  }, [shown]);

  // Llevar la vista a la lección elegida (al llegar con #leccion-3, con «Siguiente» o desde el avance)
  useEffect(() => {
    if (scrollTo.current === null) return;
    const i = scrollTo.current;
    scrollTo.current = null;
    const el = document.getElementById(narrow ? `leccion-${i + 1}` : 'temario');
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
  const open = useCallback((i, { scroll = true } = {}) => {
    touched.current = true;
    if (scroll) scrollTo.current = i;
    setActive(i);
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
    const next = [...s, key];
    writeSeen(next);
    return next;
  }), []);
  const goNext = (i) => { markSeen(lessons[i].key); open(i + 1); };
  const goPrev = (i) => open(i - 1);
  const closeCook = useCallback(() => setCookOpen(false), []);

  // Pestañas del temario (computador): flechas, Inicio y Fin, como pide el patrón de pestañas
  const onTabKey = (e) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let i = null;
    if (keys[e.key]) i = (shown + keys[e.key] + lessons.length) % lessons.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = lessons.length - 1;
    if (i === null) return;
    e.preventDefault();
    open(i, { scroll: false });
    tabRefs.current[i]?.focus();
  };

  const done = lessons.filter((l) => seen.includes(l.key)).length;
  const resume = resumeIndex(lessons, seen);
  const titleLines = t('school.titleLines');
  const minutes = totalMinutes(lessons);
  const progressCta = done === 0
    ? { label: t('school.start'), to: 0 }
    : resume === -1
      ? { label: t('school.review'), to: 0 }
      : { label: t('school.resume').replace('{n}', resume + 1), to: resume };

  const bodyProps = (i) => ({
    lesson: lessons[i],
    index: i,
    count: lessons.length,
    isSeen: seen.includes(lessons[i].key),
    t,
    timer,
    onOpenTimer: () => setCookOpen(true),
    onPrev: () => goPrev(i),
    onNext: () => goNext(i),
    onFinish: () => markSeen(lessons[i].key),
  });
  const meta = (l) => `${l.mins} ${t('school.min')}${seen.includes(l.key) ? ` · ✓ ${t('school.seen')}` : ''}`;

  return (
    <main className="school school-page">
      <div className="school-sheet">
        <SheetFrame />
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
              <div className="essp-loc">{t('school.loc')}</div>
              <p className="essp-lede school-lede">{t('school.lede')}</p>
            </div>

            {/* El avance, como el panel del odómetro de la portada: cuánto llevas y por dónde seguir */}
            <aside className="sp-progress" aria-label={t('school.progressLabel')}>
              <div className="essp-panel-cota"><span>{t('school.progressLabel')}</span><span className="essp-badge">{t('school.total').replace('{min}', minutes)}</span></div>
              <div className="essp-odo-row">
                <Odometer digits={[String(done)]} />
                <span className="essp-odo-sep">/</span>
                <span className="essp-odo-target">{lessons.length}</span>
              </div>
              <span className="sp-segs" aria-hidden="true">
                {lessons.map((l) => <i key={l.key} className={seen.includes(l.key) ? 'on' : undefined} />)}
              </span>
              <p className="sp-progress-text">
                {resume === -1 ? t('school.allDone') : t('school.progress').replace('{n}', done).replace('{total}', lessons.length)}
              </p>
              <button type="button" className="essp-btn" onClick={() => open(progressCta.to)}>{progressCta.label}</button>
            </aside>
          </header>

          <section className="sc" id="temario" aria-label={t('school.outline')}>
            {narrow ? (
              <ol className="sa">
                {lessons.map((l, i) => {
                  const isOpen = shown === i;
                  return (
                    <li key={l.key} id={`leccion-${i + 1}`} className={`sa-item${isOpen ? ' is-open' : ''}${seen.includes(l.key) ? ' is-seen' : ''}`}>
                      <h2 className="sa-h">
                        <button
                          type="button"
                          id={`sa-btn-${l.key}`}
                          aria-expanded={isOpen}
                          aria-controls={`sa-panel-${l.key}`}
                          onClick={() => open(isOpen ? null : i, { scroll: !isOpen })}
                        >
                          <span className="school-num">{num(i)}</span>
                          <span className="school-list-body"><b>{l.title}</b><small>{meta(l)}</small></span>
                          <span className="sa-chev" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                        </button>
                      </h2>
                      {isOpen && (
                        <div className="sa-panel sl" id={`sa-panel-${l.key}`} role="region" aria-labelledby={`sa-btn-${l.key}`}>
                          <LessonBody {...bodyProps(i)} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="sc-grid">
                <div className="sc-list" role="tablist" aria-orientation="vertical" aria-label={t('school.outline')} onKeyDown={onTabKey}>
                  {lessons.map((l, i) => (
                    <button
                      key={l.key}
                      type="button"
                      role="tab"
                      id={`tab-${l.key}`}
                      ref={(el) => { tabRefs.current[i] = el; }}
                      aria-selected={i === shown}
                      aria-controls="sl-panel"
                      tabIndex={i === shown ? 0 : -1}
                      className={seen.includes(l.key) ? 'is-seen' : undefined}
                      onClick={() => open(i, { scroll: false })}
                    >
                      <span className="school-num">{num(i)}</span>
                      <span className="school-list-body"><b>{l.title}</b><small>{meta(l)}</small></span>
                    </button>
                  ))}
                </div>
                <article className="sl" id="sl-panel" role="tabpanel" aria-labelledby={`tab-${lessons[shown].key}`}>
                  <header className="sl-head">
                    <span className="school-fig">{t('school.lessonOf').replace('{n}', shown + 1).replace('{total}', lessons.length)} · {lessons[shown].mins} {t('school.min')}</span>
                    <h2>{lessons[shown].title}</h2>
                  </header>
                  <LessonBody {...bodyProps(shown)} />
                </article>
              </div>
            )}
          </section>

          <div className="essp-block school-cta">
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

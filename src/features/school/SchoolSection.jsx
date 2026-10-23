import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { SheetFrame, Segs } from '../esspresale/parts.jsx';
import { fetchAppConfig } from '../../shared/lib/appConfig.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../shared/layout/WhatsAppButton.jsx';
import { lessonsFor } from './lessons.js';
import { BASE_RECIPE, BREW_STEPS, brewStepAt, untilNext, clock, parseAmount, cupMath } from './school.js';
import './school.css';

// Escuela: aprender a ser barista empezando por la AeroPress. Seis lecciones
// cortas en la misma hoja de plano de la portada; la de la primera taza trae un
// cronómetro y la del precio una calculadora. Lo visto se recuerda en este
// navegador (solo es una comodidad: si no hay almacenamiento, empieza de cero).
const SEEN_KEY = 'acero.escuela.vistas';
const num = (i) => String(i + 1).padStart(2, '0');

function readSeen() {
  try {
    const v = JSON.parse(window.localStorage.getItem(SEEN_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function writeSeen(list) {
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(list)); } catch { /* sin almacenamiento: no pasa nada */ }
}

const peso = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const money = (v) => (v === null || v === undefined ? '—' : `$${peso.format(Math.round(v))}`);

/** Cronómetro de la receta base: el paso de ahora en grande y cuánto falta para el siguiente. */
function BrewTimer({ t }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef(0);
  const lastStep = useRef(0);
  const total = BASE_RECIPE.total;

  useEffect(() => {
    if (!running) return undefined;
    startRef.current = performance.now() - elapsed * 1000;
    const id = window.setInterval(() => {
      const s = Math.min(total, (performance.now() - startRef.current) / 1000);
      setElapsed(s);
      if (s >= total) setRunning(false);
    }, 200);
    return () => window.clearInterval(id);
    // elapsed solo se lee al arrancar o seguir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, total]);

  const i = brewStepAt(elapsed);
  // Un toque en el celular cuando cambia el paso: se puede preparar sin mirar la pantalla
  useEffect(() => {
    if (i !== lastStep.current) {
      lastStep.current = i;
      if (running || i === BREW_STEPS.length - 1) navigator.vibrate?.(i === BREW_STEPS.length - 1 ? [80, 60, 80] : 60);
    }
  }, [i, running]);

  const wait = untilNext(elapsed);
  const started = elapsed > 0;
  const reset = () => { setRunning(false); setElapsed(0); lastStep.current = 0; };

  return (
    <div className="school-tool school-timer" role="group" aria-label={t('school.timer.fig')}>
      <div className="essp-panel-cota"><span>{t('school.timer.fig')}</span><span className="essp-badge">{clock(total)}</span></div>
      <div className="essp-panel-label">{t('school.timer.recipe')}</div>
      <div className="school-clock" aria-live="off">{clock(elapsed)}</div>
      <Segs filled={Math.round((elapsed / total) * 20)} className="essp-bar" />
      <p className="school-now" aria-live="polite">
        <b>{t(`school.timer.steps.${BREW_STEPS[i].key}`)}</b>
        {started && wait !== null && <span>{t('school.timer.next')} {Math.ceil(wait)} s</span>}
      </p>
      <ol className="school-steps">
        {BREW_STEPS.map((s, k) => (
          <li key={s.key} className={k === i && started ? 'is-on' : k < i ? 'is-done' : ''}>
            <span>{clock(s.at)}</span>{t(`school.timer.steps.${s.key}`)}
          </li>
        ))}
      </ol>
      <div className="school-tool-actions">
        {elapsed >= total ? null : (
          <button type="button" className="essp-btn" onClick={() => setRunning((r) => !r)}>
            {running ? t('school.timer.pause') : started ? t('school.timer.resume') : t('school.timer.start')}
          </button>
        )}
        {started && <button type="button" className="essp-btn is-ghost" onClick={reset}>{t('school.timer.reset')}</button>}
      </div>
    </div>
  );
}

/** La cuenta de la taza con los números de cada quien (nada se guarda ni se envía). */
function CupCost({ t }) {
  const [form, setForm] = useState({ libra: '', grams: String(BASE_RECIPE.coffee), extras: '', price: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const r = cupMath({
    libra: parseAmount(form.libra),
    grams: parseAmount(form.grams),
    extras: parseAmount(form.extras) ?? 0,
    price: parseAmount(form.price),
  });
  const field = (k, placeholder) => (
    <label className="school-field">
      <span>{t(`school.cost.${k}`)}</span>
      <input inputMode="decimal" autoComplete="off" value={form[k]} onChange={set(k)} placeholder={placeholder} />
    </label>
  );
  return (
    <div className="school-tool school-cost" role="group" aria-label={t('school.cost.fig')}>
      <div className="essp-panel-cota"><span>{t('school.cost.fig')}</span></div>
      <div className="school-fields">
        {field('libra', '20.000')}
        {field('grams', '15')}
        {field('extras', '200')}
        {field('price', '3.000')}
      </div>
      {r.cost === null ? (
        <p className="school-empty">{t('school.cost.empty')}</p>
      ) : (
        <div className="essp-specs school-results" aria-live="polite">
          <div><b>{money(r.cost)}</b><span>{t('school.cost.cost')}</span></div>
          <div><b>{money(r.profit)}</b><span>{t('school.cost.profit')}</span></div>
          <div><b>{r.margin === null ? '—' : `${Math.round(r.margin * 100)} %`}</b><span>{t('school.cost.margin')}</span></div>
        </div>
      )}
      {r.cost !== null && (
        <p className="school-cost-foot">{t('school.cost.coffee')}: {money(r.coffee)} · {t('school.cost.cups')}: {r.cupsPerLibra ?? '—'}</p>
      )}
    </div>
  );
}

export default function SchoolSection() {
  const { t, lang } = useLanguage();
  const lessons = lessonsFor(lang);
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState([]);
  const [whatsapp, setWhatsapp] = useState(`https://wa.me/${FALLBACK_WHATSAPP_NUMBER}`);
  const panelRef = useRef(null);

  useEffect(() => { setSeen(readSeen()); }, []);
  useEffect(() => {
    fetchAppConfig('whatsapp_number', FALLBACK_WHATSAPP_NUMBER).then((n) => setWhatsapp(`https://wa.me/${n}`));
  }, []);

  const lesson = lessons[active];
  const markSeen = (key) => setSeen((s) => {
    if (s.includes(key)) return s;
    const next = [...s, key];
    writeSeen(next);
    return next;
  });
  const goNext = () => {
    markSeen(lesson.key);
    setActive((i) => Math.min(lessons.length - 1, i + 1));
    // En el celular la lista queda arriba: lleva la vista al comienzo de la lección
    panelRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  };
  const titleLines = t('school.titleLines');
  const done = lessons.filter((l) => seen.includes(l.key)).length;

  return (
    <section className="school" id="escuela" aria-labelledby="school-title">
      <div className="school-sheet">
        <SheetFrame />
        <div className="school-in">
          <hr className="essp-dash" />
          <header className="school-head">
            <div className="essp-tag">{t('school.tag')} <span className="essp-new">{t('school.badge')}</span></div>
            <h2 className="essp-title school-title" id="school-title">
              {titleLines[0]}{' '}<br />{titleLines[1]}
              <span className="essp-script">{t('school.script')}</span>
            </h2>
            <div className="essp-loc">{t('school.loc')}</div>
            <p className="essp-lede school-lede">{t('school.lede')}</p>
            <div className="school-progress">
              <span>{t('school.progress').replace('{n}', done).replace('{total}', lessons.length)}</span>
              <span className="school-progress-bar" aria-hidden="true">
                {lessons.map((l) => <i key={l.key} className={seen.includes(l.key) ? 'on' : undefined} />)}
              </span>
            </div>
          </header>

          <div className={`school-body${lesson.tool ? ' has-tool' : ''}`}>
            <div className="school-list" role="tablist" aria-label={t('school.lessonsLabel')}>
              {lessons.map((l, i) => (
                <button
                  key={l.key}
                  type="button"
                  role="tab"
                  id={`school-tab-${l.key}`}
                  aria-selected={i === active}
                  aria-controls="school-panel"
                  className={seen.includes(l.key) ? 'is-seen' : undefined}
                  onClick={() => setActive(i)}
                >
                  <span className="school-num">{num(i)}</span>
                  <span className="school-list-body">
                    <b>{l.title}</b>
                    <small>{l.mins} {t('school.min')}{seen.includes(l.key) ? ` · ✓ ${t('school.seen')}` : ''}</small>
                  </span>
                </button>
              ))}
            </div>

            <article className="school-lesson" id="school-panel" role="tabpanel" aria-labelledby={`school-tab-${lesson.key}`} ref={panelRef}>
              <span className="school-fig">FIG. 05.{active + 1} · {lesson.mins} {t('school.min')}</span>
              <h3>{lesson.title}</h3>
              <p className="school-lead">{lesson.lead}</p>
              <ul className="school-points">
                {lesson.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
              <aside className="school-tip">
                <b>{t('school.tipLabel')}</b>
                <p>{lesson.tip}</p>
              </aside>
              <div className="school-practice">
                <b>{t('school.practiceLabel')}</b>
                <ol>{lesson.practice.map((p) => <li key={p}>{p}</li>)}</ol>
              </div>
              <div className="school-lesson-actions">
                {active < lessons.length - 1 ? (
                  <button type="button" className="essp-btn" onClick={goNext}>{t('school.next')} →</button>
                ) : (
                  <button type="button" className="essp-btn" onClick={() => markSeen(lesson.key)} disabled={seen.includes(lesson.key)}>
                    {seen.includes(lesson.key) ? `✓ ${t('school.seen')}` : t('school.markSeen')}
                  </button>
                )}
              </div>
            </article>

            {lesson.tool === 'timer' && <BrewTimer t={t} />}
            {lesson.tool === 'cost' && <CupCost t={t} />}
          </div>

          <div className="essp-block school-cta">
            <div>
              <b>{t('school.ctaTitle')}</b>
              <span>{t('school.ctaText')}</span>
            </div>
            <div className="essp-ctas">
              <a className="essp-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">{t('school.cta')}</a>
              <a className="essp-btn is-ghost" href="#metodo">{t('school.ctaRecipes')}</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

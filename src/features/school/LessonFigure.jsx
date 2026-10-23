import { useState } from 'react';
import { BREW_STEPS, brewStepAt, clock, parseAmount, cupMath, shares, BASE_RECIPE } from './school.js';

// Las figuras de las lecciones: cada una muestra lo que la lección cuenta.
// Todas van en la misma lámina clara (cota FIG. arriba) para que ninguna lección
// cambie de forma; el cronómetro a pantalla completa vive en CookMode.

const peso = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const money = (v) => (v === null || v === undefined ? '—' : `$${peso.format(Math.round(v))}`);

function Plate({ fig, caption, children, className = '' }) {
  return (
    <figure className={`sf ${className}`}>
      <figcaption className="sf-cota"><span>{fig}</span><span>{caption}</span></figcaption>
      {children}
    </figure>
  );
}

/** Despiece de la AeroPress en dibujo técnico: los números son los de la lista de partes. */
function Parts({ fig, figure, points }) {
  const callout = (n, x, y, tx, ty) => (
    <g key={`${n}-${x}-${y}`}>
      <line x1={x + 12} y1={y} x2={tx} y2={ty} className="sf-leader" />
      <circle cx={x} cy={y} r="12" className="sf-badge" />
      <text x={x} y={y + 4} textAnchor="middle" className="sf-badge-n">{n}</text>
    </g>
  );
  return (
    <Plate fig={fig} caption={figure.caption}>
      <svg viewBox="0 0 300 340" className="sf-parts" role="img" aria-label={`${figure.caption}: ${points.join(' ')}`}>
        <line x1="150" y1="6" x2="150" y2="334" className="sf-axis" />
        {/* 2 · émbolo */}
        <rect x="92" y="14" width="116" height="12" rx="3" className="sf-part" />
        <rect x="104" y="26" width="92" height="90" rx="3" className="sf-part" />
        <line x1="116" y1="40" x2="116" y2="104" className="sf-detail" />
        <rect x="101" y="112" width="98" height="18" rx="4" className="sf-seal" />
        {/* flechas del armado */}
        <path d="M150 134 v10 m-5 -5 l5 5 l5 -5" className="sf-arrow" />
        {/* 1 · cámara con sus números */}
        <rect x="78" y="148" width="144" height="10" rx="3" className="sf-part" />
        <rect x="96" y="158" width="108" height="114" rx="3" className="sf-part" />
        {[0, 1, 2, 3].map((k) => (
          <g key={k}>
            <line x1="104" y1={254 - k * 20} x2="114" y2={254 - k * 20} className="sf-detail" />
            <text x="120" y={257 - k * 20} className="sf-mark">{k + 1}</text>
          </g>
        ))}
        <path d="M150 292 v-10 m-5 5 l5 -5 l5 5" className="sf-arrow" />
        {/* 3 · filtro de papel y tapa */}
        <ellipse cx="150" cy="298" rx="46" ry="4" className="sf-filter" />
        <rect x="98" y="306" width="104" height="16" rx="5" className="sf-part" />
        {[0, 1, 2, 3, 4, 5, 6].map((k) => <circle key={k} cx={114 + k * 12} cy="314" r="1.8" className="sf-hole" />)}
        {/* 4 · agitador y cuchara */}
        <rect x="246" y="30" width="10" height="150" rx="4" className="sf-part" />
        <rect x="238" y="176" width="26" height="44" rx="5" className="sf-part" />
        <path d="M232 262 h40 l-5 30 a5 5 0 0 1 -5 4 h-20 a5 5 0 0 1 -5 -4 z" className="sf-part" />
        <line x1="272" y1="266" x2="290" y2="250" className="sf-part-line" />
        {callout(2, 40, 70, 104, 70)}
        {callout(1, 40, 214, 96, 214)}
        {callout(3, 40, 310, 98, 310)}
        {callout(4, 220, 120, 246, 120)}
        {callout(4, 214, 286, 232, 280)}
      </svg>
    </Plate>
  );
}

/** La receta base: lo que lleva y sus cinco momentos, con el botón para prepararla con el cronómetro. */
function Brew({ fig, figure, t, timer, onOpen }) {
  const started = timer.elapsed > 0;
  const now = brewStepAt(timer.elapsed);
  return (
    <Plate fig={fig} caption={figure.caption} className="sf-brew">
      <ul className="sf-recipe" aria-label={figure.caption}>
        {figure.recipe.map((r) => <li key={r}>{r}</li>)}
      </ul>
      <ol className="sf-steps">
        {BREW_STEPS.map((s, i) => (
          <li key={s.key} className={started && i === now ? 'is-on' : started && i < now ? 'is-done' : undefined}>
            <span className="sf-step-t">{clock(s.at)}</span>
            <span className="sf-step-body"><b>{figure.steps[i].title}</b><span>{figure.steps[i].detail}</span></span>
          </li>
        ))}
      </ol>
      <button type="button" className="essp-btn sf-open" onClick={onOpen}>
        {started && timer.elapsed < BASE_RECIPE.total
          ? `${t('school.timer.back')} · ${clock(timer.elapsed)}`
          : t('school.timer.open')}
      </button>
      <p className="sf-note">{t('school.timer.awake')}</p>
    </Plate>
  );
}

/** Una taza, pesada: lo que marca la báscula para el café y el agua, y la proporción a escala. */
function Measure({ fig, figure }) {
  const [coffee, water] = figure.readouts;
  return (
    <Plate fig={fig} caption={figure.caption} className="sf-measure">
      <div className="sf-readouts">
        <div className="sf-readout"><span>{coffee}</span><b>{BASE_RECIPE.coffee} g</b></div>
        <span className="sf-plus" aria-hidden="true">+</span>
        <div className="sf-readout"><span>{water}</span><b>{BASE_RECIPE.water} g</b></div>
      </div>
      <div className="sf-ratio">
        <strong>{figure.ratio.value}</strong>
        <span>{figure.ratio.text}</span>
        {/* A escala: el café es 1 de cada 16 partes de lo que entra a la cámara */}
        <div className="sf-ratio-bar" aria-hidden="true">
          <i className="is-coffee" style={{ flexGrow: BASE_RECIPE.coffee }} />
          <i className="is-water" style={{ flexGrow: BASE_RECIPE.water }} />
        </div>
      </div>
    </Plate>
  );
}

/** Escala de extracción: de agrio a amargo, con lo que se cambia en cada lado. */
function Taste({ fig, figure }) {
  return (
    <Plate fig={fig} caption={figure.caption} className="sf-taste">
      <div className="sf-taste-fixes">
        <span className="is-under">{figure.fixUnder} →</span>
        <span className="is-over">← {figure.fixOver}</span>
      </div>
      <div className="sf-taste-bar" aria-hidden="true"><i /></div>
      <ul className="sf-taste-labels">
        <li><b>{figure.under.label}</b><span>{figure.under.hint}</span></li>
        <li className="is-ok"><b>{figure.ok.label}</b><span>{figure.ok.hint}</span></li>
        <li><b>{figure.over.label}</b><span>{figure.over.hint}</span></li>
      </ul>
      <p className="sf-taste-dose"><span aria-hidden="true">±</span>{figure.dose}</p>
    </Plate>
  );
}

/** La barra en orden (de izquierda a derecha) y la meta de tiempo por taza. */
function Bar({ fig, figure }) {
  const { total, parts } = shares(figure.time);
  return (
    <Plate fig={fig} caption={figure.caption} className="sf-bar">
      <ol className="sf-stations">
        {figure.stations.map((s, i) => (
          <li key={s}><span>{i + 1}</span>{s}</li>
        ))}
      </ol>
      <div className="sf-time">
        <b>{figure.timeLabel}</b>
        <div className="sf-time-bar" role="img" aria-label={`${figure.timeLabel}: ${parts.map((p) => `${p.label} ${clock(p.s)}`).join(', ')}`}>
          {parts.map((p, i) => <i key={p.label} className={`is-${i}`} style={{ flexGrow: p.share }} />)}
        </div>
        <ul className="sf-time-legend">
          {parts.map((p, i) => <li key={p.label}><i className={`is-${i}`} />{p.label} <span>{clock(p.s)}</span></li>)}
          <li className="is-total">{clock(total)}</li>
        </ul>
      </div>
    </Plate>
  );
}

/** La cuenta de la taza con los números de cada quien (nada se guarda ni se envía). */
function Cost({ fig, figure, t }) {
  const [form, setForm] = useState({ libra: '', grams: String(BASE_RECIPE.coffee), extras: '', price: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const r = cupMath({
    libra: parseAmount(form.libra),
    grams: parseAmount(form.grams),
    extras: parseAmount(form.extras) ?? 0,
    price: parseAmount(form.price),
  });
  const field = (k, placeholder, unit) => (
    <label className="sf-field">
      <span>{t(`school.cost.${k}`)}</span>
      <span className={`sf-input ${unit === '$' ? 'is-money' : 'is-unit'}`}>
        {unit === '$' && <i aria-hidden="true">$</i>}
        <input inputMode="decimal" autoComplete="off" value={form[k]} onChange={set(k)} placeholder={placeholder} />
        {unit !== '$' && <i aria-hidden="true">{unit}</i>}
      </span>
    </label>
  );
  return (
    <Plate fig={fig} caption={figure.caption} className="sf-cost">
      <div className="sf-fields">
        {field('libra', '20.000', '$')}
        {field('grams', '15', 'g')}
        {field('extras', '200', '$')}
        {field('price', '3.000', '$')}
      </div>
      {r.cost === null ? (
        <p className="sf-empty">{t('school.cost.empty')}</p>
      ) : (
        <>
          <dl className="sf-results" aria-live="polite">
            <div><dt>{t('school.cost.cost')}</dt><dd>{money(r.cost)}</dd></div>
            <div className="is-main"><dt>{t('school.cost.profit')}</dt><dd>{money(r.profit)}</dd></div>
            <div><dt>{t('school.cost.margin')}</dt><dd>{r.margin === null ? '—' : `${Math.round(r.margin * 100)} %`}</dd></div>
          </dl>
          <p className="sf-note">{t('school.cost.coffee')}: {money(r.coffee)} · {t('school.cost.cups')}: {r.cupsPerLibra ?? '—'}</p>
        </>
      )}
      <p className="sf-note">{t('school.cost.note')}</p>
    </Plate>
  );
}

export default function LessonFigure({ lesson, index, t, timer, onOpenTimer }) {
  const fig = `FIG. 05.${index + 1}`;
  const { figure } = lesson;
  switch (figure.kind) {
    case 'parts': return <Parts fig={fig} figure={figure} points={lesson.points} />;
    case 'brew': return <Brew fig={fig} figure={figure} t={t} timer={timer} onOpen={onOpenTimer} />;
    case 'measure': return <Measure fig={fig} figure={figure} />;
    case 'taste': return <Taste fig={fig} figure={figure} />;
    case 'bar': return <Bar fig={fig} figure={figure} />;
    case 'cost': return <Cost fig={fig} figure={figure} t={t} />;
    default: return null;
  }
}

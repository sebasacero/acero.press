import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import { fetchPulse, weatherKind, weatherTip } from '../../../shared/lib/pulse.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';

const classes = ['mh', '', 'mc', '', 'mh', '', 'mc', '', 'mh', '', 'mc'];
const MARQUEE_FIELDS = [
  {
    key: 'marquee',
    label: 'Frases de la cinta',
    multiline: true,
    hint: 'Separa cada frase con | (barra vertical). Ej.: Ethiopia Yirgacheffe | 1:15 · 92°C | Bourbon Rosado',
  },
];
const LOCALES = { es: 'es-CO', en: 'en-US', ja: 'ja-JP' };

// Variación frente al dato anterior: ▲ 0,4 % · ▼ 1,1 % · = 0,0 %
function delta(value, prev, locale) {
  if (!Number.isFinite(prev) || !prev) return null;
  const pct = ((value - prev) / prev) * 100;
  const dir = Math.abs(pct) < 0.05 ? 'flat' : pct > 0 ? 'up' : 'down';
  const pctText = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.abs(pct));
  return { dir, text: `${{ up: '▲', down: '▼', flat: '=' }[dir]} ${pctText} %` };
}

// Las cifras que lleva cada canal; sin datos, la cinta queda solo con frases
function liveItems(channel, pulse, t, lang) {
  const locale = LOCALES[lang] ?? 'es-CO';
  const cop = (v, d = 0) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP', maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
  const day = (iso) => (iso ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)) : null);

  if (channel === 'market') {
    const { fnc, ny, trm } = pulse?.market ?? {};
    const items = [];
    if (fnc) items.push({ k: t('pulse.fnc'), unit: t('pulse.fncUnit'), v: cop(fnc.value), note: fnc.date && t('pulse.asOf').replace('{d}', day(fnc.date)) });
    if (ny) items.push({ k: t('pulse.ny'), v: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(ny.value), unit: t('pulse.nyUnit'), d: delta(ny.value, ny.prev, locale) });
    if (trm) items.push({ k: t('pulse.trm'), v: cop(trm.value, 2), d: delta(trm.value, trm.prev, locale) });
    if (items.length) items.push({ src: t('pulse.sources') });
    return items;
  }

  if (channel === 'city') {
    const b = pulse?.bogota;
    if (!b) return [];
    const items = [{ k: t('pulse.now'), v: `${b.tempC} °C`, unit: t(`pulse.wx.${weatherKind(b.code)}`) }];
    if (Number.isFinite(b.min) && Number.isFinite(b.max)) items.push({ k: t('pulse.today'), v: `${b.min}° – ${b.max}°` });
    if (Number.isFinite(b.rainProb)) items.push({ k: t('pulse.rain'), v: `${b.rainProb} %` });
    items.push({ tip: t(`pulse.${weatherTip(b)}`) });
    return items;
  }

  return [];
}

// La última cifra no lleva "·": las frases de la cinta traen el suyo
function LiveItem({ item, last }) {
  const end = last ? ' is-last' : '';
  if (item.src) return <span className={`mq-src${end}`}>{item.src}</span>;
  if (item.tip) return <span className={`mq-live mc${end}`}>{item.tip}</span>;
  return (
    <span className={`mq-live${end}`}>
      <span className="mq-k">{item.k}</span>
      <b>{item.v}</b>
      {item.unit && <small>{item.unit}</small>}
      {item.d && <i className={`mq-d is-${item.d.dir}`}>{item.d.text}</i>}
      {item.note && <small>{item.note}</small>}
    </span>
  );
}

// channel: "market" (precio del café y dólar) · "city" (clima de Bogotá) ·
// sin canal, solo las frases editables.
export default function Marquee({ channel }) {
  const { t, lang } = useLanguage();
  const fallbackItems = t('marquee');
  const [items, setItems] = useState(fallbackItems);
  const [pulse, setPulse] = useState(null);

  const load = useCallback(() => {
    let active = true;
    fetchAppConfig(`marquee_${lang}`, null).then((value) => {
      if (!active) return;
      const parsed = value ? value.split('|').map((s) => s.trim()).filter(Boolean) : [];
      setItems(parsed.length ? parsed : t('marquee'));
    });
    return () => { active = false; };
  }, [lang, t]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    if (!channel) return undefined;
    let active = true;
    fetchPulse().then((p) => { if (active) setPulse(p); });
    return () => { active = false; };
  }, [channel]);

  const live = liveItems(channel, pulse, t, lang);
  const hasTag = live.length > 0;

  // La cinta arranca justo después de la etiqueta (su ancho cambia con el idioma)
  const wrapRef = useRef(null);
  const tagRef = useRef(null);
  useLayoutEffect(() => {
    const tag = tagRef.current;
    if (!tag) return undefined;
    const fit = () => wrapRef.current?.style.setProperty('--mq-tag-w', `${tag.offsetWidth}px`);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(tag);
    return () => ro.disconnect();
  }, [hasTag]);

  const row = [
    ...live.map((item, i) => <LiveItem key={`l${i}`} item={item} last={i === live.length - 1} />),
    ...items.map((text, i) => <span key={`p${i}`} className={classes[i % classes.length]}>{text}</span>),
  ];
  // Las cifras alargan la cinta: el recorrido dura más para que no corra más rápido
  const chars = (list) => list.join('').length;
  const phraseChars = Math.max(chars(items), 1);
  const liveChars = chars(live.map((i) => [i.k, i.v, i.unit, i.d?.text, i.note, i.src, i.tip].filter(Boolean).join('  ')));
  const duration = `${Math.round((40 * (phraseChars + liveChars)) / phraseChars)}s`;

  return (
    <div ref={wrapRef} className={`mq-wrap ${hasTag ? 'has-tag' : ''}`}>
      {hasTag && (
        <span ref={tagRef} className="mq-tag">
          <i className="mq-dot" aria-hidden="true" />
          {t(`pulse.${channel}`)}
        </span>
      )}
      <SectionEditButton section="Cinta" fig="FIG. — CINTA" placement="inline" onSaved={load} fields={MARQUEE_FIELDS} />
      <div className="mq-track" style={{ animationDuration: duration }}>
        {row}
        <span className="mq-copy" aria-hidden="true">{row}</span>
      </div>
    </div>
  );
}

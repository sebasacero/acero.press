import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Navbar from '../../../shared/layout/Navbar.jsx';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../../shared/layout/WhatsAppButton.jsx';
import { MOMENTS, bogotaHour, momentAt, clockOf, paletteAt, orbsAt, hourLerp, layoutOf, rng } from '../lib/dayBanner.js';
import { buildCity } from './dayCity.js';
import './day-banner.css';

// El banner principal: 24 horas con un barista de calle. El horizonte curvo no
// se mueve y el mundo cambia encima: la ciudad gira bajo los pies del barista,
// el cielo es el de la hora de Bogotá en que se abre la página y el celular
// muestra lo que él hace en Micra a esa hora. Sin la línea de horas de abajo
// (pedido del usuario, 10 nov 2026): el día sigue en el resto de la página.
// Lleva el menú y el único h1 de la portada.

const STEP_S = 0.75;      // segundos por paso: la tierra avanza una zancada por paso
const CLOUD = 'M10 44 c-14 0 -14 -20 2 -20 c2 -16 26 -18 32 -4 c8 -10 28 -4 26 10 c14 0 14 16 0 16 Z';

export default function DayBanner({ navOpen, onOpenNavDrawer }) {
  const { t } = useLanguage();
  const root = useRef(null), city = useRef(null), far = useRef(null), near = useRef(null), earth = useRef(null);
  const walker = useRef(null), shade = useRef(null), sun = useRef(null), flare = useRef(null), moon = useRef(null);
  const [now, setNow] = useState(() => bogotaHour());
  const [day, setDay] = useState(() => paletteAt(bogotaHour()).day);
  const [shown, setShown] = useState(() => bogotaHour());   // la hora que marca el reloj (va hacia la meta)
  const target = now;
  const live = useRef({ hour: bogotaHour(), target: bogotaHour(), painted: -1, g: null });
  live.current.target = target;

  // El minuto que corre
  useEffect(() => {
    const id = setInterval(() => setNow(bogotaHour()), 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const el = root.current, S = live.current;
    if (!el) return undefined;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, last = 0, walk = 0, seen = true;

    const ground = (x, r = S.g.R) => { const dx = Math.min(r - 1, Math.abs(x - S.g.cx)); return S.g.cy - Math.sqrt(r * r - dx * dx); };
    const measure = () => {
      const g = layoutOf(el.clientWidth, el.clientHeight);
      S.g = g; S.painted = -1;
      earth.current.style.cssText = `width:${2 * g.R}px;height:${2 * g.R}px;left:${g.cx - g.R}px;top:${g.hy}px`;
      city.current.setAttribute('viewBox', `${-g.R} ${-g.R} ${2 * g.R} ${2 * g.R}`);
      el.style.setProperty('--db-wh', `${g.wh}px`);
      buildCity(far.current, near.current, g);
    };
    // Lo que depende de la hora: colores, sol, luna y la cabeza de la línea del día
    const paintHour = (h) => {
      const g = S.g, p = paletteAt(h);
      for (const k in p.vars) el.style.setProperty(k, p.vars[k]);
      setDay(p.day); setShown(h);
      const o = orbsAt(h);
      const orbit = (u) => { const x = g.small ? g.W * (0.07 + 0.86 * u) : g.W * (0.36 + 0.38 * u); return [x, ground(x) + 70 * g.z - Math.sin(u * Math.PI) * g.H * (g.small ? 0.2 : 0.52)]; };
      const put = (node, u, extra = '') => { if (u == null) { node.style.opacity = 0; return; } const [x, y] = orbit(u); node.style.transform = `translate(${x}px,${y}px)${extra}`; node.style.opacity = 1; };
      put(sun.current, o.sun); put(moon.current, o.moon, ' rotate(-18deg)'); put(flare.current, o.sun); flare.current.style.opacity = o.low;
      S.painted = h;
    };
    // Lo que se mueve: la cuadra gira módulo un sector y el barista sube y baja con el paso
    const paintWalk = () => {
      const g = S.g, deg = ((walk * g.stride) / g.R) * (180 / Math.PI);
      near.current.setAttribute('transform', `rotate(${-(deg % g.th)})`);
      far.current.setAttribute('transform', `rotate(${-((deg / 3) % g.th)})`);
      const gy = ground(g.wx, g.R - g.lane), lean = (Math.asin((g.wx - g.cx) / g.R) * 180) / Math.PI;
      const step = walk * Math.PI, bob = Math.abs(Math.sin(step)) * g.wh * 0.017, sway = Math.sin(step) * 0.7;
      const w = walker.current;
      w.style.transform = `translate(${g.wx - w.offsetWidth / 2}px,${gy - g.wh * 0.952 - bob}px) rotate(${lean + sway}deg)`;
      shade.current.style.transform = `translate(${g.wx}px,${gy}px) rotate(${lean}deg) scaleX(${1 - bob / 30})`;
    };
    const frame = (ts) => {
      raf = requestAnimationFrame(frame);
      if (ts - last < 30) return;                     // unos 30 cuadros por segundo: alcanza y cuida el celular
      const dt = Math.min(0.1, last ? (ts - last) / 1000 : 0); last = ts;
      // la hora va hacia su meta por el camino corto
      const d = Math.abs((((S.target - S.hour) % 24) + 36) % 24 - 12);
      if (d > 0.002) S.hour = hourLerp(S.hour, S.target, Math.min(1, dt * 3.2 + 0.004 / d));
      else S.hour = S.target;
      // al llegar se pinta la hora exacta: si no, el reloj se queda un minuto antes
      if (Math.abs(S.hour - S.painted) > 0.004 || (S.hour === S.target && S.painted !== S.target)) paintHour(S.hour);
      walk += dt / STEP_S; paintWalk();
    };
    const start = () => { if (!raf && seen && !document.hidden && !still) { last = 0; raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    measure(); paintHour(S.hour); paintWalk();
    const ro = new ResizeObserver(() => { measure(); paintHour(S.hour); paintWalk(); });
    ro.observe(el);
    // Fuera de pantalla o con la pestaña escondida no se mueve
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen) start(); else stop(); }, { threshold: 0.05 }) : null;
    io?.observe(el);
    const onVis = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener('visibilitychange', onVis);
    // Con «menos movimiento» no camina: se pinta la hora cuando cambia
    S.repaint = still ? () => { S.hour = S.target; paintHour(S.hour); } : null;
    start();
    return () => { stop(); ro.disconnect(); io?.disconnect(); document.removeEventListener('visibilitychange', onVis); S.repaint = null; };
  }, []);
  useEffect(() => { live.current.repaint?.(); }, [target]);

  const [number, setNumber] = useState(FALLBACK_WHATSAPP_NUMBER);
  useEffect(() => { fetchAppConfig('whatsapp_number', FALLBACK_WHATSAPP_NUMBER).then((n) => setNumber(n || FALLBACK_WHATSAPP_NUMBER)); }, []);

  const idx = momentAt(now);
  const m = MOMENTS[idx], clock = clockOf(shown);
  const stars = useMemo(() => { const r = rng(5); return Array.from({ length: 70 }, () => ({ x: (r() * 100).toFixed(2), y: (r() * 62).toFixed(2), r: (0.6 + r() * 1.1).toFixed(2), tw: r() < 0.3, d: (r() * 3).toFixed(2) })); }, []);
  const title = t('day.title');

  return (
    <header ref={root} className={`db${day ? ' is-day' : ''}`} id="dia" aria-label={t('day.label')}>
      <Navbar variant="sheet" tone="photo" navOpen={navOpen} onOpenNavDrawer={onOpenNavDrawer} />

      <svg className="db-stars" aria-hidden="true">
        {stars.map((s, i) => <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} className={s.tw ? 'is-tw' : undefined} style={s.tw ? { animationDelay: `-${s.d}s` } : undefined} />)}
      </svg>
      <div ref={flare} className="db-orb db-flare" />
      <div ref={sun} className="db-orb db-sun" />
      <div ref={moon} className="db-orb db-moon" />
      <div className="db-clouds" aria-hidden="true">
        {[0, 1, 2].map((i) => <svg key={i} className={`db-cloud db-cloud--${i}`} viewBox="0 0 90 50"><path d={CLOUD} /></svg>)}
      </div>

      <div ref={earth} className="db-earth"><svg ref={city} aria-hidden="true"><g ref={far} /><g ref={near} /></svg></div>
      <div ref={shade} className="db-shade" />
      <div ref={walker} className="db-walker">
        <img src="/image/dia/barista.webp" alt={t('day.alt')} width="618" height="900" />
        <svg className="db-steam" viewBox="0 0 40 60" aria-hidden="true"><path d="M8 56 q4 -5 0 -9 q-4 -4 0 -8" /><path d="M19 56 q4 -5 0 -9 q-4 -4 0 -8" /><path d="M30 56 q4 -5 0 -9 q-4 -4 0 -8" /></svg>
      </div>

      <div className="db-copy">
        <p className="db-eyebrow"><i className="is-live" />{t('day.live')}</p>
        <p className="db-clock" data-testid="day-clock"><span>{clock.text}</span><small>{clock.am ? t('day.am') : t('day.pm')}</small></p>
        <p className="db-now" key={m.key} data-testid="day-caption">{t(`day.caps.${m.key}`)}</p>
        <h1 className="db-title">{title[0]} <em>{title[1]}</em></h1>
        <div className="db-ctas">
          <a className="db-btn" href={`https://wa.me/${number}?text=${encodeURIComponent(t('day.waMsg'))}`} target="_blank" rel="noopener noreferrer">{t('day.cta')}</a>
          <a className="db-link" href="/micra">{t('day.cta2')}</a>
        </div>
      </div>

      <div className="db-phone">
        <div className="db-scr">
          <img key={m.img} src={`/image/dia/app-${m.img}.webp`} alt={t('day.phone')} width="540" height="1108" decoding="async" />
        </div>
        <span className="db-glass" />
        <p className="db-tag" key={m.key}>{t(`day.tags.${m.key}`)[0]}<small>{t(`day.tags.${m.key}`)[1]}</small></p>
      </div>

      <div className="db-scrim" />
    </header>
  );
}

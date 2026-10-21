import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import translations from '../../i18n/translations.js';
import MapCanvas from '../../esspresale/MapCanvas.jsx';
import StoreButtons from '../../esspresale/StoreButtons.jsx';
import { useClock, SheetFrame, Segs, Odometer } from '../../esspresale/parts.jsx';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import {
  DURATION, STEPS, LOGIN_ITEMS, ITEM_COUNT, trackProgress, sceneAt, stepAt, stepStart, progressForItem,
} from './pressStory.js';

// Banner de la app Micra, en la misma hoja de plano que la portada (marco con
// zonas, mapa de papel y panel oscuro): al bajar, el celular inicia sesión con Google
// (como el sitio) y abre la receta guiada, donde la animación del AeroPress
// avanza con el scroll. El clip viene recortado y con el fondo gris llevado a
// blanco: con mix-blend-mode: multiply queda dibujado sobre el papel de la
// receta. Trae un cuadro clave cada 6 para que buscar con el scroll sea fluido.
const SOURCES = [
  { src: '/image/metodo/aeropress-metodo.mp4', type: 'video/mp4; codecs="avc1.640028"' },
  // Para los Chromium sin H.264
  { src: '/image/metodo/aeropress-metodo.webm', type: 'video/webm; codecs="vp9"' },
];
const POSTER = '/image/metodo/poster.webp';
const STILL = (i) => `/image/metodo/paso-${i + 1}.webp`;
const num = (i) => String(i + 1).padStart(2, '0');
// Dentro del celular los textos van en español, como el resto de la app (abre primero en Bogotá)
const APP_STEPS = translations.es.press.steps;
const LOGIN_MAP = { style: 'oscuro', c: 11, k: 81, ax: 0.5, ay: 0.42, s: 7, heat: 0.7, labels: 0.6 };
// Fondo de la hoja: el mismo plano de papel de la portada, más al norte
const SHEET_MAP = (w) => ({ style: 'plano', c: 13, k: 90, ax: w < 820 ? 0.5 : 0.55, ay: 0.5, s: Math.max(8, w / 160), heat: 0.55, labels: 1 });
// Lo que dicen los pasos: 15–18 g de café, 20–30 s de presión, cinco pasos de receta
const SPECS = ['15–18 g', '20–30 s', String(STEPS.length).padStart(2, '0')];

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function GoogleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14.1-5l-6.5-5.5C29.6 35.1 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.5 5.5C41.4 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function Status() {
  const { time } = useClock();
  return <div className="pb-status"><span>{time}</span><span>5G ▮▮▮</span></div>;
}

/** Encabezado de la hoja: cota FIG., título con la frase roja, ubicación y texto. */
function SheetCopy({ t, desc, stores }) {
  const lines = t('press.titleLines');
  return (
    <div className="pb-copy">
      <div className="essp-tag">{t('press.tag')} <span className="essp-new">{t('press.badge')}</span></div>
      <h2 className="essp-title pb-title" id="ps-title">
        {lines[0]}<br />{lines[1]}
        <span className="essp-script">{t('press.script')}</span>
      </h2>
      <div className="essp-loc">{t('press.loc')}</div>
      <p className="essp-lede pb-lede">
        {desc}
        <span className="jp">{t('press.descJp')}</span>
      </p>
      {stores}
    </div>
  );
}

export default function PressStory() {
  const { t } = useLanguage();
  // 'scroll' = el celular sigue al scroll; 'static' = pasos con foto (movimiento reducido o video que no carga)
  const [mode, setMode] = useState(() => (reducedMotion() ? 'static' : 'scroll'));
  const [view, setView] = useState({ scene: 'login', beat: 'screen', item: 0 });
  const [stores, setStores] = useState({ appStoreUrl: null, playStoreUrl: null });
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const clockRef = useRef(null);

  useEffect(() => {
    Promise.all([fetchAppConfig('app_store_url', null), fetchAppConfig('play_store_url', null)])
      .then(([a, p]) => setStores({ appStoreUrl: a || null, playStoreUrl: p || null }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const onChange = () => setMode(mq.matches ? 'static' : 'scroll');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // El video se descarga entero (≈0,9 MB) solo cuando la sección se acerca:
  // en memoria, cada búsqueda es inmediata (también en Safari de iOS)
  useEffect(() => {
    if (mode !== 'scroll') return undefined;
    const track = trackRef.current;
    const video = videoRef.current;
    const src = SOURCES.find((x) => video.canPlayType(x.type))?.src;
    if (!src) { setMode('static'); return undefined; }
    let url = null;
    let cancelled = false;
    let watchdog = 0;
    let gotFrame = false;
    const onError = () => setMode('static');
    const onFrame = () => { gotFrame = true; };
    video.addEventListener('error', onError);
    video.addEventListener('loadeddata', onFrame);
    // Safari de iOS no descarga nada de un video con preload="none" hasta
    // load()/play(), y solo lo deja reproducir sin toque con el atributo muted
    // (React pone la propiedad, no el atributo). Un play()→pause() también hace
    // que pinte los cuadros buscados.
    const start = (from) => {
      if (cancelled) return;
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.preload = 'auto';
      video.src = from;
      video.load();
      video.play()?.then(() => video.pause()).catch(() => {});
      // Si nunca llega un cuadro (p. ej. iOS en modo de bajo consumo bloquea el
      // video), mejor los pasos con foto que una imagen congelada. No se mira
      // readyState: baja un momento en cada búsqueda.
      watchdog = window.setTimeout(() => { if (!gotFrame && video.readyState < 2) setMode('static'); }, 8000);
    };
    const load = () => {
      fetch(src)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((blob) => {
          if (cancelled) return;
          url = URL.createObjectURL(blob);
          start(url);
        })
        .catch(() => start(src));
    };
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: '800px 0px' });
    io.observe(track);
    return () => {
      cancelled = true;
      io.disconnect();
      window.clearTimeout(watchdog);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadeddata', onFrame);
      if (url) URL.revokeObjectURL(url);
    };
  }, [mode]);

  // Scroll → escena del celular y segundo del clip. Corre solo mientras la
  // sección está en pantalla y se detiene cuando el video alcanzó su punto
  useEffect(() => {
    if (mode !== 'scroll') return undefined;
    const track = trackRef.current;
    const stage = stageRef.current;
    const video = videoRef.current;
    let visible = false;
    let raf = 0;
    let cur = 0;
    let shown = '';
    const tick = () => {
      raf = 0;
      const r = track.getBoundingClientRect();
      const scene = sceneAt(trackProgress(r.top, r.height, window.innerHeight));
      const target = scene.time;
      cur += (target - cur) * 0.2;
      if (Math.abs(target - cur) < 0.01) cur = target;
      stage.style.setProperty('--ps-t', (cur / DURATION).toFixed(4));
      if (clockRef.current) clockRef.current.textContent = cur.toFixed(1).padStart(4, '0');
      const item = scene.scene === 'login'
        ? LOGIN_ITEMS.findIndex((it) => it.beats.includes(scene.beat))
        : LOGIN_ITEMS.length + stepAt(cur);
      const key = `${scene.scene}|${scene.beat}|${item}`;
      if (key !== shown) { shown = key; setView({ scene: scene.scene, beat: scene.beat, item }); }
      let pending = cur !== target;
      if (video.readyState >= 1) {
        if (video.seeking) pending = true;
        else if (Math.abs(video.currentTime - cur) > 0.02) { video.currentTime = cur; pending = true; }
      }
      if (pending && visible) raf = requestAnimationFrame(tick);
    };
    const schedule = () => { if (!raf && visible) raf = requestAnimationFrame(tick); };
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      schedule();
    });
    io.observe(track);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // También al cargar y tras la pausa del arranque (el play() pudo moverlo unos cuadros)
    const SYNC = ['loadedmetadata', 'loadeddata', 'seeked', 'pause'];
    SYNC.forEach((ev) => video.addEventListener(ev, schedule));
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      SYNC.forEach((ev) => video.removeEventListener(ev, schedule));
    };
  }, [mode]);

  /** Tocar un ítem de la lista lleva el scroll hasta él. */
  const jump = useCallback((i) => {
    const track = trackRef.current;
    if (!track) return;
    const top = window.scrollY + track.getBoundingClientRect().top;
    window.scrollTo({ top: top + progressForItem(i) * (track.offsetHeight - window.innerHeight), behavior: 'smooth' });
  }, []);

  const items = [
    ...LOGIN_ITEMS.map((it) => ({ key: it.key, title: t(`press.login.${it.key}.title`), desc: t(`press.login.${it.key}.desc`) })),
    ...STEPS.map((s) => ({ key: s.key, title: t(`press.steps.${s.key}.title`), desc: t(`press.steps.${s.key}.desc`) })),
  ];
  const step = Math.max(0, view.item - LOGIN_ITEMS.length);
  const appStep = APP_STEPS[STEPS[step].key];

  const renderItem = (it, i) => (
    <li key={it.key} className={`ps-step${i === view.item ? ' is-on' : ''}${i < view.item ? ' is-done' : ''}`} aria-current={i === view.item ? 'step' : undefined}>
      <button type="button" onClick={() => jump(i)}>
        <span className="ps-num">{num(i)}</span>
        <span className="ps-body">
          <b>{it.title}</b>
          <span>{it.desc}</span>
        </span>
      </button>
    </li>
  );

  return (
    <section className="press-story" id="prensado" aria-labelledby="ps-title">
      {mode === 'scroll' ? (
        <div className="ps-track pb-track" ref={trackRef} style={{ '--ps-steps': ITEM_COUNT }}>
          <div className="ps-stage pb-stage" ref={stageRef}>
            <div className="pb-bg" aria-hidden="true">
              <MapCanvas view={SHEET_MAP} />
              <div className="pb-fade" />
            </div>
            <SheetFrame />
            <div className="pb-in">
            <hr className="essp-dash" />
            <div className="pb-main">
            <SheetCopy t={t} desc={t('press.desc')} stores={<StoreButtons {...stores} />} />

            <figure className="pb-figure">
              <div className="pb-phone" data-scene={view.scene} data-beat={view.beat} aria-hidden="true">
                {/* Entrada: Micra → Google → cuenta → bienvenida */}
                <div className="pb-screen pb-login">
                  <MapCanvas view={LOGIN_MAP} />
                  <div className="pb-login-shade" />
                  <Status />
                  <div className="pb-login-hero">
                    <b className="pb-logo">micra<i>.</i></b>
                    <p>Café de especialidad en Bogotá. Pídelo o prepáralo tú, paso a paso.</p>
                  </div>
                  <div className="pb-login-actions">
                    <span className="pb-google"><GoogleIcon /> Continuar con Google</span>
                    <small>Al continuar aceptas los términos de Micra.</small>
                  </div>
                  <div className="pb-chooser">
                    <span className="pb-handle" />
                    <div className="pb-chooser-head">
                      <GoogleIcon size={20} />
                      <b>Elige una cuenta</b>
                      <small>para continuar en <em>micra</em></small>
                    </div>
                    <div className="pb-account is-pick">
                      <span className="pb-av">L</span>
                      <span><b>Laura Méndez</b><small>laura@ejemplo.com</small></span>
                    </div>
                    <div className="pb-account">
                      <span className="pb-av is-plus">+</span>
                      <span><b>Usar otra cuenta</b></span>
                    </div>
                  </div>
                  <div className="pb-welcome">
                    <span className="pb-check">✓</span>
                    <b>Hola, Laura</b>
                    <small>Abriendo tu receta…</small>
                    <span className="pb-load" />
                  </div>
                </div>

                {/* Receta guiada: el AeroPress sigue al scroll */}
                <div className="pb-screen pb-recipe">
                  <Status />
                  <div className="pb-appbar"><b className="pb-logo is-ink">micra<i>.</i></b><span>RECETA</span></div>
                  <div className="pb-recipe-head">
                    <small>FIG. 02.1 — AEROPRESS</small>
                    <b>Paso a paso</b>
                  </div>
                  <div className="pb-video-wrap">
                    <video ref={videoRef} className="ps-video" muted playsInline preload="none" poster={POSTER} disablePictureInPicture tabIndex={-1} />
                    <span className="ps-clock annot">t = <b ref={clockRef}>00.0</b> s</span>
                  </div>
                  <div className="ps-ruler pb-ruler">
                    <span className="ps-ruler-fill" />
                    {STEPS.slice(1).map((s, i) => <i key={s.key} style={{ left: `${(stepStart(i + 1) / DURATION) * 100}%` }} />)}
                  </div>
                  <div className="pb-card">
                    <span className="pb-cota">PASO {num(step)} / {num(STEPS.length - 1)}</span>
                    <b>{appStep.title}</b>
                    <p>{appStep.desc}</p>
                  </div>
                </div>
              </div>
              <figcaption className="ps-sr">{t('press.phoneLabel')}</figcaption>
            </figure>

            {/* Panel oscuro, como el del odómetro de la portada: el paso de ahora y la lista */}
            <aside className="essp-panel pb-panel pb-side" aria-label={t('press.panelFig')}>
              <div className="essp-panel-cota"><span>{t('press.panelFig')}</span><span className="essp-badge">{num(view.item)} / {num(ITEM_COUNT - 1)}</span></div>
              <div className="essp-panel-label">{t('press.panelLabel')}</div>
              <div className="essp-odo-row">
                <Odometer digits={num(view.item).split('')} />
                <span className="essp-odo-sep">/</span>
                <span className="essp-odo-target">{num(ITEM_COUNT - 1)} {t('press.total')}</span>
              </div>
              <Segs filled={Math.round(((view.item + 1) / ITEM_COUNT) * 20)} className="essp-bar" />
              <p className="pb-group">{t('press.groupApp')}</p>
              <ol className="ps-steps">{items.slice(0, LOGIN_ITEMS.length).map((it, i) => renderItem(it, i))}</ol>
              <p className="pb-group">{t('press.groupBrew')}</p>
              <ol className="ps-steps">{items.slice(LOGIN_ITEMS.length).map((it, i) => renderItem(it, i + LOGIN_ITEMS.length))}</ol>
              <div className="essp-specs">
                {SPECS.map((v, i) => <div key={i}><b>{v}</b><span>{t('press.specs')[i]}</span></div>)}
              </div>
            </aside>
            </div>

            </div>
          </div>
        </div>
      ) : (
        <>
        <div className="pb-stage is-static">
          <div className="pb-bg" aria-hidden="true"><div className="pb-fade" /></div>
          <SheetFrame />
          <div className="pb-in">
            <hr className="essp-dash" />
            <SheetCopy t={t} desc={t('press.descStatic')} stores={<StoreButtons {...stores} />} />
          </div>
        </div>
        <ol className="ps-static">
          {LOGIN_ITEMS.map((it, i) => (
            <li key={it.key} className="ps-card is-login">
              <span className="pb-static-icon">{i === 0 ? <GoogleIcon size={28} /> : i === 1 ? <span className="pb-av">L</span> : <span className="pb-check">✓</span>}</span>
              <span className="ps-num">{num(i)}</span>
              <b>{items[i].title}</b>
              <p>{items[i].desc}</p>
            </li>
          ))}
          {STEPS.map((s, i) => (
            <li key={s.key} className="ps-card">
              <img src={STILL(i)} alt="" loading="lazy" width="868" height="656" />
              <span className="ps-num">{num(i + LOGIN_ITEMS.length)}</span>
              <b>{items[i + LOGIN_ITEMS.length].title}</b>
              <p>{items[i + LOGIN_ITEMS.length].desc}</p>
            </li>
          ))}
        </ol>
        </>
      )}

      <div className="sp ps-after">
        <div className="essp-ctas ps-cta">
          <a className="essp-btn" href="#metodo">{t('press.ctaRecipes')}</a>
          <a className="essp-btn is-ghost" href="#beans">{t('press.ctaShop')}</a>
        </div>
        <p className="annot ps-legal">{t('press.legal')}</p>
      </div>
    </section>
  );
}

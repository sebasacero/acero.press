import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { DURATION, STEPS, trackProgress, timeAt, stepAt, stepStart, progressForStep } from './pressStory.js';

// «Así funciona»: la animación del AeroPress avanza con el scroll.
// El clip viene recortado y con el fondo gris llevado a blanco: con
// mix-blend-mode: multiply queda dibujado sobre el papel cuadriculado. Trae un
// cuadro clave cada 6 para que buscar con el scroll sea fluido.
const SOURCES = [
  { src: '/image/metodo/aeropress-metodo.mp4', type: 'video/mp4; codecs="avc1.640028"' },
  // Para los Chromium sin H.264
  { src: '/image/metodo/aeropress-metodo.webm', type: 'video/webm; codecs="vp9"' },
];
const POSTER = '/image/metodo/poster.webp';
const STILL = (i) => `/image/metodo/paso-${i + 1}.webp`;
const num = (i) => String(i + 1).padStart(2, '0');

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function PressStory() {
  const { t } = useLanguage();
  // 'scroll' = el video sigue al scroll; 'static' = pasos con foto (movimiento reducido o video que no carga)
  const [mode, setMode] = useState(() => (reducedMotion() ? 'static' : 'scroll'));
  const [step, setStep] = useState(0);
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const clockRef = useRef(null);

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

  // Scroll → segundo del clip. Corre solo mientras la sección está en pantalla
  // y se detiene cuando el video alcanzó su punto
  useEffect(() => {
    if (mode !== 'scroll') return undefined;
    const track = trackRef.current;
    const stage = stageRef.current;
    const video = videoRef.current;
    let visible = false;
    let raf = 0;
    let cur = 0;
    let shown = -1;
    const tick = () => {
      raf = 0;
      const r = track.getBoundingClientRect();
      const target = timeAt(trackProgress(r.top, r.height, window.innerHeight));
      cur += (target - cur) * 0.2;
      if (Math.abs(target - cur) < 0.01) cur = target;
      stage.style.setProperty('--ps-t', (cur / DURATION).toFixed(4));
      if (clockRef.current) clockRef.current.textContent = cur.toFixed(1).padStart(4, '0');
      const s = stepAt(cur);
      if (s !== shown) { shown = s; setStep(s); }
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

  /** Tocar un paso lleva el scroll hasta él. */
  const jump = useCallback((i) => {
    const track = trackRef.current;
    if (!track) return;
    const top = window.scrollY + track.getBoundingClientRect().top;
    window.scrollTo({ top: top + progressForStep(i) * (track.offsetHeight - window.innerHeight), behavior: 'smooth' });
  }, []);

  const title = (key) => t(`press.steps.${key}.title`);
  const desc = (key) => t(`press.steps.${key}.desc`);

  return (
    <section className="press-story" id="prensado" aria-labelledby="ps-title">
      <div className="section-label">
        <span className="num">{t('press.num')}</span>
        <span className="rule"></span>
        <span className="sub">{t('press.sub')}</span>
      </div>
      <div className="sp">
        <h2 className="sec-h2" id="ps-title">{t('press.title')}</h2>
        <p className="sec-desc">
          {t(mode === 'scroll' ? 'press.desc' : 'press.descStatic')}
          <span className="jp" style={{ display: 'block', marginTop: '.4rem' }}>{t('press.descJp')}</span>
        </p>
      </div>

      {mode === 'scroll' ? (
        <div className="ps-track" ref={trackRef} style={{ '--ps-steps': STEPS.length }}>
          <div className="ps-stage" ref={stageRef}>
            <figure className="ps-figure">
              <div className="ps-frame">
                <video ref={videoRef} className="ps-video" muted playsInline preload="none" poster={POSTER} disablePictureInPicture aria-hidden="true" tabIndex={-1} />
                <span className="ps-fig annot" aria-hidden="true">{t('press.fig')} · {num(step)} {title(STEPS[step].key)}</span>
                <span className="ps-clock annot" aria-hidden="true">t = <b ref={clockRef}>00.0</b> s</span>
              </div>
              <div className="ps-ruler" aria-hidden="true">
                <span className="ps-ruler-fill" />
                {STEPS.slice(1).map((s, i) => <i key={s.key} style={{ left: `${(stepStart(i + 1) / DURATION) * 100}%` }} />)}
              </div>
              <figcaption className="ps-sr">{t('press.videoLabel')}</figcaption>
            </figure>
            <ol className="ps-steps">
              {STEPS.map((s, i) => (
                <li key={s.key} className={`ps-step${i === step ? ' is-on' : ''}${i < step ? ' is-done' : ''}`} aria-current={i === step ? 'step' : undefined}>
                  <button type="button" onClick={() => jump(i)}>
                    <span className="ps-num">{num(i)}</span>
                    <span className="ps-body">
                      <b>{title(s.key)}</b>
                      <span>{desc(s.key)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <ol className="ps-static">
          {STEPS.map((s, i) => (
            <li key={s.key} className="ps-card">
              <img src={STILL(i)} alt="" loading="lazy" width="868" height="656" />
              <span className="ps-num">{num(i)}</span>
              <b>{title(s.key)}</b>
              <p>{desc(s.key)}</p>
            </li>
          ))}
        </ol>
      )}

      <div className="sp ps-after">
        <div className="ps-cta">
          <a className="btn" href="#metodo">{t('press.ctaRecipes')}</a>
          <a className="btn" href="#beans">{t('press.ctaShop')}</a>
        </div>
        <p className="annot ps-legal">{t('press.legal')}</p>
      </div>
    </section>
  );
}

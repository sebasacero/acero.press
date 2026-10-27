import { useEffect, useRef, useState } from 'react';
import { SheetFrame } from '../esspresale/parts.jsx';
import { DURATION, passProgress, timeAt, clipStepAt } from './videoScroll.js';

// Banner del video de la Escuela, en la hoja de plano: el clip de la AeroPress (el mismo que
// tenía el celular de Micra en la portada) dentro de un celular, avanzando con el scroll
// mientras el banner cruza la pantalla. Sin fijar nada: el banner mide lo que mide.
// El video se descarga (≈0,9 MB) solo cuando el banner se acerca. Con «menos movimiento» o si
// el video no carga, queda la foto del primer cuadro y la lista de pasos.
const SOURCES = [
  { src: '/image/metodo/aeropress-metodo.mp4', type: 'video/mp4; codecs="avc1.640028"' },
  { src: '/image/metodo/aeropress-metodo.webm', type: 'video/webm; codecs="vp9"' }, // Chromium sin H.264
];
const POSTER = '/image/metodo/poster.webp';
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function SchoolVideo({ t, ctas }) {
  const v = t('school.video');
  const ref = useRef(null);
  const videoRef = useRef(null);
  const stageRef = useRef(null); // el avance se mide con el celular: en el celular el banner es más alto que la pantalla
  const [still] = useState(reducedMotion);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState(0);
  const moving = !still && !failed;

  // Cargar el video cuando el banner se acerca
  useEffect(() => {
    if (!moving) return undefined;
    const el = ref.current;
    const video = videoRef.current;
    if (!el || !video) return undefined;
    const load = () => {
      if (video.src) return;
      const src = SOURCES.find((x) => video.canPlayType(x.type))?.src;
      if (!src) { setFailed(true); return; }
      video.muted = true;
      video.preload = 'auto';
      video.src = src;
      video.load();
      // Safari de iOS no pinta un cuadro buscado hasta que el video arrancó una vez
      video.play()?.then(() => video.pause()).catch(() => {});
    };
    if (!('IntersectionObserver' in window)) { load(); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { load(); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [moving]);

  // Scroll → segundo del clip (suavizado), solo con el banner en pantalla
  useEffect(() => {
    if (!moving) return undefined;
    const el = stageRef.current;
    const video = videoRef.current;
    let visible = false;
    let raf = 0;
    let cur = 0;
    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const target = timeAt(passProgress(r.top, r.height, window.innerHeight));
      cur += (target - cur) * 0.25;
      if (Math.abs(target - cur) < 0.01) cur = target;
      setStep(clipStepAt(cur));
      let pending = cur !== target;
      if (video.readyState >= 1) {
        if (video.seeking) pending = true;
        else if (Math.abs(video.currentTime - cur) > 0.02) { video.currentTime = Math.min(cur, DURATION - 0.05); pending = true; }
      }
      if (pending && visible) raf = requestAnimationFrame(tick);
    };
    const schedule = () => { if (!raf && visible) raf = requestAnimationFrame(tick); };
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); })
      : null;
    if (io) io.observe(el); else visible = true;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const SYNC = ['loadedmetadata', 'loadeddata', 'seeked', 'pause'];
    SYNC.forEach((ev) => video.addEventListener(ev, schedule));
    schedule();
    return () => {
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      SYNC.forEach((ev) => video.removeEventListener(ev, schedule));
    };
  }, [moving]);

  const now = v.steps[step];
  return (
    <section ref={ref} className="school-sheet sv" id="video" aria-labelledby="sv-title">
      <SheetFrame />
      <div className="school-in sv-in">
        <div className="sv-copy">
          <div className="essp-tag">{v.tag} {moving && <span className="essp-new">{v.badge}</span>}</div>
          <h2 className="essp-title sv-title" id="sv-title">
            {v.title[0]}{' '}<br />{v.title[1]}
            <span className="essp-script">{v.script}</span>
          </h2>
          <p className="essp-lede sv-lede">{v.lede}</p>
          <ol className="sv-steps">
            {v.steps.map((s, i) => (
              <li key={s.title} className={moving && i === step ? 'is-on' : moving && i < step ? 'is-done' : undefined} aria-current={moving && i === step ? 'step' : undefined}>
                <span className="sv-n">{String(i + 1).padStart(2, '0')}</span>
                <span><b>{s.title}</b><small>{s.desc}</small></span>
              </li>
            ))}
          </ol>
          {ctas && <div className="essp-ctas">{ctas}</div>}
        </div>

        <div className="sv-stage" ref={stageRef}>
          <div className="essp-phone sv-phone" role="img" aria-label={v.phoneLabel}>
            <div className="essp-phone-screen sv-screen">
              <div className="essp-phone-status" aria-hidden="true"><span>9:41</span><span>5G ▮▮▮</span></div>
              <div className="essp-phone-pill" aria-hidden="true">
                <div><span>{v.screenSub}</span>{v.screen}</div>
                <span className="essp-phone-chip is-red">{step + 1}/{v.steps.length}</span>
              </div>
              <div className="sv-media">
                {moving ? (
                  <video
                    ref={videoRef}
                    className="sv-video"
                    muted
                    playsInline
                    preload="none"
                    poster={POSTER}
                    aria-hidden="true"
                    tabIndex={-1}
                    onError={() => setFailed(true)}
                  />
                ) : (
                  <img className="sv-video" src={POSTER} alt="" decoding="async" />
                )}
              </div>
              <div className="essp-phone-sheet" aria-hidden="true">
                <div className="essp-phone-handle" />
                <div className="essp-phone-card">
                  <div className="essp-phone-cota"><span>{v.stepLabel} {String(step + 1).padStart(2, '0')}</span><span className="essp-phone-badge">AEROPRESS</span></div>
                  <b>{now.title}</b>
                  <small>{now.desc}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

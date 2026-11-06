import { useEffect, useMemo, useRef, useState } from 'react';
import { videoScenes, totalMs, sceneAt, startOf } from './lessonVideo.js';
import './lesson-video.css';

// El video de una lección, armado con sus pasos (lessonVideo.js): dibujos a trazo que se dibujan
// solos, el texto grande y la barra de historias arriba. Toque a la derecha: siguiente; a la
// izquierda: anterior; en el centro: pausa. Con «menos movimiento» no corre solo.

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', pathLength: 1 };

/** Los dibujos de las escuelas y de los pasos (40 × 40), en el estilo de los íconos de Aprende. */
export function SchoolIcon({ id, className = '' }) {
  const paths = DRAW[id] ?? DRAW.cafe;
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {paths.map((d, i) => (d.startsWith('c:') ? <circle key={i} {...P} cx={d.split(':')[1]} cy={d.split(':')[2]} r={d.split(':')[3]} style={{ '--i': i }} /> : <path key={i} {...P} d={d} style={{ '--i': i }} />))}
    </svg>
  );
}

const DRAW = {
  aeropress: ['M12 13h16v20a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z', 'M10 33h20', 'M14 13V7h12v6', 'M18 7V4h4v3', 'M15 19h10M15 24h10'],
  termo: ['M13 9h14v22a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4z', 'M15 5h10v4H15z', 'M13 16h14', 'M27 19h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3'],
  v60: ['M8 9h24l-8 13h-8z', 'M16 22h8', 'M14 26h12v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z', 'M32 12c3 0 3 5 0 6'],
  espresso: ['M7 5h26v10H7z', 'M9 15v20M31 15v20', 'M15 15v3h10v-3M20 18v3', 'M15 27h10v3a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z'],
  agua: ['M6 18h16v10a5 5 0 0 1-5 5h-6a5 5 0 0 1-5-5z', 'M22 21l8-8h4', 'M10 18c0-4 2-6 4-6s4 2 4 6', 'M33 18v3M33 25v3M30 30v3'],
  tiempo: ['c:20:22:13', 'M20 22v-7', 'M20 22l5 4', 'M16 5h8M20 5v4', 'M31 10l2-2'],
  balanza: ['M6 26h28v6H6z', 'M10 26v-3h20v3', 'M14 23c0-5 2-9 6-9s6 4 6 9', 'M18 29h4'],
  limpiar: ['M20 6c5 7 8 11 8 15a8 8 0 0 1-16 0c0-4 3-8 8-15z', 'M16 22a4 4 0 0 0 4 4', 'M30 8l3-3M32 13h4'],
  molino: ['M12 6h16l-2 8H14z', 'M14 14h12v14H14z', 'M12 28h16v6H12z', 'M26 20h6M32 17v6', 'c:20:21:3'],
  presion: ['M20 4v12', 'M15 11l5 5 5-5', 'M12 18h16v14a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z', 'M12 23h16'],
  taza: ['M8 18h20v8a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z', 'M28 21h3a3 3 0 0 1 0 6h-3', 'M14 13c0-3 2-3 2-6M20 13c0-3 2-3 2-6'],
  leche: ['M13 10h14l-1 4v16a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V14z', 'M13 10l-3-4h10', 'M14 20c3 2 9 2 12 0'],
  cafe: ['M14 8c-6 3-8 12-4 20 3 5 9 6 12 2', 'M14 8c6-2 13 4 13 13 0 6-3 9-5 9', 'M16 9c-1 6 4 10 3 20'],
  idea: ['M14 22a8 8 0 1 1 12 0c-2 2-2 4-2 6h-8c0-2 0-4-2-6z', 'M16 32h8M17 35h6', 'M20 2v3M6 14h3M31 14h3M9 5l2 2M31 5l-2 2'],
};

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function LessonVideo({ lesson, school = 'aeropress', label = 'Video de la lección' }) {
  const scenes = useMemo(() => videoScenes(lesson, school), [lesson, school]);
  const total = totalMs(scenes);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const raf = useRef(0);
  const box = useRef(null);
  useEffect(() => {
    if (!playing) return undefined;
    let last = performance.now();
    const tick = (now) => {
      setT((x) => {
        const next = x + (now - last);
        if (next >= total) { setPlaying(false); return total; }
        return next;
      });
      last = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, total]);
  // Si sale de la pantalla, se pausa (no gasta batería ni distrae)
  useEffect(() => {
    if (!box.current || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) setPlaying(false); }, { threshold: 0.2 });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);
  if (!scenes.length) return null;
  const { i, p, done } = sceneAt(scenes, t);
  const s = scenes[i];
  const play = () => { setStarted(true); if (done || t >= total) setT(0); setPlaying(!reduced()); };
  const go = (k) => { setStarted(true); setT(startOf(scenes, Math.max(0, Math.min(scenes.length - 1, k)))); };
  return (
    <figure className={`lv ${started ? 'is-started' : ''} is-${s.kind}`} ref={box} aria-label={label} data-testid="lesson-video">
      <ol className="lv-bars" aria-hidden="true">
        {scenes.map((x, k) => <li key={k}><i style={{ transform: `scaleX(${k < i ? 1 : k === i ? p : 0})` }} /></li>)}
      </ol>
      <div className="lv-scene" key={i}>
        <span className="lv-art"><SchoolIcon id={s.icon} className="lv-draw" /></span>
        {s.kind === 'step' && <span className="lv-n">{s.numbered ? `Paso ${s.n} de ${s.total}` : `${s.n} / ${s.total}`}</span>}
        {s.kind === 'tip' && <span className="lv-n">Truco</span>}
        <p className="lv-text">{s.text}</p>
        {s.kind === 'title' && s.sub && <p className="lv-sub">{s.sub}</p>}
      </div>
      <button type="button" className="lv-tap is-prev" onClick={() => go(i - 1)} aria-label="Paso anterior" />
      <button type="button" className="lv-tap is-next" onClick={() => go(i + 1)} aria-label="Paso siguiente" />
      <button type="button" className="lv-play" onClick={playing ? () => setPlaying(false) : play} aria-label={playing ? 'Pausar' : done ? 'Ver otra vez' : 'Reproducir'} data-testid="lesson-video-play">
        {playing ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg> : done && t >= total ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>}
      </button>
      <figcaption className="lv-cap">{Math.ceil(total / 1000)} s · {scenes.length - 1} {scenes.length - 1 === 1 ? 'parte' : 'partes'}</figcaption>
    </figure>
  );
}

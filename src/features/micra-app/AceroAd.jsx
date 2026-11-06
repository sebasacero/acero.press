import { useEffect, useRef, useState } from 'react';
import * as api from './api.js';
import platform from './platform.js';
import { money } from './micraApp.js';
import { houseCans, canText } from './promo.js';

// La publicidad de ACERO.press en el inicio del cliente (6 nov 2026, pedido del usuario): primero
// el video plano de la lata (cans.mp4, mudo, solo con la tarjeta a la vista) y al terminar, el
// carrusel de las latas de las recetas de la casa, que pasan solas cada 3 s (se detienen al
// tocarlas) y se piden por WhatsApp. Con «menos movimiento» o «ahorro de datos» no hay video:
// arranca en las latas y no pasan solas. `onClose` la abre a pantalla completa (desde Mi perfil).

const quiet = () => {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true;
  } catch { return false; }
};
const STEP_MS = 3000;

export default function AceroAd({ onClose }) {
  const [cans, setCans] = useState(() => houseCans(null));
  const [number, setNumber] = useState('573152125327');
  const [stage, setStage] = useState(() => (quiet() ? 'cans' : 'video'));
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(() => quiet());
  const [seen, setSeen] = useState(false);
  const root = useRef(null);
  const video = useRef(null);
  const track = useRef(null);

  useEffect(() => {
    let alive = true;
    api.coldBrewContent().then((c) => alive && setCans(houseCans(c))).catch(() => {});
    api.teamWhatsApp().then((n) => alive && n && setNumber(n)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!onClose) return undefined;
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  // Solo corre con la tarjeta a la vista: el video y el carrusel se detienen fuera de pantalla
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v || stage !== 'video') return;
    if (seen) v.play().catch(() => setStage('cans'));
    else v.pause();
  }, [seen, stage]);

  useEffect(() => {
    if (stage !== 'cans' || held || !seen) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % cans.length), STEP_MS);
    return () => clearInterval(t);
  }, [stage, held, seen, cans.length]);

  // La lata del índice queda centrada en la fila
  useEffect(() => {
    const el = track.current?.children[index];
    if (el && stage === 'cans') track.current.scrollTo({ left: el.offsetLeft - (track.current.clientWidth - el.clientWidth) / 2, behavior: quiet() ? 'auto' : 'smooth' });
  }, [index, stage]);

  const onScroll = () => {
    const t = track.current;
    if (!t) return;
    const mid = t.scrollLeft + t.clientWidth / 2;
    let best = 0;
    [...t.children].forEach((c, i) => { if (Math.abs(c.offsetLeft + c.clientWidth / 2 - mid) < Math.abs(t.children[best].offsetLeft + t.children[best].clientWidth / 2 - mid)) best = i; });
    if (best !== index && held) setIndex(best);
  };

  const replay = () => {
    setStage('video');
    setHeld(false);
    setIndex(0);
    requestAnimationFrame(() => { const v = video.current; if (v) { v.currentTime = 0; v.play().catch(() => setStage('cans')); } });
  };

  const wa = (name) => `https://wa.me/${number}?text=${encodeURIComponent(canText(name))}`;
  const card = (
    <section ref={root} className={`mapp-acero ${onClose ? 'is-full' : ''}`} aria-labelledby="acero-ad-h" data-testid="acero-ad">
      <header className="mapp-acero-head">
        <span className="mapp-acero-logo"><b>ACERO</b><i>.press</i></span>
        <small>Publicidad</small>
      </header>
      <h2 className="mapp-acero-h" id="acero-ad-h">Recetas de la casa <span className="mapp-script">en lata</span></h2>

      {stage === 'video' ? (
        <div className="mapp-acero-video">
          <video
            ref={video}
            src={platform.siteUrl('/image/cans.mp4')}
            muted
            playsInline
            preload="metadata"
            poster={platform.siteUrl('/image/coldbrew/lata-acero.webp')}
            onEnded={() => setStage('cans')}
            aria-label="El plano de la lata de ACERO.press"
            data-testid="acero-video"
          />
          <button type="button" className="mapp-acero-skip" onClick={() => setStage('cans')} data-testid="acero-skip">Ver las latas ›</button>
        </div>
      ) : (
        <div className="mapp-acero-cans">
          <ul
            ref={track}
            className="mapp-acero-track"
            aria-label="Las latas de ACERO.press"
            onPointerDown={() => setHeld(true)}
            onFocus={() => setHeld(true)}
            onScroll={onScroll}
            data-testid="acero-cans"
          >
            {cans.map((c, i) => (
              <li key={c.id} className={`mapp-acero-can is-${c.heat} ${i === index ? 'on' : ''}`} aria-current={i === index ? 'true' : undefined}>
                <img src={platform.siteUrl(`/image/latas/${c.id}.webp`)} alt={`Lata de ${c.name.toLowerCase()} de ACERO.press`} width="360" height="493" loading="lazy" />
                <b>{c.name}</b>
                <span className="mapp-acero-temp">{c.temp}</span>
                <small>{c.note}</small>
                <p className={`mapp-acero-price ${c.price ? '' : 'is-ask'}`}>{c.price ? money(c.price) : 'Pregunta el precio'}</p>
                <a className="mapp-btn is-cta is-small" href={wa(c.name)} target="_blank" rel="noopener noreferrer" data-testid={`acero-buy-${c.id}`}>Pídela</a>
              </li>
            ))}
          </ul>
          <div className="mapp-acero-dots" role="group" aria-label="Elegir lata">
            {cans.map((c, i) => (
              <button key={c.id} type="button" aria-label={c.name} aria-pressed={i === index} onClick={() => { setHeld(true); setIndex(i); }} />
            ))}
          </div>
          {!quiet() && <button type="button" className="mapp-link mapp-acero-replay" onClick={replay}>Ver el video otra vez</button>}
        </div>
      )}
    </section>
  );

  if (!onClose) return card;
  return (
    <div className="mapp-promo" role="dialog" aria-modal="true" aria-label="ACERO.press" data-testid="promo-acero">
      <button type="button" className="mapp-promo-scrim" aria-label="Cerrar el anuncio" tabIndex={-1} onClick={onClose} />
      {card}
      <button type="button" className="mapp-promo-x" aria-label="Cerrar" onClick={onClose} data-testid="promo-close">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

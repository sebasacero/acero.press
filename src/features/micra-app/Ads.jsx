import { useEffect, useRef, useState } from 'react';
import * as api from './api.js';
import { adsFor, seenToday, markSeen } from './ads.js';
import { bogota, initials } from './micraApp.js';

// Los anuncios «Patrocinado» en la app (etapa 1): la publicación en Hoy, la
// burbuja en la fila de historias y la historia a pantalla completa. Cada
// celular cuenta una vista por anuncio al día y cada toque al botón; a la base
// solo llegan cifras (micra_ad_event), nunca quién lo vio.

const store = () => { try { return window.localStorage; } catch { return null; } };

/** Los anuncios al aire para cliente o barista: los del muro y los de historias. */
export function useAds(audience, given = null) {
  const [rows, setRows] = useState(given ?? []);
  useEffect(() => {
    if (given) { setRows(given); return undefined; }
    let alive = true;
    api.adsLive(audience).then((r) => alive && setRows(r ?? [])).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [audience, given]);
  return { rows, feed: adsFor(rows, { placement: 'feed' }), story: adsFor(rows, { placement: 'story' }) };
}

/** Cuenta la vista una vez al día por celular. */
function countView(id) {
  const day = bogota().day;
  if (seenToday(store(), id, day)) return;
  markSeen(store(), id, day);
  api.adEvent(id, 'view').catch(() => {});
}
const countTap = (id) => { api.adEvent(id, 'tap').catch(() => {}); };

/** El círculo del anunciante: su imagen o sus iniciales. */
function AdAvatar({ ad }) {
  return <span className="mapp-post-av is-ad" aria-hidden="true">{initials(ad.advertiser)}</span>;
}

/** La publicación patrocinada en Hoy, a todo el ancho como las demás, con su botón abajo de la imagen. */
export function AdPost({ ad }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // La vista cuenta cuando se ve al menos la mitad (sin IntersectionObserver, al pintarse)
    if (typeof IntersectionObserver === 'undefined') { countView(ad.adId); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { countView(ad.adId); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [ad.adId]);
  return (
    <article ref={ref} className="mapp-post mapp-ig is-patrocinado" aria-label={`Patrocinado: ${ad.advertiser}`} data-testid="feed-ad">
      <header className="mapp-ig-head">
        <AdAvatar ad={ad} />
        <span className="mapp-ig-who"><b>{ad.advertiser}</b><small>Patrocinado</small></span>
      </header>
      <div className="mapp-ig-media">
        {ad.image_url
          ? <div className="mapp-ig-photo"><img src={ad.image_url} alt={ad.title} loading="lazy" /></div>
          : <div className="mapp-ig-tile is-ad"><span className="mapp-ig-headline">{ad.title}</span></div>}
      </div>
      <a className="mapp-ad-cta" href={ad.cta_url} target="_blank" rel="noopener noreferrer sponsored" onClick={() => countTap(ad.adId)} data-testid="ad-cta">
        <span>{ad.cta_label}</span><i aria-hidden="true">›</i>
      </a>
      <div className="mapp-ig-body">
        {ad.image_url && <p className="mapp-post-title">{ad.title}</p>}
        {ad.body && <p className="mapp-post-text">{ad.body}</p>}
      </div>
    </article>
  );
}

/** La burbuja patrocinada en la fila de historias (aro de tinta y «Patrocinado» debajo). */
export function AdStoryBubble({ ad, onOpen }) {
  return (
    <li>
      <button type="button" className="mapp-hist is-ad" onClick={() => onOpen(ad)} aria-label={`Patrocinado: ${ad.advertiser}`} data-testid="story-ad">
        <span className="mapp-hist-ring">
          <span className="mapp-hist-av">{ad.image_url ? <img src={ad.image_url} alt="" /> : <b>{initials(ad.advertiser)}</b>}</span>
        </span>
        <small>{ad.advertiser}</small>
        <em>Patrocinado</em>
      </button>
    </li>
  );
}

/** La historia patrocinada a pantalla completa, como en Instagram. */
export function AdStoryView({ ad, onClose }) {
  useEffect(() => { countView(ad.id); }, [ad.id]);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="mapp-adstory" role="dialog" aria-modal="true" aria-label={`Patrocinado: ${ad.advertiser}`} data-testid="ad-story">
      {ad.image_url ? <img className="mapp-adstory-bg" src={ad.image_url} alt="" /> : <span className="mapp-adstory-bg is-plain" />}
      <header className="mapp-adstory-top">
        <i className="mapp-adstory-bar" aria-hidden="true" />
        <span className="mapp-adstory-who"><span className="mapp-post-av is-ad">{initials(ad.advertiser)}</span><b>{ad.advertiser}</b><small>Patrocinado</small></span>
        <button type="button" className="mapp-adstory-x" onClick={onClose} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        </button>
      </header>
      <div className="mapp-adstory-copy">
        <p className="mapp-adstory-title">{ad.title}</p>
        {ad.body && <p className="mapp-adstory-body">{ad.body}</p>}
        <a className="mapp-adstory-cta" href={ad.cta_url} target="_blank" rel="noopener noreferrer sponsored" onClick={() => countTap(ad.id)} data-testid="ad-story-cta">{ad.cta_label} ›</a>
      </div>
    </div>
  );
}

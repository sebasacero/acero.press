import { useEffect, useRef, useState } from 'react';
import * as api from './api.js';
import platform from './platform.js';
import { money } from './micraApp.js';
import { coldBrewPrice, coldBrewText } from './promo.js';

// El banner de la lata de cold brew de ACERO.press, encima de «Mi perfil»: la
// hoja de plano crema con la lata original (la que fue el icono de la app,
// public/image/coldbrew/lata-acero.webp), el título a mano en rojo, una persona
// de la calle en sombra detrás y abajo la franja roja con el precio y el botón.
// El precio sale del sitio (page_sections cold_brew); sin él, la lata dice su
// tamaño. Se pide por WhatsApp al equipo.

export default function ColdBrewPromo({ onClose }) {
  const [price, setPrice] = useState(null);
  const [number, setNumber] = useState(null);
  const cta = useRef(null);
  useEffect(() => {
    let alive = true;
    api.coldBrewContent().then((c) => alive && setPrice(coldBrewPrice(c))).catch(() => {});
    api.teamWhatsApp().then((n) => alive && setNumber(n)).catch(() => alive && setNumber('573152125327'));
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    cta.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const href = number ? `https://wa.me/${number}?text=${encodeURIComponent(coldBrewText())}` : undefined;

  return (
    <div className="mapp-promo" role="dialog" aria-modal="true" aria-label="Cold brew en lata de ACERO.press" data-testid="promo-coldbrew">
      <button type="button" className="mapp-promo-scrim" aria-label="Cerrar el anuncio" tabIndex={-1} onClick={onClose} />
      <article className="mapp-promo-card">
        <img className="mapp-promo-ghost" src={platform.siteUrl('/image/personas/lata.webp')} alt="" />
        <h2 className="mapp-promo-h">
          <span>¡Destapa</span>
          <span>el frío!</span>
        </h2>
        <img className="mapp-promo-can" src={platform.siteUrl('/image/coldbrew/lata-acero.webp')} alt="La lata de ACERO.press" width="501" height="720" />
        <div className="mapp-promo-band">
          <footer className="mapp-promo-foot">
            <span className="mapp-promo-logo" aria-label="ACERO.press"><b>ACERO</b><i>.press</i></span>
            <div className="mapp-promo-copy">
              <p className="mapp-promo-name">Cold brew en lata</p>
              <p className="mapp-promo-sub">hecho en AeroPress</p>
              <p className="mapp-promo-big" data-testid="promo-price">{price ? money(price) : '355 ml'}</p>
            </div>
          </footer>
          <div className="mapp-promo-bottom">
            <p className="mapp-promo-fine">Lata de 355 ml: concentrado en AeroPress invertida con hielo. Te escribimos por WhatsApp para la entrega.</p>
            <a ref={cta} className="mapp-promo-cta" href={href} target="_blank" rel="noopener noreferrer" data-testid="promo-cta">Pídela ahora</a>
          </div>
        </div>
      </article>
      <button type="button" className="mapp-promo-x" aria-label="Cerrar" onClick={onClose} data-testid="promo-close">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

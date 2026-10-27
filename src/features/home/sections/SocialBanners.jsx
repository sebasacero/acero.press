import { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { useSocialLinks } from '../../../shared/lib/useSocialLinks.js';
import './home.css';

// Las fichas de redes, arriba en Micra: un banner pequeño por red con un video nuestro de fondo y el
// botón de la app encima (enlaces de Configuración). Los videos solo corren mientras se ven.
const ICONS = {
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></>,
  tiktok: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.6 2.4 4.4 5 4.6" />,
  youtube: <><rect x="2.5" y="5.5" width="19" height="13" rx="3.5" /><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" /></>,
};

// El video de fondo de cada red (propios, de public/image): cambiarlos aquí
const CHANNEL_VIDEO = {
  instagram: '/image/cans.mp4',
  tiktok: '/image/metodo/aeropress-metodo.mp4',
  youtube: '/image/hero_main1.mp4',
};
const CHANNEL_NAME = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };

function ChannelBanner({ id, href, handle, note }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play?.().catch(() => {});
      else v.pause?.();
    }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <li className={`posts-banner posts-banner--${id}`}>
      <video ref={ref} src={`${CHANNEL_VIDEO[id]}#t=0.5`} muted loop playsInline preload="metadata" aria-hidden="true" />
      <a href={href} target="_blank" rel="noopener noreferrer">
        <span className="posts-app">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[id]}</svg>
          {CHANNEL_NAME[id]}
        </span>
        <b>{handle}</b>
        <small>{note}</small>
      </a>
    </li>
  );
}

const handleOf = (url) => {
  const m = /(?:instagram\.com|tiktok\.com)\/(@?[\w.]+)/.exec(url || '');
  return m ? `@${m[1].replace(/^@/, '')}` : 'YouTube';
};

export default function SocialBanners() {
  const { t } = useLanguage();
  const links = useSocialLinks();
  const channels = t('posts.channels');
  return (
    <ul className="posts-banners" id="publicaciones" aria-label={t('posts.label')}>
      {['instagram', 'tiktok', 'youtube'].map((k) => (
        <ChannelBanner key={k} id={k} href={links[k]} handle={handleOf(links[k])} note={channels[k]} />
      ))}
    </ul>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { useSocialLinks } from '../../../shared/lib/useSocialLinks.js';
import { shapePosts } from '../lib/posts.js';
import './home.css';

// Mis redes: un banner pequeño por red, con un video nuestro de fondo y el botón de la app encima
// (enlaces de Configuración). Si Instagram responde (función pública instagram-proxy), arriba
// van también las últimas publicaciones. Los videos solo corren mientras se ven.
const FEED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-proxy?limit=9`;

function usePosts() {
  const [state, setState] = useState({ posts: [], status: 'loading' });
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000); // con mala red, mejor los enlaces que esperar
    fetch(FEED_URL, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!alive) return;
        const posts = body?.success ? shapePosts(body.data, 6) : [];
        setState({ posts, status: posts.length ? 'ok' : 'down' });
      })
      .catch(() => alive && setState({ posts: [], status: 'down' }))
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctrl.abort(); clearTimeout(timer); };
  }, []);
  return state;
}

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

export default function PostsSection() {
  const { t } = useLanguage();
  const links = useSocialLinks();
  const { posts, status } = usePosts();
  const channels = t('posts.channels');
  const handle = (url) => {
    const m = /(?:instagram\.com|tiktok\.com)\/(@?[\w.]+)/.exec(url || '');
    return m ? `@${m[1].replace(/^@/, '')}` : 'YouTube';
  };

  return (
    <section className="posts" id="publicaciones" aria-labelledby="posts-title">
      <div className="posts-in">
        <div className="posts-head">
          <div>
            <div className="essp-tag">{t('posts.tag')}</div>
            <h2 className="essp-title posts-title" id="posts-title">
              {t('posts.title')}
              <span className="essp-script">{t('posts.script')}</span>
            </h2>
            <p className="posts-lede">{t('posts.lede')}</p>
          </div>
          <a className="essp-btn" href={links.instagram} target="_blank" rel="noopener noreferrer">{t('posts.follow')}</a>
        </div>

        {status === 'ok' ? (
          <ul className="posts-grid">
            {posts.map((p) => (
              <li key={p.id}>
                <a href={p.href} target="_blank" rel="noopener noreferrer" aria-label={`${t('posts.open')}: ${p.caption || p.id}`}>
                  <img src={p.image} alt="" loading="lazy" />
                  {p.isVideo && <span className="posts-video">{t('posts.video')}</span>}
                  {p.caption && <span className="posts-caption">{p.caption}</span>}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <ul className="posts-banners" aria-busy={status === 'loading'}>
          {['instagram', 'tiktok', 'youtube'].map((k) => (
            <ChannelBanner key={k} id={k} href={links[k]} handle={handle(links[k])} note={channels[k]} />
          ))}
        </ul>
      </div>
    </section>
  );
}

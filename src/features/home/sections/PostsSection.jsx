import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { useSocialLinks } from '../../../shared/lib/useSocialLinks.js';
import { shapePosts } from '../lib/posts.js';
import './home.css';

// Mis publicaciones: lo último de Instagram, por la función pública instagram-proxy (la misma
// conexión que el panel; la cuenta se renueva sola). Si la conexión está caída o la red falla,
// la sección no queda vacía: lleva a cada red, con los enlaces de Configuración.
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
        ) : (
          <div className={`posts-channels${status === 'loading' ? ' is-loading' : ''}`} aria-busy={status === 'loading'}>
            {status === 'down' && <p className="posts-fallback">{t('posts.fallback')}</p>}
            <ul>
              {['instagram', 'tiktok', 'youtube'].map((k) => (
                <li key={k}>
                  <a href={links[k]} target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[k]}</svg>
                    <b>{handle(links[k])}</b>
                    <small>{channels[k]}</small>
                    <span aria-hidden="true">→</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

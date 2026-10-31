import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { CHIPS, buildFeed, filterFeed, chipCounts, readPrices, millions, readCurated, addCurated, CURATED, CAFE_ORGS, FNC_PRICE_URL } from './feed.js';
import { money, baristaPath, sortBaristas, bogota } from './micraApp.js';
import { figureFor } from './motivation.js';
import * as api from './api.js';
import platform from './platform.js';
import Figure from './Elenco.jsx';
import { RouteBox } from './Celebrate.jsx';
import { km } from '../ruta/track.js';
import { postsToFeed, STATUS_LABEL } from './posts.js';
import PostComposer from './PostComposer.jsx';
import { useAds, AdPost } from './Ads.jsx';
import { withAds } from './ads.js';

// Hoy: el muro del barismo. Arriba el precio del café, después sus logros
// (racha, meta, lecciones: como Duolingo), dos ideas para publicar (como las
// sugerencias de Instagram), los puestos de la calle y el café de Colombia
// (FNC, marcas y fincas, curado por el equipo), recetas y videos. «Publicar» lleva a lo
// que ya existe (video con filtro, compartir mi día, mandar una receta al
// equipo); el muro todavía no guarda publicaciones de los baristas.
// El cliente ve el mismo muro en /micra/hoy (audience="client"): precios,
// puestos, café de Colombia, recetas y videos, sin logros ni ideas de foto; su
// «Publicar» le manda al equipo una receta, un café o un barista por WhatsApp.

const PRICE_KEYS = ['micra_precio_carga', 'micra_precio_ny', 'micra_precio_fecha', 'micra_muro'];
const dayLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function PriceCard({ item, admin, onEdit }) {
  const { prices, study } = item;
  return (
    <article className="mapp-post mapp-pricecard" aria-label="El café hoy" data-testid="price-card">
      <header><p className="mapp-cota">El café hoy</p>{admin && <button type="button" className="mapp-link is-onink" onClick={onEdit}>Actualizar</button>}</header>
      <dl>
        {prices.carga && <div><dd>{millions(prices.carga)}</dd><dt>Carga 125 kg · FNC</dt></div>}
        {prices.ny && <div><dd>US${prices.ny.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</dd><dt>Libra · Nueva York</dt></div>}
        <div><dd>{money(study.value)}</dd><dt>Tinto en la calle</dt><small>mediana · {study.n} puestos del estudio</small></div>
      </dl>
      <p className="mapp-fine is-onink">{prices.date ? `Precios del ${dayLabel(prices.date)} · ` : ''}<a className="mapp-link is-onink" href={FNC_PRICE_URL} target="_blank" rel="noopener noreferrer">Precio del día en la FNC ›</a></p>
    </article>
  );
}

function PriceForm({ prices, onSaved, onCancel }) {
  const [v, setV] = useState({ carga: prices.carga ? String(prices.carga) : '', ny: prices.ny ? String(prices.ny) : '' });
  const [error, setError] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const rows = [['micra_precio_carga', v.carga], ['micra_precio_ny', v.ny], ['micra_precio_fecha', date]].map(([key, value]) => ({ key, value: String(value).trim() }));
    const { error: err } = await supabase.from('app_config').upsert(rows);
    if (err) { setError(`No se guardó: ${err.message}`); return; }
    onSaved();
  };
  return (
    <form className="mapp-glass mapp-prices" onSubmit={save} data-testid="price-form">
      <p className="mapp-cota">Precios del café de hoy</p>
      <label className="mapp-field is-row"><span>Carga de 125 kg (FNC)</span><input inputMode="numeric" value={v.carga} onChange={(e) => setV((o) => ({ ...o, carga: e.target.value.slice(0, 12) }))} placeholder="2.850.000" /></label>
      <label className="mapp-field is-row"><span>Libra en Nueva York (US$)</span><input inputMode="decimal" value={v.ny} onChange={(e) => setV((o) => ({ ...o, ny: e.target.value.slice(0, 6) }))} placeholder="3,80" /></label>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <span className="mapp-row-btns">
        <button type="submit" className="mapp-btn is-small">Guardar</button>
        <button type="button" className="mapp-link" onClick={onCancel}>Cancelar</button>
      </span>
    </form>
  );
}

const BADGE_ICON = { racha: '🔥', hito: '🏅', meta: '🎯', escuela: '🎓' };
const LIKES_KEY = 'micra_muro_likes_v1';
const readLikes = () => { try { return new Set(JSON.parse(localStorage.getItem(LIKES_KEY)) ?? []); } catch { return new Set(); } };
const writeLikes = (set) => { try { localStorage.setItem(LIKES_KEY, JSON.stringify([...set].slice(-200))); } catch { /* sin memoria */ } };
const ago = (iso) => {
  if (!iso) return null;
  const days = Math.round((Date.now() - Date.parse(`${iso}T12:00:00Z`)) / 86400000);
  return days <= 0 ? 'hoy' : days === 1 ? 'ayer' : days < 30 ? `hace ${days} días` : dayLabel(iso);
};

/**
 * Una publicación como en Instagram: quién (con su nivel), dónde y cuándo, el
 * espacio de la foto o el video con su etiqueta, el texto y abajo «Me gusta»
 * (solo en este celular), compartir y lo que se puede hacer con ella.
 */
function Shell({ item, av, who, level = null, where, media, title, text, cta, testid, share }) {
  const [liked, setLiked] = useState(() => readLikes().has(item.id));
  const like = () => {
    const set = readLikes();
    if (set.has(item.id)) set.delete(item.id); else set.add(item.id);
    writeLikes(set);
    setLiked(set.has(item.id));
  };
  return (
    <article className={`mapp-post mapp-ig is-${item.kind}`} data-testid={testid}>
      <header className="mapp-ig-head">
        <span className="mapp-post-av">{av}</span>
        <span className="mapp-ig-who"><b>{who}{level && <span className="mapp-levelchip">{level}</span>}</b><small>{where}</small></span>
      </header>
      {media && <div className="mapp-ig-media">{media}</div>}
      <footer className="mapp-ig-foot">
        <button type="button" className={`mapp-ig-act ${liked ? 'on' : ''}`} aria-pressed={liked} onClick={like} aria-label="Me gusta">☕ <span>{liked ? 'Te gusta' : 'Me gusta'}</span></button>
        {share && <button type="button" className="mapp-ig-act" onClick={share} aria-label="Compartir">↗ <span>Compartir</span></button>}
        {cta && <span className="mapp-ig-cta">{cta}</span>}
      </footer>
      <div className="mapp-ig-body">
        {title && <p className="mapp-post-title">{title}</p>}
        {text && <p className="mapp-post-text">{text}</p>}
      </div>
    </article>
  );
}

/** El espacio de la foto cuando aún no hay foto: un fondo con su dibujo y su etiqueta. */
function Tile({ tone, tag, children }) {
  return (
    <div className={`mapp-ig-tile is-${tone}`}>
      {tag && <span className="mapp-ig-tag">{tag}</span>}
      {children}
    </div>
  );
}

function Post({ item, go, onShareDay, canShareDay, me, selfId, client = false }) {
  const shareLink = (title, url) => () => platform.share({ title, text: title, url });
  const meAv = <Figure name={figureFor(selfId)} className="is-avatar" />;
  if (item.kind === 'logros') {
    const cta = item.cta === 'learn'
      ? <button type="button" className="mapp-link" onClick={() => go('/micra/barista/aprende')}>Aprender esto ›</button>
      : item.cta === 'out'
        ? <button type="button" className="mapp-link" onClick={() => go('/micra/barista')}>Salir a vender ›</button>
        : canShareDay ? <button type="button" className="mapp-link" onClick={onShareDay}>Compartir mi día ›</button> : null;
    const media = (
      <Tile tone={item.badge} tag="Logro">
        <span className="mapp-ig-badge" aria-hidden="true">{BADGE_ICON[item.badge]}</span>
        {item.badge === 'racha' && <b className="mapp-ig-big">{item.count}<small>{item.count === 1 ? 'día' : 'días'}</small></b>}
        {item.badge === 'hito' && <b className="mapp-ig-big">{item.count}<small>días</small></b>}
        {item.badge === 'escuela' && item.total > 0 && item.done != null && (
          <span className="mapp-achieve-bar" role="progressbar" aria-valuemin={0} aria-valuemax={item.total} aria-valuenow={item.done}><i style={{ width: `${(item.done / item.total) * 100}%` }} /></span>
        )}
      </Tile>
    );
    return <Shell item={item} testid={`feed-logro-${item.id}`} av={meAv} who={item.by || 'Tú'} level="N1" where="Tus logros · hoy" media={media} title={item.title} text={item.text} cta={cta} />;
  }
  if (item.kind === 'dia') {
    const media = (
      <Tile tone="dia" tag="Mi día">
        <RouteBox path={item.path} className="is-feed" />
      </Tile>
    );
    return (
      <Shell
        item={item} testid="feed-dia" av={meAv} who={item.by} level="N1" where={`${item.mode === 'caminando' ? 'Caminando' : 'En la calle'} · hoy`}
        media={media} title={`El día de ${item.by}`}
        text={[item.km, `${item.stops} ${item.stops === 1 ? 'parada' : 'paradas'}`, `${item.streak} ${item.streak === 1 ? 'día' : 'días'} en racha`].join(' · ')}
        cta={canShareDay ? <button type="button" className="mapp-link" onClick={onShareDay}>Compartir mi día ›</button> : null}
      />
    );
  }
  if (item.kind === 'publicar') {
    const media = (
      <button type="button" className="mapp-ig-tile is-idea" onClick={() => go('/micra/video')} aria-label={`Tomar: ${item.title}`}>
        <span className="mapp-ig-tag">Idea de foto</span>
        <span className="mapp-ig-badge" aria-hidden="true">{item.icon}</span>
        <span className="mapp-ig-shot">📷 Toca para tomarla</span>
      </button>
    );
    return <Shell item={item} testid="feed-idea" av={<span className="mapp-post-av is-idea" aria-hidden="true">✨</span>} who="Idea para hoy" where="Sugerido para ti" media={media} title={item.title} text={item.text} cta={<button type="button" className="mapp-btn is-small" onClick={() => go('/micra/video')}>📷 Tomar la foto</button>} />;
  }
  if (item.kind === 'cafe') {
    const mark = item.org === 'Finca' ? '🌱' : item.org === 'Marca' ? '🏷️' : 'FNC';
    const media = item.image
      ? <div className="mapp-ig-photo"><img src={item.image} alt="" loading="lazy" /><span className="mapp-ig-tag">Café de Colombia</span></div>
      : <Tile tone="cafe" tag="Café de Colombia"><span className="mapp-ig-mark">{mark}</span></Tile>;
    return (
      <Shell
        item={item} testid="feed-cafe" av={<span className="mapp-post-av is-house" aria-hidden="true">{mark}</span>} who={item.by}
        where={[item.org === 'FNC' ? 'Café de Colombia' : item.org, ago(item.date)].filter(Boolean).join(' · ')}
        media={media} title={item.title} text={item.text}
        share={item.source ? shareLink(item.title, item.source) : null}
        cta={item.source ? <a className="mapp-link" href={item.source} target="_blank" rel="noopener noreferrer">Leer más ›</a> : null}
      />
    );
  }
  if (item.kind === 'puestos') {
    const url = platform.siteUrl(baristaPath(item.baristaId));
    const media = (
      <Tile tone="puesto" tag={item.live ? 'En la calle ahora' : 'Puesto'}>
        <Figure name={figureFor(item.baristaId)} className="is-feedfig" />
        <i className="mapp-anden" aria-hidden="true" />
      </Tile>
    );
    return (
      <Shell
        item={item} av={<Figure name={figureFor(item.baristaId)} className="is-avatar" />} who={item.by} level="N1"
        where={[item.title, item.live ? 'ahora' : null].filter(Boolean).join(' · ')}
        media={media} title={item.title} text={item.text ? `${item.text}${item.price ? ` · tinto ${money(item.price)}` : ''}` : null}
        share={shareLink(`El café de ${item.by} en Micra`, url)}
        cta={<button type="button" className="mapp-link" onClick={() => go(baristaPath(item.baristaId))}>Ver en el mapa ›</button>}
      />
    );
  }
  if (item.kind === 'publicaciones') {
    const url = platform.siteUrl(baristaPath(item.baristaId));
    const media = (
      <div className="mapp-ig-photo">
        {item.media.kind === 'video'
          ? <video className="mapp-post-video" src={item.media.url} controls playsInline preload="metadata" />
          : <img src={item.media.url} alt={item.text ? `Foto de ${item.by}: ${item.text}` : `Foto de ${item.by}`} loading="lazy" />}
        <span className="mapp-ig-tag">{item.media.kind === 'video' ? 'Video' : 'Foto'}</span>
      </div>
    );
    return (
      <Shell
        item={item} testid="feed-post" av={<Figure name={figureFor(item.baristaId)} className="is-avatar" />} who={item.by} level="N1"
        where={[item.where, ago(item.date)].filter(Boolean).join(' · ')} media={media} text={item.text}
        share={shareLink(`${item.by} en Micra`, url)}
        cta={item.baristaId === selfId ? null : <button type="button" className="mapp-link" onClick={() => go(baristaPath(item.baristaId))}>{client ? `Apartarle a ${item.by} ›` : `Ver a ${item.by} ›`}</button>}
      />
    );
  }
  if (item.kind === 'videos') {
    const media = (
      <div className="mapp-ig-photo">
        <video className="mapp-post-video" src={platform.siteUrl(item.video)} poster={platform.siteUrl(item.poster)} controls playsInline preload="none" />
        <span className="mapp-ig-tag">Video</span>
      </div>
    );
    // Aprende es del barista; el cliente aprende en la Escuela del sitio
    const cta = client
      ? <a className="mapp-link" href={platform.siteUrl('/escuela')}>Aprender en la Escuela ›</a>
      : <button type="button" className="mapp-link" onClick={() => go('/micra/barista/aprende')}>Aprender esto ›</button>;
    return <Shell item={item} av={<span className="mapp-post-av is-house">AP</span>} who={item.by} where={`Video · ${ago(item.date)}`} media={media} title={item.title} text={item.text} cta={cta} />;
  }
  if (item.kind === 'recetas') {
    const media = (
      <Tile tone="receta" tag="Receta">
        {item.chips && <span className="mapp-ig-chips">{item.chips.map((c) => <b key={c}>{c}</b>)}</span>}
      </Tile>
    );
    return <Shell item={item} av={<span className="mapp-post-av is-house" aria-hidden="true">☕</span>} who={item.by} where={`Receta · ${ago(item.date)}`} media={media} title={item.title} text={item.text} share={shareLink(item.title, platform.siteUrl(item.link))} cta={<a className="mapp-link" href={platform.siteUrl(item.link)}>Prepararla ›</a>} />;
  }
  return (
    <Shell
      item={item} av={<span className="mapp-post-av is-house">AP</span>} who={item.by} where={`Noticia · ${ago(item.date)}`}
      media={<Tile tone="noticia" tag="Noticia"><span className="mapp-ig-headline">{item.title}</span></Tile>}
      text={item.text} share={item.source ? shareLink(item.title, item.source) : null}
      cta={item.source ? <a className="mapp-link" href={item.source} target="_blank" rel="noopener noreferrer">Leer la fuente ›</a> : null}
    />
  );
}

// Lo que el cliente le manda al equipo para el muro (sale cuando lo revisamos)
const CLIENT_POSTS = [
  ['☕', 'Tu receta', 'Hola, equipo de Micra. Les mando mi receta para el muro: café ___ g, agua ___ ml a ___ °C, tiempo ___.'],
  ['🌱', 'Un café que te gustó', 'Hola, equipo de Micra. Les recomiendo este café para el muro: ___ (marca o finca), de ___. Lo probé en ___.'],
  ['📍', 'Un barista de tu cuadra', 'Hola, equipo de Micra. Cerca de mí vende café un barista de la calle: en ___, de ___ a ___.'],
];

function PublishSheet({ go, canShareDay, onShareDay, onClose, client = false, onCompose }) {
  const [number, setNumber] = useState(null);
  useEffect(() => { api.teamWhatsApp().then(setNumber).catch(() => setNumber('573152125327')); }, []);
  const wa = (text) => (number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : undefined);
  const recipe = 'Hola, equipo de Micra. Les mando mi receta para el muro: café ___ g, agua ___ ml a ___ °C, tiempo ___.';
  if (client) {
    return (
      <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Publicar" data-testid="publish">
        <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" onClick={onClose} />
        <section className="mapp-sheet">
          <i className="mapp-sheet-handle" aria-hidden="true" />
          <p className="mapp-cota">Publicar</p>
          <h2 className="mapp-title is-small">¿Qué le cuentas al muro?</h2>
          <div className="mapp-publish">
            {CLIENT_POSTS.map(([icon, label, text]) => (
              <a key={label} href={wa(text)} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">{icon}</span>{label}</a>
            ))}
          </div>
          <p className="mapp-fine">Le llega al equipo por WhatsApp y sale aquí cuando lo revisamos, sin tu número ni tu nombre.</p>
        </section>
      </div>
    );
  }
  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Publicar" data-testid="publish">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" onClick={onClose} />
      <section className="mapp-sheet">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <p className="mapp-cota">Publicar</p>
        <h2 className="mapp-title is-small">¿Qué quieres mostrar hoy?</h2>
        <div className="mapp-publish">
          {onCompose && <button type="button" onClick={() => { onClose(); onCompose(); }} data-testid="publish-micra"><span aria-hidden="true">📸</span>En Micra</button>}
          <button type="button" onClick={() => go('/micra/video')}><span aria-hidden="true">🎥</span>Video con filtro</button>
          <button type="button" onClick={() => go('/micra/video')}><span aria-hidden="true">📍</span>Foto del puesto</button>
          <button type="button" onClick={() => { onClose(); onShareDay(); }} disabled={!canShareDay}><span aria-hidden="true">🗺️</span>Mi día de hoy</button>
          <a href={wa(recipe)} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">☕</span>Una receta</a>
        </div>
        <p className="mapp-fine">«En Micra» sale aquí en Hoy cuando el equipo la revisa. El video y tu día se comparten en tus redes. La receta le llega al equipo y sale aquí cuando la revisamos. Tu cara y tu ubicación exacta solo salen si tú quieres.</p>
      </section>
    </div>
  );
}

/** El «＋» de la barra del cliente: la misma hoja de publicar del muro. */
export function ClientPublish({ onClose }) {
  return <PublishSheet client onClose={onClose} />;
}

/** El equipo agrega una publicación de la FNC, una marca o una finca (queda en app_config). */
function CuratedForm({ current, onSaved, onCancel }) {
  const [v, setV] = useState({ org: 'FNC', by: 'Federación Nacional de Cafeteros', title: '', text: '', source: '', image: '' });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setV((o) => ({ ...o, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const [post] = readCurated([{ ...v, date }]);
    if (!post) { setError('Falta el título, de quién es, o un enlace no empieza por https://.'); return; }
    if ((v.source && !post.source) || (v.image && !post.image)) { setError('Los enlaces van con https://.'); return; }
    const next = addCurated(current, { org: v.org, by: post.by, title: post.title, text: post.text, source: post.source, image: post.image, date });
    const { error: err } = await supabase.from('app_config').upsert([{ key: 'micra_muro', value: JSON.stringify(next) }]);
    if (err) { setError(`No se guardó: ${err.message}`); return; }
    onSaved();
  };
  return (
    <form className="mapp-glass mapp-prices" onSubmit={save} data-testid="curated-form">
      <p className="mapp-cota">Publicar en Café de Colombia</p>
      <div className="mapp-chips" role="group" aria-label="De quién">
        {CAFE_ORGS.map((o) => <button key={o} type="button" className={v.org === o ? 'on' : ''} aria-pressed={v.org === o} onClick={() => setV((x) => ({ ...x, org: o, by: o === 'FNC' ? 'Federación Nacional de Cafeteros' : x.org === 'FNC' ? '' : x.by }))}>{o}</button>)}
      </div>
      <label className="mapp-field"><span>Nombre</span><input value={v.by} onChange={set('by')} maxLength={60} placeholder="Finca La Esperanza" /></label>
      <label className="mapp-field"><span>Título</span><input value={v.title} onChange={set('title')} maxLength={120} /></label>
      <label className="mapp-field"><span>Texto</span><textarea value={v.text} onChange={set('text')} maxLength={400} rows={3} /></label>
      <label className="mapp-field"><span>Enlace de la fuente</span><input value={v.source} onChange={set('source')} placeholder="https://" inputMode="url" /></label>
      <label className="mapp-field"><span>Foto (enlace, opcional)</span><input value={v.image} onChange={set('image')} placeholder="https://" inputMode="url" /></label>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <span className="mapp-row-btns">
        <button type="submit" className="mapp-btn is-small">Publicar</button>
        <button type="button" className="mapp-link" onClick={onCancel}>Cancelar</button>
      </span>
    </form>
  );
}

/**
 * `embedded`: dentro del inicio del cliente, debajo de los baristas (como el
 * muro de Instagram bajo las historias): título h2 y sin su propio «Publicar»,
 * que ya está en el «＋» de abajo. `list`: los baristas que ya trajo el inicio.
 */
export default function HoyFeed({ go, selfId = null, asId = null, admin = false, me = null, mode = null, trip = null, canShareDay = false, onShareDay, audience = 'barista', embedded = false, list = null, ads = null }) {
  const client = audience === 'client';
  const [fetched, setBaristas] = useState([]);
  const baristas = list ?? fetched;
  const [cfg, setCfg] = useState({});
  const [chip, setChip] = useState('todo');
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [curating, setCurating] = useState(false);
  // Lo que publicaron los baristas (aprobado) y, para el barista, las suyas con su estado
  const [posts, setPosts] = useState([]);
  const [mine, setMine] = useState([]);
  const [composing, setComposing] = useState(false);
  const canPost = !client && !!selfId;
  const loadPosts = () => api.postsFeed()
    .then(async (rows) => setPosts(postsToFeed(rows, await api.postUrls((rows ?? []).map((r) => r.media_path)))))
    .catch(() => setPosts([]));
  const loadMine = () => (canPost ? api.postsMine(asId).then((r) => setMine(r ?? [])).catch(() => setMine([])) : null);
  const removeMine = async (id) => {
    try { await api.postRemove(id); } catch { /* sigue en la lista */ }
    loadMine();
    loadPosts();
  };
  const loadPrices = () => supabase.from('app_config').select('key, value').in('key', PRICE_KEYS)
    .then(({ data }) => setCfg(Object.fromEntries((data ?? []).map((r) => [r.key, r.value])))).catch(() => {});
  useEffect(() => {
    let alive = true;
    if (!list) api.listBaristas().then((l) => alive && setBaristas(sortBaristas(l ?? []))).catch(() => {});
    loadPrices();
    loadPosts();
    loadMine();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const prices = readPrices(cfg);
  const extra = readCurated(cfg.micra_muro);
  const dayKey = bogota().day;
  const items = useMemo(() => buildFeed({ baristas, selfId, me, prices, curated: [...extra, ...CURATED], dayKey, mode, posts }), [baristas, selfId, me?.streak?.count, me?.streak?.todayDone, me?.goalMet, me?.lessonsDone, mode, cfg, dayKey, posts]); // eslint-disable-line react-hooks/exhaustive-deps
  // «El día de …»: el recorrido de hoy, solo para quien lo grabó (sin tazas ni plata)
  const withDay = useMemo(() => {
    if (!me || !trip || (trip.path?.length ?? 0) < 2) return items;
    const post = { id: `dia-${dayKey}`, kind: 'dia', by: me.name, mode, path: trip.path, km: km(trip.distance), stops: trip.stops, streak: me.streak?.count ?? 0 };
    return [items[0], post, ...items.slice(1)];
  }, [items, me, trip, mode, dayKey]);
  // Los anuncios «Patrocinado» van entre las publicaciones, solo en «Todo»
  const { feed: adFeed } = useAds(client ? 'client' : 'barista', ads);
  const counts = chipCounts(withDay);
  const shown = chip === 'todo' ? withAds(withDay, adFeed) : filterFeed(withDay, chip);
  const today = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <div className={`mapp-feed ${embedded ? 'is-embedded' : ''}`} data-testid={embedded ? 'home-feed' : undefined}>
      <header className="mapp-feed-head">
        <div>
          <p className="mapp-kicker">{today}</p>
          {embedded
            ? <h2 className="mapp-title is-small">Hoy en el café</h2>
            : <h1 className="mapp-title is-small">{client ? 'Hoy en el café' : 'Hoy en la calle'}</h1>}
        </div>
        {!embedded && <button type="button" className="mapp-btn is-small is-dark" onClick={() => setPublishing(true)}>＋ Publicar</button>}
      </header>
      <div className="mapp-chips is-scroll" role="tablist" aria-label="Qué ver">
        {CHIPS.filter(([id]) => id === 'todo' || counts[id] > 0).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={chip === id} className={chip === id ? 'on' : ''} onClick={() => setChip(id)}>{label}</button>
        ))}
      </div>
      {admin && !curating && chip === 'cafe' && <button type="button" className="mapp-link" onClick={() => setCurating(true)} data-testid="curated-open">＋ Agregar publicación de la FNC, una marca o una finca</button>}
      {curating && <CuratedForm current={readCurated(cfg.micra_muro).map(({ id, kind, ...x }) => x)} onSaved={() => { setCurating(false); loadPrices(); }} onCancel={() => setCurating(false)} />}
      {editing && <PriceForm prices={prices} onSaved={() => { setEditing(false); loadPrices(); }} onCancel={() => setEditing(false)} />}
      {canPost && mine.length > 0 && (
        <section className="mapp-glass mapp-mine" aria-label="Tus publicaciones" data-testid="my-posts">
          <p className="mapp-cota">Tus publicaciones</p>
          <ul>
            {mine.slice(0, 4).map((m) => (
              <li key={m.id}>
                <span className={`mapp-mine-tag is-${m.status}`}>{STATUS_LABEL[m.status] ?? m.status}</span>
                <span className="mapp-mine-text">{m.kind === 'video' ? '🎥' : '📸'} {m.caption || (m.kind === 'video' ? 'Video' : 'Foto')}</span>
                <button type="button" className="mapp-link" onClick={() => removeMine(m.id)} aria-label={`Quitar: ${m.caption || m.kind}`}>Quitar</button>
              </li>
            ))}
          </ul>
          {mine.some((m) => m.status === 'pending') && <p className="mapp-fine">El equipo revisa lo que envías antes de que salga en Hoy.</p>}
        </section>
      )}
      <div className="mapp-posts" data-testid="feed">
        {shown.map((item) => (item.kind === 'precios'
          ? <PriceCard key={item.id} item={item} admin={admin} onEdit={() => setEditing(true)} />
          : item.kind === 'patrocinado'
            ? <AdPost key={item.id} ad={item} />
            : <Post key={item.id} item={item} go={go} onShareDay={onShareDay} canShareDay={canShareDay} me={me} selfId={selfId} client={client} />))}
      </div>
      {publishing && <PublishSheet go={go} canShareDay={canShareDay} onShareDay={onShareDay} onClose={() => setPublishing(false)} client={client} onCompose={canPost ? () => setComposing(true) : null} />}
      {composing && <PostComposer selfId={selfId} asId={asId} onClose={() => setComposing(false)} onSent={loadMine} />}
    </div>
  );
}

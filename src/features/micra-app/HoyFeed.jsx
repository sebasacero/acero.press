import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { CHIPS, buildFeed, filterFeed, chipCounts, readPrices, millions, readCurated, addCurated, CURATED, CAFE_ORGS, FNC_PRICE_URL } from './feed.js';
import { money, baristaPath, sortBaristas, bogota } from './micraApp.js';
import { figureFor } from './motivation.js';
import * as api from './api.js';
import platform from './platform.js';
import Figure from './Elenco.jsx';

// Hoy: el muro del barismo. Arriba el precio del café, después sus logros
// (racha, meta, lecciones: como Duolingo), dos ideas para publicar (como las
// sugerencias de Instagram), los puestos de la calle y el café de Colombia
// (FNC, marcas y fincas, curado por el equipo), recetas y videos. «Publicar» lleva a lo
// que ya existe (video con filtro, compartir mi día, mandar una receta al
// equipo); el muro todavía no guarda publicaciones de los baristas.

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

function Post({ item, go, onShareDay, canShareDay }) {
  if (item.kind === 'logros') {
    const cta = item.cta === 'learn'
      ? <button type="button" className="mapp-link" onClick={() => go('/micra/barista/aprende')}>Ir a Aprende ›</button>
      : item.cta === 'out'
        ? <button type="button" className="mapp-link" onClick={() => go('/micra/barista')}>Salir a vender ›</button>
        : canShareDay ? <button type="button" className="mapp-link" onClick={onShareDay}>Compartir ›</button> : null;
    return (
      <article className={`mapp-post mapp-achieve is-${item.badge}`} data-testid={`feed-logro-${item.id}`}>
        <span className="mapp-achieve-ico" aria-hidden="true">{BADGE_ICON[item.badge]}{item.badge === 'racha' && <b>{item.count}</b>}</span>
        <div>
          <p className="mapp-post-title">{item.title}</p>
          <p className="mapp-post-text">{item.text}</p>
          {item.badge === 'escuela' && item.total > 0 && item.done != null && (
            <span className="mapp-achieve-bar" role="progressbar" aria-valuemin={0} aria-valuemax={item.total} aria-valuenow={item.done}><i style={{ width: `${(item.done / item.total) * 100}%` }} /></span>
          )}
          {cta && <footer><span className="mapp-tag">Logro</span>{cta}</footer>}
        </div>
      </article>
    );
  }
  if (item.kind === 'publicar') {
    return (
      <article className="mapp-post mapp-idea" data-testid="feed-idea">
        <header className="mapp-post-who"><span className="mapp-post-av is-idea" aria-hidden="true">{item.icon}</span><span><b>Idea para hoy</b><small>Sugerido para ti</small></span></header>
        <p className="mapp-post-title">{item.title}</p>
        <p className="mapp-post-text">{item.text}</p>
        <footer><span className="mapp-tag">Para publicar</span><button type="button" className="mapp-btn is-small" onClick={() => go('/micra/video')}>📷 Tomar la foto</button></footer>
      </article>
    );
  }
  if (item.kind === 'cafe') {
    return (
      <article className="mapp-post" data-testid="feed-cafe">
        <header className="mapp-post-who"><span className="mapp-post-av is-house" aria-hidden="true">{item.org === 'Finca' ? '🌱' : item.org === 'Marca' ? '🏷️' : 'FNC'}</span><span><b>{item.by}</b><small>{[item.org === 'FNC' ? 'Café de Colombia' : item.org, item.date && dayLabel(item.date)].filter(Boolean).join(' · ')}</small></span></header>
        {item.image && <img className="mapp-post-img" src={item.image} alt="" loading="lazy" />}
        <p className="mapp-post-title">{item.title}</p>
        {item.text && <p className="mapp-post-text">{item.text}</p>}
        {item.source && <footer><span className="mapp-tag">Café de Colombia</span><a className="mapp-link" href={item.source} target="_blank" rel="noopener noreferrer">Leer más ›</a></footer>}
      </article>
    );
  }
  if (item.kind === 'puestos') {
    return (
      <article className="mapp-post">
        <header className="mapp-post-who">
          <span className="mapp-post-av"><Figure name={figureFor(item.baristaId)} className="is-avatar" /></span>
          <span><b>{item.by}</b><small>{item.live ? 'En la calle ahora' : 'Puesto'}</small></span>
        </header>
        <p className="mapp-post-title">{item.title}</p>
        {item.text && <p className="mapp-post-text">{item.text}{item.price ? ` · tinto ${money(item.price)}` : ''}</p>}
        <footer><span className="mapp-tag">Puesto</span><button type="button" className="mapp-link" onClick={() => go(baristaPath(item.baristaId))}>Ver en el mapa ›</button></footer>
      </article>
    );
  }
  if (item.kind === 'videos') {
    return (
      <article className="mapp-post">
        <header className="mapp-post-who"><span className="mapp-post-av is-house">AP</span><span><b>{item.by}</b><small>Video</small></span></header>
        <p className="mapp-post-text">{item.title}. {item.text}</p>
        <video className="mapp-post-video" src={platform.siteUrl(item.video)} poster={platform.siteUrl(item.poster)} controls playsInline preload="none" />
      </article>
    );
  }
  if (item.kind === 'recetas') {
    return (
      <article className="mapp-post">
        <header className="mapp-post-who"><span className="mapp-post-av is-house" aria-hidden="true">☕</span><span><b>{item.by}</b><small>Receta</small></span></header>
        <p className="mapp-post-title">{item.title}</p>
        <p className="mapp-post-text">{item.text}</p>
        {item.chips && <p className="mapp-post-chips">{item.chips.map((c) => <span key={c}>{c}</span>)}</p>}
        <footer><span className="mapp-tag">Receta</span><a className="mapp-link" href={platform.siteUrl(item.link)}>Prepararla ›</a></footer>
      </article>
    );
  }
  return (
    <article className="mapp-post">
      <header className="mapp-post-who"><span className="mapp-post-av is-house">AP</span><span><b>{item.by}</b><small>Noticia · {dayLabel(item.date)}</small></span></header>
      <p className="mapp-post-title">{item.title}</p>
      <p className="mapp-post-text">{item.text}</p>
      {item.source && <footer><span className="mapp-tag">Noticia</span><a className="mapp-link" href={item.source} target="_blank" rel="noopener noreferrer">Leer la fuente ›</a></footer>}
    </article>
  );
}

function PublishSheet({ go, canShareDay, onShareDay, onClose }) {
  const [number, setNumber] = useState(null);
  useEffect(() => { api.teamWhatsApp().then(setNumber).catch(() => setNumber('573152125327')); }, []);
  const recipe = 'Hola, equipo de Micra. Les mando mi receta para el muro: café ___ g, agua ___ ml a ___ °C, tiempo ___.';
  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Publicar" data-testid="publish">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" onClick={onClose} />
      <section className="mapp-sheet">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <p className="mapp-cota">Publicar</p>
        <h2 className="mapp-title is-small">¿Qué quieres mostrar hoy?</h2>
        <div className="mapp-publish">
          <button type="button" onClick={() => go('/micra/video')}><span aria-hidden="true">🎥</span>Video con filtro</button>
          <button type="button" onClick={() => go('/micra/video')}><span aria-hidden="true">📍</span>Foto del puesto</button>
          <button type="button" onClick={() => { onClose(); onShareDay(); }} disabled={!canShareDay}><span aria-hidden="true">🗺️</span>Mi día de hoy</button>
          <a href={number ? `https://wa.me/${number}?text=${encodeURIComponent(recipe)}` : undefined} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">☕</span>Una receta</a>
        </div>
        <p className="mapp-fine">El video y tu día se comparten en tus redes. La receta le llega al equipo y sale aquí cuando la revisamos. Tu cara y tu ubicación exacta solo salen si tú quieres.</p>
      </section>
    </div>
  );
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

export default function HoyFeed({ go, selfId = null, admin = false, me = null, mode = null, canShareDay = false, onShareDay }) {
  const [baristas, setBaristas] = useState([]);
  const [cfg, setCfg] = useState({});
  const [chip, setChip] = useState('todo');
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [curating, setCurating] = useState(false);
  const loadPrices = () => supabase.from('app_config').select('key, value').in('key', PRICE_KEYS)
    .then(({ data }) => setCfg(Object.fromEntries((data ?? []).map((r) => [r.key, r.value])))).catch(() => {});
  useEffect(() => {
    let alive = true;
    api.listBaristas().then((l) => alive && setBaristas(sortBaristas(l ?? []))).catch(() => {});
    loadPrices();
    return () => { alive = false; };
  }, []);
  const prices = readPrices(cfg);
  const extra = readCurated(cfg.micra_muro);
  const dayKey = bogota().day;
  const items = useMemo(() => buildFeed({ baristas, selfId, me, prices, curated: [...extra, ...CURATED], dayKey, mode }), [baristas, selfId, me?.streak?.count, me?.streak?.todayDone, me?.goalMet, me?.lessonsDone, mode, cfg, dayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = chipCounts(items);
  const shown = filterFeed(items, chip);
  const today = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <div className="mapp-feed">
      <header className="mapp-feed-head">
        <div>
          <p className="mapp-kicker">{today}</p>
          <h1 className="mapp-title is-small">Hoy en la calle</h1>
        </div>
        <button type="button" className="mapp-btn is-small is-dark" onClick={() => setPublishing(true)}>＋ Publicar</button>
      </header>
      <div className="mapp-chips is-scroll" role="tablist" aria-label="Qué ver">
        {CHIPS.filter(([id]) => id === 'todo' || counts[id] > 0).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={chip === id} className={chip === id ? 'on' : ''} onClick={() => setChip(id)}>{label}</button>
        ))}
      </div>
      {admin && !curating && chip === 'cafe' && <button type="button" className="mapp-link" onClick={() => setCurating(true)} data-testid="curated-open">＋ Agregar publicación de la FNC, una marca o una finca</button>}
      {curating && <CuratedForm current={readCurated(cfg.micra_muro).map(({ id, kind, ...x }) => x)} onSaved={() => { setCurating(false); loadPrices(); }} onCancel={() => setCurating(false)} />}
      {editing && <PriceForm prices={prices} onSaved={() => { setEditing(false); loadPrices(); }} onCancel={() => setEditing(false)} />}
      <div className="mapp-posts" data-testid="feed">
        {shown.map((item) => (item.kind === 'precios'
          ? <PriceCard key={item.id} item={item} admin={admin} onEdit={() => setEditing(true)} />
          : <Post key={item.id} item={item} go={go} onShareDay={onShareDay} canShareDay={canShareDay} />))}
      </div>
      {publishing && <PublishSheet go={go} canShareDay={canShareDay} onShareDay={onShareDay} onClose={() => setPublishing(false)} />}
    </div>
  );
}

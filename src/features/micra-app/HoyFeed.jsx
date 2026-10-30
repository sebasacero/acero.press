import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { CHIPS, buildFeed, filterFeed, chipCounts, readPrices, millions } from './feed.js';
import { money, baristaPath, sortBaristas } from './micraApp.js';
import { figureFor } from './motivation.js';
import { km } from '../ruta/track.js';
import * as api from './api.js';
import platform from './platform.js';
import Figure from './Elenco.jsx';

// Hoy: el muro del barismo. Arriba el precio del café, después los puestos de
// la calle, el día propio, videos, recetas y noticias. «Publicar» lleva a lo
// que ya existe (video con filtro, compartir mi día, mandar una receta al
// equipo); el muro todavía no guarda publicaciones de los baristas.

const PRICE_KEYS = ['micra_precio_carga', 'micra_precio_ny', 'micra_precio_fecha'];
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
      {prices.date && <p className="mapp-fine is-onink">Precios del {dayLabel(prices.date)}</p>}
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

function Post({ item, go, onShareDay }) {
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
  if (item.kind === 'recorridos') {
    return (
      <article className="mapp-post is-mine" data-testid="feed-myday">
        <p className="mapp-script">El día de {item.by}</p>
        <p className="mapp-post-title">{item.title}{item.km > 0 ? ` · ${km(item.km)}` : ''}{item.streak > 1 ? ` · ${item.streak} días seguidos` : ''}</p>
        <footer><span className="mapp-tag">Recorrido</span><button type="button" className="mapp-link" onClick={onShareDay}>Compartir mi día ›</button></footer>
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

export default function HoyFeed({ go, selfId = null, admin = false, myDay = null, onShareDay }) {
  const [baristas, setBaristas] = useState([]);
  const [cfg, setCfg] = useState({});
  const [chip, setChip] = useState('todo');
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const loadPrices = () => supabase.from('app_config').select('key, value').in('key', PRICE_KEYS)
    .then(({ data }) => setCfg(Object.fromEntries((data ?? []).map((r) => [r.key, r.value])))).catch(() => {});
  useEffect(() => {
    let alive = true;
    api.listBaristas().then((l) => alive && setBaristas(sortBaristas(l ?? []))).catch(() => {});
    loadPrices();
    return () => { alive = false; };
  }, []);
  const prices = readPrices(cfg);
  const items = useMemo(() => buildFeed({ baristas, selfId, myDay, prices }), [baristas, selfId, myDay?.cups, myDay?.km, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
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
      {editing && <PriceForm prices={prices} onSaved={() => { setEditing(false); loadPrices(); }} onCancel={() => setEditing(false)} />}
      <div className="mapp-posts" data-testid="feed">
        {shown.map((item) => (item.kind === 'precios'
          ? <PriceCard key={item.id} item={item} admin={admin} onEdit={() => setEditing(true)} />
          : <Post key={item.id} item={item} go={go} onShareDay={onShareDay} />))}
      </div>
      {publishing && <PublishSheet go={go} canShareDay={(myDay?.cups ?? 0) > 0} onShareDay={onShareDay} onClose={() => setPublishing(false)} />}
    </div>
  );
}

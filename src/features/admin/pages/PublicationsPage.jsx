import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { publishToInstagram as igPublish } from '../../../shared/lib/instagram.js';
import { FORMATS } from '../espresaleCard.js';

const isVideoUrl = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url || '');
// Instagram solo acepta JPEG para imágenes (las tarjetas viejas se guardaban en PNG).
const isJpegUrl = (url) => /\.(jpe?g)(\?|$)/i.test(url || '');

// Formato de cada pieza según su tamaño real: la proporción y para qué
// formatos de Micra sirve (9:16 vale para historia, reel, TikTok y Shorts).
const RATIO_NAMES = { '0.563': '9:16', '0.750': '3:4', '0.800': '4:5', '1.000': '1:1', '1.778': '16:9' };
function formatOf([w, h]) {
  const r = w / h;
  const fits = Object.values(FORMATS).filter((f) => Math.abs(f.w / f.h - r) / r < 0.03);
  if (!fits.length) return { ratio: `${w}×${h}`, title: 'No coincide con ningún formato de Micra' };
  const key = (fits[0].w / fits[0].h).toFixed(3);
  return { ratio: RATIO_NAMES[key] ?? `${w}×${h}`, title: `${w}×${h} · sirve para ${fits.map((f) => f.label).join(', ')}` };
}

export default function PublicationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [igBusyId, setIgBusyId] = useState(null);
  const [igResults, setIgResults] = useState({});
  const [dims, setDims] = useState({}); // id → [ancho, alto] de la imagen o el video
  const measure = (id, w, h) => { if (w && h) setDims((d) => (d[id] ? d : { ...d, [id]: [w, h] })); };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('publications')
      .select('id, video_url, caption, published, created_at, scheduled_at, results, media_kind')
      .order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePublished = async (item) => {
    await supabase.from('publications').update({ published: !item.published }).eq('id', item.id);
    await load();
  };

  const remove = async (id) => {
    if (!confirm('¿Borrar esta publicación?')) return;
    await supabase.from('publications').delete().eq('id', id);
    await load();
  };

  const share = async (item) => {
    try {
      const res = await fetch(item.video_url);
      const blob = await res.blob();
      const file = new File([blob], isVideoUrl(item.video_url) ? 'aceropress.mp4' : 'aceropress.png', { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: item.caption });
      } else {
        window.open(item.video_url, '_blank');
      }
    } catch (err) {
      console.error(err);
      window.open(item.video_url, '_blank');
    }
  };

  // Publica en Instagram: videos como Reel, imágenes JPEG como post o historia.
  const publishToInstagram = async (item) => {
    setIgBusyId(item.id);
    const isStory = item.media_kind === 'story';
    const kind = isVideoUrl(item.video_url) ? (isStory ? 'story_video' : 'reel') : isStory ? 'story' : 'image';
    try {
      const ig = await igPublish({ mediaUrl: item.video_url, kind, caption: item.caption, publicationId: item.id });
      setIgResults((r) => ({
        ...r,
        [item.id]: ig.success ? { ok: true, message: '✓ Publicado en Instagram.' } : { ok: false, message: ig.error || 'No se pudo publicar en Instagram.' },
      }));
      if (ig.success) await load();
    } catch (err) {
      setIgResults((r) => ({ ...r, [item.id]: { ok: false, message: err.message } }));
    }
    setIgBusyId(null);
  };

  if (loading) return <p className="admin-loading">Cargando publicaciones…</p>;

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Publicaciones</h1>
      <p className="admin-page-sub">
        Contenido generado (desde Micra y otras fuentes) listo para publicar en redes sociales.
        Los videos se publican como Reel y las tarjetas JPEG como post o historia, según su formato.
        Cada pieza muestra su proporción: 9:16 sirve para historias, Reels, TikTok y Shorts; 4:5, 3:4 y 1:1 para el feed; 16:9 para YouTube.
      </p>

      {items.length === 0 ? (
        <p className="admin-loading">Todavía no hay nada aquí — genera una tarjeta desde Micra.</p>
      ) : (
        <div className="admin-pub-grid">
          {items.map((it) => {
            const video = isVideoUrl(it.video_url);
            const igRes = igResults[it.id];
            const fmt = dims[it.id] ? formatOf(dims[it.id]) : null;
            return (
              <div key={it.id} className={`admin-card admin-pub-card ${it.published ? 'is-published' : ''}`}>
                {video ? (
                  <video src={it.video_url} controls className="admin-pub-thumb" onLoadedMetadata={(e) => measure(it.id, e.currentTarget.videoWidth, e.currentTarget.videoHeight)} />
                ) : (
                  <img src={it.video_url} alt="" className="admin-pub-thumb" onLoad={(e) => measure(it.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} />
                )}
                <p className="admin-pub-caption">{it.caption}</p>
                <div className="admin-pub-meta">
                  <span>{new Date(it.created_at).toLocaleString('es-CO')}</span>
                  {fmt && <span className="admin-chip" title={fmt.title}>{fmt.ratio}</span>}
                  <span className={`admin-chip ${it.published ? 'chip-green' : 'chip-red'}`}>
                    {it.published ? 'Publicado' : 'Pendiente'}
                  </span>
                </div>
                <div className="admin-pub-actions">
                  <button className="admin-btn-primary admin-btn-sm" onClick={() => share(it)}>Compartir</button>
                  {(video || isJpegUrl(it.video_url)) && (
                    <button
                      className="admin-btn-primary admin-btn-sm"
                      disabled={igBusyId === it.id}
                      onClick={() => publishToInstagram(it)}
                    >
                      {igBusyId === it.id ? 'Publicando…' : '📸 Instagram'}
                    </button>
                  )}
                  <button className="admin-btn-ghost admin-btn-sm" onClick={() => togglePublished(it)}>
                    {it.published ? 'Marcar pendiente' : 'Marcar publicado'}
                  </button>
                  <button className="admin-btn-ghost admin-btn-sm" onClick={() => remove(it.id)}>Borrar</button>
                </div>
                {igRes && (
                  <p className="admin-fineprint" style={{ color: igRes.ok ? '#0f7d4d' : '#de1b1b' }}>
                    {igRes.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

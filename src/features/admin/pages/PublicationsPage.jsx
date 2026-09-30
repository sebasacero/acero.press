import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

const isVideoUrl = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url || '');

export default function PublicationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [igBusyId, setIgBusyId] = useState(null);
  const [igResults, setIgResults] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('publications')
      .select('id, video_url, caption, published, created_at, scheduled_at, results')
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

  // Publica en Instagram (Reels) usando la función publish-content ya
  // desplegada en este proyecto de Supabase.
  const publishToInstagram = async (item) => {
    setIgBusyId(item.id);
    const { data, error } = await supabase.functions.invoke('publish-content', {
      body: { video_url: item.video_url, caption: item.caption, platforms: { ig: true } },
    });
    setIgBusyId(null);
    const igOutcome = data?.results?.instagram;
    if (!error && igOutcome?.success) {
      setIgResults((r) => ({ ...r, [item.id]: { ok: true, message: '✓ Publicado en Instagram.' } }));
      await supabase.from('publications').update({ published: true }).eq('id', item.id);
      await load();
    } else {
      setIgResults((r) => ({
        ...r,
        [item.id]: { ok: false, message: error?.message || igOutcome?.error || 'No se pudo publicar en Instagram.' },
      }));
    }
  };

  if (loading) return <p className="admin-loading">Cargando publicaciones…</p>;

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Publicaciones</h1>
      <p className="admin-page-sub">
        Contenido generado (desde Espresale y otras fuentes) listo para publicar en redes sociales.
        Solo los videos se pueden publicar directo en Instagram (Reels no acepta fotos).
      </p>

      {items.length === 0 ? (
        <p className="admin-loading">Todavía no hay nada aquí — genera una tarjeta desde Espresale.</p>
      ) : (
        <div className="admin-pub-grid">
          {items.map((it) => {
            const video = isVideoUrl(it.video_url);
            const igRes = igResults[it.id];
            return (
              <div key={it.id} className={`admin-card admin-pub-card ${it.published ? 'is-published' : ''}`}>
                {video ? (
                  <video src={it.video_url} controls className="admin-pub-thumb" />
                ) : (
                  <img src={it.video_url} alt="" className="admin-pub-thumb" />
                )}
                <p className="admin-pub-caption">{it.caption}</p>
                <div className="admin-pub-meta">
                  <span>{new Date(it.created_at).toLocaleString('es-CO')}</span>
                  <span className={`admin-chip ${it.published ? 'chip-green' : 'chip-red'}`}>
                    {it.published ? 'Publicado' : 'Pendiente'}
                  </span>
                </div>
                <div className="admin-pub-actions">
                  <button className="admin-btn-primary admin-btn-sm" onClick={() => share(it)}>Compartir</button>
                  {video && (
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

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

export default function PublicationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('publications')
      .select('id, video_url, caption, published, created_at, scheduled_at')
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
      const file = new File([blob], 'aceropress.png', { type: blob.type });
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

  if (loading) return <p className="admin-loading">Cargando publicaciones…</p>;

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Publicaciones</h1>
      <p className="admin-page-sub">
        Contenido generado (desde Espresale y otras fuentes) listo para publicar en redes sociales.
      </p>

      {items.length === 0 ? (
        <p className="admin-loading">Todavía no hay nada aquí — genera una tarjeta desde Espresale.</p>
      ) : (
        <div className="admin-pub-grid">
          {items.map((it) => (
            <div key={it.id} className={`admin-card admin-pub-card ${it.published ? 'is-published' : ''}`}>
              <img src={it.video_url} alt="" className="admin-pub-thumb" />
              <p className="admin-pub-caption">{it.caption}</p>
              <div className="admin-pub-meta">
                <span>{new Date(it.created_at).toLocaleString('es-CO')}</span>
                <span className={`admin-chip ${it.published ? 'chip-green' : 'chip-red'}`}>
                  {it.published ? 'Publicado' : 'Pendiente'}
                </span>
              </div>
              <div className="admin-pub-actions">
                <button className="admin-btn-primary admin-btn-sm" onClick={() => share(it)}>Compartir</button>
                <button className="admin-btn-ghost admin-btn-sm" onClick={() => togglePublished(it)}>
                  {it.published ? 'Marcar pendiente' : 'Marcar publicado'}
                </button>
                <button className="admin-btn-ghost admin-btn-sm" onClick={() => remove(it.id)}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

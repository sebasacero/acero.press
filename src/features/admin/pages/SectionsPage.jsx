import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

const SECTION_TYPES = ['hero_video', 'text_banner', 'banner_carousel', 'custom'];

const EMPTY_BANNER = { image: '', title: '', subtitle: '', cta_text: '', cta_link: '' };

export default function SectionsPage() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [draftContent, setDraftContent] = useState({});
  const [saving, setSaving] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newType, setNewType] = useState(SECTION_TYPES[0]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('page_sections').select('*').order('order_index');
    setSections(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEditor = (section) => {
    setExpanded(section.id);
    setDraftContent(section.content || {});
  };

  const saveContent = async (id) => {
    setSaving(true);
    await supabase.from('page_sections').update({ content: draftContent, updated_at: new Date().toISOString() }).eq('id', id);
    setSaving(false);
    setExpanded(null);
    await load();
  };

  const toggleActive = async (section) => {
    await supabase.from('page_sections').update({ active: !section.active }).eq('id', section.id);
    await load();
  };

  const createSection = async () => {
    if (!newSlug.trim()) return;
    const maxOrder = Math.max(0, ...sections.map((s) => s.order_index));
    await supabase.from('page_sections').insert({
      slug: newSlug.trim().toLowerCase().replace(/\s+/g, '_'),
      section_type: newType,
      order_index: maxOrder + 1,
      content: newType === 'banner_carousel' ? { banners: [EMPTY_BANNER] } : { title: '', subtitle: '' },
      active: false, // inactiva por defecto hasta que se le agregue contenido real y un componente que la muestre
    });
    setNewSlug('');
    await load();
  };

  const updateBanner = (i, field, value) => {
    setDraftContent((c) => {
      const banners = [...(c.banners || [])];
      banners[i] = { ...banners[i], [field]: value };
      return { ...c, banners };
    });
  };

  const addBanner = () => setDraftContent((c) => ({ ...c, banners: [...(c.banners || []), { ...EMPTY_BANNER }] }));
  const removeBanner = (i) =>
    setDraftContent((c) => ({ ...c, banners: (c.banners || []).filter((_, idx) => idx !== i) }));

  const updateField = (key, value) => setDraftContent((c) => ({ ...c, [key]: value }));

  if (loading) return <p className="admin-loading">Cargando secciones…</p>;

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Secciones del sitio</h1>
      <p className="admin-page-sub">
        Todo lo que aparece en la página pública, en un solo lugar. Activar/desactivar cambia
        de inmediato lo que ve el visitante. Las secciones nuevas necesitan que exista un
        componente que sepa mostrar su tipo (<code>hero_video</code>, <code>text_banner</code>,
        <code>banner_carousel</code>) — si creas un tipo distinto, dímelo y conecto el componente.
      </p>

      <div className="admin-card" style={{ marginBottom: '1.4rem' }}>
        <div className="admin-card-header"><h3>Nueva sección</h3></div>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="admin-price-input"
            placeholder="slug_de_la_seccion"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
          />
          <select className="admin-adjust-select" value={newType} onChange={(e) => setNewType(e.target.value)}>
            {SECTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="admin-btn-primary admin-btn-sm" onClick={createSection}>+ Crear</button>
        </div>
      </div>

      <div className="admin-sections-list">
        {sections.map((s) => (
          <div key={s.id} className={`admin-card ${!s.active ? 'is-inactive' : ''}`}>
            <div className="admin-card-header">
              <h3>{s.slug} <span className="admin-page-sub" style={{ display: 'inline' }}>({s.section_type})</span></h3>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <label className="admin-switch">
                  <input type="checkbox" checked={s.active} onChange={() => toggleActive(s)} />
                  <span>{s.active ? 'Activa' : 'Oculta'}</span>
                </label>
                <button className="admin-btn-ghost admin-btn-sm" onClick={() => openEditor(s)}>
                  {expanded === s.id ? 'Cerrar' : 'Editar'}
                </button>
              </div>
            </div>

            {expanded === s.id && (
              <div className="admin-section-editor">
                {Array.isArray(draftContent.banners) ? (
                  <>
                    {draftContent.banners.map((b, i) => (
                      <div key={i} className="admin-banner-edit-row">
                        <input placeholder="URL de imagen" value={b.image} onChange={(e) => updateBanner(i, 'image', e.target.value)} />
                        <input placeholder="Título" value={b.title} onChange={(e) => updateBanner(i, 'title', e.target.value)} />
                        <input placeholder="Subtítulo" value={b.subtitle} onChange={(e) => updateBanner(i, 'subtitle', e.target.value)} />
                        <input placeholder="Texto del botón" value={b.cta_text} onChange={(e) => updateBanner(i, 'cta_text', e.target.value)} />
                        <input placeholder="Link del botón" value={b.cta_link} onChange={(e) => updateBanner(i, 'cta_link', e.target.value)} />
                        <button className="admin-remove-item" onClick={() => removeBanner(i)}>×</button>
                      </div>
                    ))}
                    <button className="admin-btn-ghost admin-btn-sm" onClick={addBanner}>+ Agregar banner</button>
                  </>
                ) : (
                  Object.keys(draftContent).length === 0 ? (
                    <p className="admin-loading">Sin campos de texto simples — edita el JSON completo si lo necesitas.</p>
                  ) : (
                    Object.entries(draftContent).map(([key, value]) =>
                      typeof value === 'string' ? (
                        <label key={key} className="admin-field" style={{ marginBottom: '.6rem' }}>
                          <span>{key}</span>
                          <input value={value} onChange={(e) => updateField(key, e.target.value)} />
                        </label>
                      ) : null
                    )
                  )
                )}

                <button className="admin-btn-primary admin-btn-sm" disabled={saving} onClick={() => saveContent(s.id)}>
                  {saving ? 'Guardando…' : 'Guardar sección'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

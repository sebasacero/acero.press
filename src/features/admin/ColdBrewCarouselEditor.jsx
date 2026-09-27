import { useState, useEffect } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { useAdminAuth } from './useAdminAuth.js';
import './admin.css';

const TEXT_FIELDS = [
  { key: 'title1', label: 'Título grande' },
  { key: 'figLabel', label: 'Etiqueta (FIG. — RECETA)' },
  { key: 'ratio', label: 'Ratio' },
  { key: 'doseLabel', label: 'Etiqueta de dosis' },
  { key: 'target', label: 'Líquido objetivo' },
  { key: 'caption', label: 'Leyenda / explicación', multiline: true },
];
const LANGS = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
];

export default function ColdBrewCarouselEditor({ onSaved }) {
  const { isAdmin, adminInfo } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from('page_sections')
      .select('content')
      .eq('slug', 'cold_brew')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.content?.slides) setSlides(data.content.slides);
      });
  }, [open]);

  if (!isAdmin || adminInfo?.role !== 'owner') return null;

  const updateSlideField = (i, key, lang, value) => {
    setSlides((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: { ...next[i][key], [lang]: value } };
      return next;
    });
  };

  const updateSimpleField = (i, key, value) => {
    setSlides((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: value };
      return next;
    });
  };

  const updateDoseDigit = (i, digitIndex, value) => {
    setSlides((prev) => {
      const next = [...prev];
      const dose = [...next[i].dose];
      dose[digitIndex] = value.slice(0, 1) || '0';
      next[i] = { ...next[i], dose };
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    await supabase
      .from('page_sections')
      .update({ content: { slides }, updated_at: new Date().toISOString() })
      .eq('slug', 'cold_brew');
    setSaving(false);
    setOpen(false);
    onSaved?.();
  };

  const slide = slides[activeSlide];

  return (
    <div className="section-edit-wrap section-edit-top-right">
      <button type="button" className="section-edit-btn" onClick={() => setOpen((v) => !v)} aria-label="Editar Cold Brew">
        ✎
      </button>

      {open && (
        <div className="coldbrew-editor-modal" onClick={(e) => e.stopPropagation()}>
          <div className="coldbrew-editor-tabs">
            {slides.map((s, i) => (
              <button
                key={i}
                className={`admin-tab ${activeSlide === i ? 'active' : ''}`}
                onClick={() => setActiveSlide(i)}
              >
                {s.title1?.es || `Diapositiva ${i + 1}`}
              </button>
            ))}
          </div>

          {slide && (
            <div className="coldbrew-editor-body">
              <div className="admin-row-3">
                <label className="admin-field">
                  <span>Video (URL)</span>
                  <input value={slide.video} onChange={(e) => updateSimpleField(activeSlide, 'video', e.target.value)} />
                </label>
                <label className="admin-field">
                  <span>% barra llena</span>
                  <input
                    type="number"
                    value={slide.ratioPercent}
                    onChange={(e) => updateSimpleField(activeSlide, 'ratioPercent', Number(e.target.value))}
                  />
                </label>
                <label className="admin-field">
                  <span>Dosis (4 caracteres)</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {slide.dose.map((d, di) => (
                      <input
                        key={di}
                        maxLength={1}
                        value={d}
                        style={{ width: 32, textAlign: 'center' }}
                        onChange={(e) => updateDoseDigit(activeSlide, di, e.target.value)}
                      />
                    ))}
                  </div>
                </label>
              </div>

              {TEXT_FIELDS.map((f) => (
                <div key={f.key} className="section-edit-field-group">
                  <p className="section-edit-field-title">{f.label}</p>
                  {LANGS.map((l) => (
                    <label key={l.code} className="section-edit-lang-row">
                      <span>{l.label}</span>
                      {f.multiline ? (
                        <textarea
                          value={slide[f.key]?.[l.code] || ''}
                          onChange={(e) => updateSlideField(activeSlide, f.key, l.code, e.target.value)}
                        />
                      ) : (
                        <input
                          value={slide[f.key]?.[l.code] || ''}
                          onChange={(e) => updateSlideField(activeSlide, f.key, l.code, e.target.value)}
                        />
                      )}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="section-edit-actions">
            <button className="admin-btn-ghost admin-btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="admin-btn-primary admin-btn-sm" disabled={saving} onClick={save}>
              {saving ? 'Guardando…' : 'Guardar las 4 recetas'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

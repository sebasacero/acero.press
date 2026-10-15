import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { useIsOwner } from './useAdminAuth.js';
import { useAdminUI } from './AdminUIContext.jsx';
import EditDrawer, { LangTabs, LANGS } from './EditDrawer.jsx';
import './admin.css';

const TEXT_FIELDS = [
  { key: 'title1', label: 'Título grande' },
  { key: 'figLabel', label: 'Etiqueta superior (FIG. — RECETA)' },
  { key: 'ratio', label: 'Insignia roja (ratio)' },
  { key: 'doseLabel', label: 'Etiqueta de dosis' },
  { key: 'target', label: 'Líquido objetivo (después del /)' },
  { key: 'caption', label: 'Leyenda bajo la barra', multiline: true },
];

/**
 * Lápiz del carrusel Cold Brew: edita las diapositivas guardadas en
 * page_sections (slug 'cold_brew'). `slides` son las que se están mostrando
 * ahora, para arrancar desde ahí si la fila todavía no tiene contenido.
 */
export default function ColdBrewCarouselEditor({ slides: currentSlides, activeIndex = 0, onSaved }) {
  const isOwner = useIsOwner();
  const { editMode } = useAdminUI();
  const [open, setOpen] = useState(false);

  if (!isOwner || !editMode) return null;

  return (
    <>
      <span className="bp-edit-frame" aria-hidden="true" />
      <button
        type="button"
        className="bp-edit-tag bp-edit-top-left"
        onClick={() => setOpen(true)}
        aria-label="Editar recetas del carrusel"
      >
        <span className="bp-edit-icon" aria-hidden="true">✎</span>
        <span className="bp-edit-label">Editar · Recetas del carrusel</span>
      </button>
      {open && (
        <CarouselDrawer
          currentSlides={currentSlides}
          initialIndex={activeIndex}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); onSaved?.(); }}
        />
      )}
    </>
  );
}

function CarouselDrawer({ currentSlides, initialIndex, onClose, onSaved }) {
  const [slides, setSlides] = useState(null);
  const [original, setOriginal] = useState('');
  const [active, setActive] = useState(initialIndex);
  const [lang, setLang] = useState('es');
  const [status, setStatus] = useState({ saving: false, error: null });

  useEffect(() => {
    let alive = true;
    supabase
      .from('page_sections')
      .select('content')
      .eq('slug', 'cold_brew')
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const loaded = data?.content?.slides?.length ? data.content.slides : currentSlides;
        setSlides(loaded);
        setOriginal(JSON.stringify(loaded));
      });
    return () => { alive = false; };
    // Solo al abrir: no recargues mientras editas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = slides && JSON.stringify(slides) !== original;

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Cerrar de todos modos?')) return;
    onClose();
  }, [dirty, onClose]);

  const patch = (changes) =>
    setSlides((prev) => prev.map((s, i) => (i === active ? { ...s, ...changes } : s)));
  const setText = (key, value) => {
    const s = slides[active];
    patch({ [key]: { ...(s[key] || {}), [lang]: value } });
  };
  const setDigit = (di, value) => {
    const dose = [...slides[active].dose];
    dose[di] = value.slice(-1) || '0';
    patch({ dose });
  };

  const save = async () => {
    setStatus({ saving: true, error: null });
    const { data, error } = await supabase
      .from('page_sections')
      .update({ content: { slides }, updated_at: new Date().toISOString() })
      .eq('slug', 'cold_brew')
      .select('slug');
    if (error || !data?.length) {
      setStatus({
        saving: false,
        error: error ? `No se guardó: ${error.message}` : 'No existe la sección "cold_brew" en page_sections.',
      });
      return;
    }
    setStatus({ saving: false, error: null });
    onSaved();
  };

  const slide = slides?.[active];
  const filled = slide
    ? Object.fromEntries(LANGS.map((l) => [l.code, TEXT_FIELDS.every((f) => (slide[f.key]?.[l.code] ?? '').trim() !== '')]))
    : {};

  return (
    <EditDrawer
      fig="FIG. 02 — COLD BREW"
      title="Recetas del carrusel"
      wide
      onClose={requestClose}
      footer={
        <>
          <span className="bp-drawer-status">
            {status.error ? <span className="bp-error">{status.error}</span> : dirty ? 'Cambios sin guardar' : 'Sin cambios'}
          </span>
          <button type="button" className="bp-btn bp-btn-ghost" onClick={requestClose}>Cancelar</button>
          <button type="button" className="bp-btn bp-btn-primary" disabled={status.saving || !dirty} onClick={save}>
            {status.saving ? 'Guardando…' : `Guardar ${slides?.length ?? ''} recetas`}
          </button>
        </>
      }
    >
      {!slide ? (
        <p className="bp-muted">Cargando…</p>
      ) : (
        <>
          <div className="bp-slide-tabs">
            {slides.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`bp-slide-tab ${i === active ? 'active' : ''}`}
                onClick={() => setActive(i)}
              >
                <span className="bp-slide-num">{String(i + 1).padStart(2, '0')}</span>
                {s.title1?.es || `Diapositiva ${i + 1}`}
              </button>
            ))}
          </div>

          <p className="bp-section-label">Datos de la receta</p>
          <div className="bp-grid-3">
            <label className="bp-field">
              <span className="bp-field-label">Precio (COP)</span>
              <input
                type="number"
                min="0"
                step="500"
                value={slide.price ?? ''}
                placeholder="Sin precio"
                onChange={(e) => patch({ price: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </label>
            <label className="bp-field">
              <span className="bp-field-label">Barra llena (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={slide.ratioPercent ?? 0}
                onChange={(e) => patch({ ratioPercent: Math.max(0, Math.min(100, Number(e.target.value))) })}
              />
            </label>
            <div className="bp-field">
              <span className="bp-field-label">Dosis (odómetro)</span>
              <div className="bp-odo-edit">
                {slide.dose.map((d, di) => (
                  <input key={di} value={d} maxLength={2} aria-label={`Dígito ${di + 1}`} onChange={(e) => setDigit(di, e.target.value)} />
                ))}
              </div>
            </div>
          </div>
          <label className="bp-field">
            <span className="bp-field-label">Video de fondo (URL)</span>
            <input value={slide.video ?? ''} onChange={(e) => patch({ video: e.target.value })} />
          </label>

          <p className="bp-section-label">Textos</p>
          <LangTabs lang={lang} onChange={setLang} filled={filled} />
          {TEXT_FIELDS.map((f) => {
            const Input = f.multiline ? 'textarea' : 'input';
            return (
              <label key={f.key} className="bp-field">
                <span className="bp-field-label">{f.label}<em>{lang.toUpperCase()}</em></span>
                <Input
                  value={slide[f.key]?.[lang] ?? ''}
                  onChange={(e) => setText(f.key, e.target.value)}
                  {...(f.multiline ? { rows: 3 } : {})}
                />
              </label>
            );
          })}
        </>
      )}
    </EditDrawer>
  );
}

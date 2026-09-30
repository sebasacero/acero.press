import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { useAdminAuth } from './useAdminAuth.js';
import './admin.css';

const LANGS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
];

/**
 * fields: [{ baseKey: 'hero_address', label: 'Dirección', multiline?: false }]
 * Cada field guarda 3 llaves en app_config: `${baseKey}_es`, `${baseKey}_en`, `${baseKey}_ja`.
 *
 * El popover se renderiza en un portal a document.body con position:fixed,
 * para que nunca lo recorte un contenedor padre con overflow:hidden (como
 * pasa con el banner del campeonato o el carrusel de Cold Brew).
 */
export default function SectionEditButton({ fields, onSaved, className = '' }) {
  const { isAdmin, adminInfo } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const keys = fields.flatMap((f) => LANGS.map((l) => `${f.baseKey}_${l.code}`));
    supabase
      .from('app_config')
      .select('key, value')
      .in('key', keys)
      .then(({ data }) => {
        const map = {};
        (data ?? []).forEach((row) => (map[row.key] = row.value));
        setValues(map);
      });
  }, [open, fields]);

  if (!isAdmin || adminInfo?.role !== 'owner') return null;

  const save = async () => {
    setSaving(true);
    const rows = Object.entries(values).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));
    await supabase.from('app_config').upsert(rows);
    setSaving(false);
    setOpen(false);
    onSaved?.();
  };

  return (
    <>
      <div className={`section-edit-wrap ${className}`}>
        <button
          type="button"
          className="section-edit-btn"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
          aria-label="Editar este texto"
        >
          ✎
        </button>
      </div>

      {open && createPortal(
        <div className="section-edit-portal-backdrop" onClick={() => setOpen(false)}>
          <div className="section-edit-popover section-edit-popover-fixed" onClick={(e) => e.stopPropagation()}>
            {fields.map((f) => (
              <div key={f.baseKey} className="section-edit-field-group">
                <p className="section-edit-field-title">{f.label}</p>
                {LANGS.map((l) => (
                  <label key={l.code} className="section-edit-lang-row">
                    <span>{l.label}</span>
                    {f.multiline ? (
                      <textarea
                        value={values[`${f.baseKey}_${l.code}`] || ''}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [`${f.baseKey}_${l.code}`]: e.target.value }))
                        }
                      />
                    ) : (
                      <input
                        type="text"
                        value={values[`${f.baseKey}_${l.code}`] || ''}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [`${f.baseKey}_${l.code}`]: e.target.value }))
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            ))}
            <div className="section-edit-actions">
              <button className="admin-btn-ghost admin-btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="admin-btn-primary admin-btn-sm" disabled={saving} onClick={save}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

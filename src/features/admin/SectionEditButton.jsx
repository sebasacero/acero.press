import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { useIsOwner } from './useAdminAuth.js';
import { useAdminUI } from './AdminUIContext.jsx';
import EditDrawer, { LangTabs, LANGS } from './EditDrawer.jsx';
import './admin.css';

/**
 * Lápiz de edición sobre una sección del sitio en vivo (solo tu cuenta owner,
 * y solo con "Modo edición" encendido en el dock).
 *
 * Dos usos:
 *  - fields: edita textos de app_config en un panel lateral.
 *      [{ key: 'hero_address', label: 'Dirección', multiline?, i18n? = true, hint? }]
 *      Con i18n se guardan 3 llaves: `${key}_es`, `${key}_en`, `${key}_ja`.
 *  - toolId: el contenido vive en una herramienta del panel (p. ej. el
 *      catálogo) — el lápiz la abre directamente.
 *
 * El elemento padre debe tener position: relative.
 */
export default function SectionEditButton({ section, fig = 'FIG. —', fields, toolId, onSaved, placement = 'top-left' }) {
  const isOwner = useIsOwner();
  const { editMode, openTool } = useAdminUI();
  const [open, setOpen] = useState(false);

  if (!isOwner || !editMode) return null;

  const hasFields = Array.isArray(fields) && fields.length > 0;
  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasFields) setOpen(true);
    else if (toolId) openTool(toolId);
  };

  return (
    <>
      <span className="bp-edit-frame" aria-hidden="true" />
      <button type="button" className={`bp-edit-tag bp-edit-${placement}`} onClick={onClick} aria-label={`Editar ${section}`}>
        <span className="bp-edit-icon" aria-hidden="true">✎</span>
        <span className="bp-edit-label">Editar · {section}</span>
        {!hasFields && toolId && <span className="bp-edit-arrow" aria-hidden="true">↗</span>}
      </button>

      {open && (
        <FieldsDrawer
          section={section}
          fig={fig}
          fields={fields}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); onSaved?.(); }}
        />
      )}
    </>
  );
}

const keyOf = (f) => f.key || f.baseKey;
const isI18n = (f) => f.i18n !== false;
const allKeys = (fields) =>
  fields.flatMap((f) => (isI18n(f) ? LANGS.map((l) => `${keyOf(f)}_${l.code}`) : [keyOf(f)]));

function FieldsDrawer({ section, fig, fields, onClose, onSaved }) {
  const [lang, setLang] = useState('es');
  const [original, setOriginal] = useState(null);
  const [values, setValues] = useState({});
  const [status, setStatus] = useState({ saving: false, error: null });
  const keysSig = allKeys(fields).join('|');

  useEffect(() => {
    let active = true;
    supabase
      .from('app_config')
      .select('key, value')
      .in('key', keysSig.split('|'))
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setStatus({ saving: false, error: 'No se pudo cargar el contenido actual.' });
        const map = {};
        (data ?? []).forEach((row) => (map[row.key] = row.value ?? ''));
        setOriginal(map);
        setValues(map);
      });
    return () => { active = false; };
  }, [keysSig]);

  const changed = original
    ? allKeys(fields).filter((k) => (values[k] ?? '') !== (original[k] ?? ''))
    : [];

  const requestClose = useCallback(() => {
    if (changed.length && !window.confirm('Tienes cambios sin guardar. ¿Cerrar de todos modos?')) return;
    onClose();
  }, [changed.length, onClose]);

  const save = async () => {
    if (!changed.length) return onClose();
    setStatus({ saving: true, error: null });
    const now = new Date().toISOString();
    const rows = changed.map((key) => ({ key, value: values[key] ?? '', updated_at: now }));
    const { error } = await supabase.from('app_config').upsert(rows);
    if (error) {
      setStatus({ saving: false, error: `No se guardó: ${error.message}` });
      return;
    }
    setStatus({ saving: false, error: null });
    onSaved();
  };

  const filled = Object.fromEntries(
    LANGS.map((l) => [
      l.code,
      fields.filter(isI18n).every((f) => (values[`${keyOf(f)}_${l.code}`] ?? '').trim() !== ''),
    ])
  );
  const anyI18n = fields.some(isI18n);
  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));

  return (
    <EditDrawer
      fig={fig}
      title={section}
      onClose={requestClose}
      footer={
        <>
          <span className="bp-drawer-status">
            {status.error
              ? <span className="bp-error">{status.error}</span>
              : changed.length
                ? `${changed.length} cambio${changed.length === 1 ? '' : 's'} sin guardar`
                : 'Sin cambios'}
          </span>
          <button type="button" className="bp-btn bp-btn-ghost" onClick={requestClose}>Cancelar</button>
          <button type="button" className="bp-btn bp-btn-primary" disabled={status.saving || !original} onClick={save}>
            {status.saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      {!original ? (
        <p className="bp-muted">Cargando…</p>
      ) : (
        <>
          {anyI18n && <LangTabs lang={lang} onChange={setLang} filled={filled} />}
          {fields.map((f) => {
            const k = isI18n(f) ? `${keyOf(f)}_${lang}` : keyOf(f);
            const Input = f.multiline ? 'textarea' : 'input';
            return (
              <label key={keyOf(f)} className="bp-field">
                <span className="bp-field-label">
                  {f.label}
                  {isI18n(f) && <em>{lang.toUpperCase()}</em>}
                </span>
                <Input
                  value={values[k] ?? ''}
                  placeholder={f.placeholder || (isI18n(f) ? 'Vacío — se usa el texto por defecto' : '')}
                  onChange={(e) => set(k, e.target.value)}
                  {...(f.multiline ? { rows: 4 } : { type: f.type || 'text' })}
                />
                {f.hint && <span className="bp-field-hint">{f.hint}</span>}
              </label>
            );
          })}
        </>
      )}
    </EditDrawer>
  );
}

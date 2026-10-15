import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './admin.css';

/**
 * Panel lateral (estilo plano técnico) donde se editan las secciones del
 * sitio en vivo. Lo comparten todos los lápices para que editar se sienta
 * igual en cualquier parte: misma posición, mismos botones, Esc cierra.
 */
export default function EditDrawer({ fig, title, onClose, footer, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="bp-drawer-backdrop" onClick={onClose}>
      <aside
        className={`bp-drawer ${wide ? 'is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bp-drawer-head">
          <div className="bp-cota">
            <span>{fig}</span>
            <span className="bp-badge">EDITAR</span>
          </div>
          <div className="bp-drawer-title-row">
            <h2 className="bp-drawer-title">{title}</h2>
            <button type="button" className="bp-drawer-close" onClick={onClose} aria-label="Cerrar">×</button>
          </div>
        </header>
        <div className="bp-drawer-body">{children}</div>
        {footer && <footer className="bp-drawer-foot">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}

export const LANGS = [
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ja', label: 'JA', name: '日本語' },
];

/** Pestañas de idioma compartidas por los editores. */
export function LangTabs({ lang, onChange, filled = {} }) {
  return (
    <div className="bp-lang-tabs" role="tablist">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          role="tab"
          aria-selected={lang === l.code}
          className={`bp-lang-tab ${lang === l.code ? 'active' : ''}`}
          onClick={() => onChange(l.code)}
          title={l.name}
        >
          {l.label}
          {filled[l.code] === false && <span className="bp-lang-missing" aria-label="vacío">●</span>}
        </button>
      ))}
    </div>
  );
}

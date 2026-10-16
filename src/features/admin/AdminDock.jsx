import { useState, useEffect, useRef } from 'react';
import { useIsOwner } from './useAdminAuth.js';
import { useAdminUI } from './AdminUIContext.jsx';
import { ADMIN_GROUPS, ADMIN_TOOLS } from './adminTools.js';
import './admin.css';

export default function AdminDock() {
  // Solo tu cuenta (role: owner) ve este control. Un futuro empleado
  // (role: staff/cashier) sigue entrando a /admin normalmente, pero no ve
  // este dock flotando sobre el sitio en vivo.
  const isOwner = useIsOwner();
  const { openTool, editMode, setEditMode } = useAdminUI();
  const [expanded, setExpanded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!expanded) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setExpanded(false); };
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  if (!isOwner) return null;

  return (
    <div className="admin-dock" ref={ref}>
      {expanded && (
        <div className="admin-dock-menu" role="menu">
          <div className="bp-cota">
            <span>PANEL ACEROPRESS</span>
            <span className="bp-badge">OWNER</span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={editMode}
            className={`admin-dock-switch ${editMode ? 'is-on' : ''}`}
            onClick={() => setEditMode(!editMode)}
          >
            <span className="admin-dock-switch-text">
              <strong>Modo edición</strong>
              <small>{editMode ? 'Lápices visibles en el sitio' : 'Ves el sitio como un cliente'}</small>
            </span>
            <span className="admin-dock-switch-track" aria-hidden="true"><span /></span>
          </button>

          <div className="admin-dock-sep" />
          {ADMIN_GROUPS.map((g) => (
            <div key={g.id} className="admin-dock-group">
              <span className="admin-dock-group-label">{g.label}</span>
              {ADMIN_TOOLS.filter((t) => t.group === g.id).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  className="admin-dock-item"
                  onClick={() => { openTool(t.id); setExpanded(false); }}
                >
                  <span className="admin-dock-num">{String(ADMIN_TOOLS.indexOf(t) + 1).padStart(2, '0')}</span>
                  {t.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className={`admin-dock-toggle ${expanded ? 'is-open' : ''} ${editMode ? 'is-editing' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        aria-label="Panel de administración"
        aria-expanded={expanded}
      >
        {expanded ? '×' : '⚙'}
      </button>
    </div>
  );
}

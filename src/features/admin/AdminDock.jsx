import { useState } from 'react';
import { useAdminAuth } from './useAdminAuth.js';
import { useAdminUI } from './AdminUIContext.jsx';
import { ADMIN_TOOLS } from './adminTools.js';
import './admin.css';

export default function AdminDock() {
  const { isAdmin, adminInfo } = useAdminAuth();
  const { openTool } = useAdminUI();
  const [expanded, setExpanded] = useState(false);

  // Solo tu cuenta (role: owner) ve este control. Un futuro empleado
  // (role: staff/cashier) sigue entrando a /admin normalmente, pero no ve
  // este dock flotando sobre el sitio en vivo.
  if (!isAdmin || adminInfo?.role !== 'owner') return null;

  return (
    <div className="admin-dock">
      {expanded && (
        <div className="admin-dock-menu">
          <div className="admin-dock-menu-title">Panel AceroPress</div>
          {ADMIN_TOOLS.map((t) => (
            <button
              key={t.id}
              className="admin-dock-item"
              onClick={() => { openTool(t.id); setExpanded(false); }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <button
        className="admin-dock-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-label="Panel de administración"
      >
        ⚙
      </button>
    </div>
  );
}

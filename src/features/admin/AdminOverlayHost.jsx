import { useState } from 'react';
import { useAdminUI } from './AdminUIContext.jsx';
import { ADMIN_TOOLS } from './adminTools.js';
import './admin.css';

export default function AdminOverlayHost() {
  const { activeTool, openTool, close, isOpen } = useAdminUI();
  const [collapsedNav, setCollapsedNav] = useState(false);

  if (!isOpen) return null;

  const ActiveComponent = ADMIN_TOOLS.find((t) => t.id === activeTool)?.Component ?? ADMIN_TOOLS[0].Component;

  return (
    <div className="admin-overlay-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="admin-overlay-shell admin-shell">
        <aside className={`admin-sidebar ${collapsedNav ? 'is-collapsed' : ''}`}>
          <div className="admin-sidebar-logo">ACERO<span>PRESS</span></div>
          <nav className="admin-nav">
            {ADMIN_TOOLS.map((t) => (
              <button
                key={t.id}
                className={`admin-nav-btn ${activeTool === t.id ? 'active' : ''}`}
                onClick={() => openTool(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-foot">
            <button className="admin-btn-ghost admin-btn-sm" onClick={close}>
              ← Volver al sitio
            </button>
          </div>
        </aside>
        <main className="admin-main">
          <button className="admin-overlay-close" onClick={close} aria-label="Cerrar">×</button>
          <button className="admin-overlay-navtoggle" onClick={() => setCollapsedNav((v) => !v)} aria-label="Menú">☰</button>
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}

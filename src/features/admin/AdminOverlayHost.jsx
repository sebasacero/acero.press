import { useEffect } from 'react';
import { useAdminUI } from './AdminUIContext.jsx';
import { ADMIN_TOOLS } from './adminTools.js';
import './admin.css';

export default function AdminOverlayHost() {
  const { activeTool, openTool, close, isOpen } = useAdminUI();

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const ActiveComponent = ADMIN_TOOLS.find((t) => t.id === activeTool)?.Component ?? ADMIN_TOOLS[0].Component;

  return (
    <div className="admin-overlay-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="admin-overlay-shell admin-shell">
        <aside className="admin-sidebar">
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
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}

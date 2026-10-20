import { useEffect } from 'react';
import { useAdminUI } from './AdminUIContext.jsx';
import AdminShell from './AdminShell.jsx';
import { canLeave } from './leaveGuard.js';
import './admin.css';

export default function AdminOverlayHost() {
  const { activeTool, openTool, close, isOpen } = useAdminUI();

  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="admin-overlay-backdrop" onClick={(e) => { if (e.target === e.currentTarget && canLeave()) close(); }}>
      <div className="admin-overlay-shell">
        <AdminShell activeTool={activeTool} onSelect={openTool} onExit={close} overlay />
      </div>
    </div>
  );
}

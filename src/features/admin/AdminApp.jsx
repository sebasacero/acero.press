import { useState } from 'react';
import { useAdminAuth } from './useAdminAuth.js';
import AdminLogin from './AdminLogin.jsx';
import { ADMIN_TOOLS } from './adminTools.js';
import './admin.css';

export default function AdminApp() {
  const { session, isAdmin, adminInfo, loading, signOut } = useAdminAuth();
  const [tab, setTab] = useState('dashboard');

  if (loading) {
    return <div className="admin-loading-screen">Cargando…</div>;
  }

  if (!session) {
    return <AdminLogin />;
  }

  if (!isAdmin) {
    return (
      <div className="admin-loading-screen">
        <p>Tu cuenta ({session.user.email}) no tiene acceso al panel de AceroPress.</p>
        <button className="admin-btn-ghost" onClick={signOut}>Cerrar sesión</button>
      </div>
    );
  }

  const ActiveComponent = ADMIN_TOOLS.find((t) => t.id === tab)?.Component ?? ADMIN_TOOLS[0].Component;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">ACERO<span>PRESS</span></div>
        <nav className="admin-nav">
          {ADMIN_TOOLS.map((t) => (
            <button
              key={t.id}
              className={`admin-nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <span>{adminInfo?.full_name || session.user.email}</span>
          <button className="admin-btn-ghost admin-btn-sm" onClick={signOut}>
            Salir
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <ActiveComponent />
      </main>
    </div>
  );
}

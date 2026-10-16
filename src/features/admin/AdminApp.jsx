import { useState } from 'react';
import { useAdminAuth } from './useAdminAuth.js';
import AdminLogin from './AdminLogin.jsx';
import AdminShell, { readLastTool } from './AdminShell.jsx';
import './admin.css';

export default function AdminApp() {
  const { session, isAdmin, adminInfo, loading, signOut } = useAdminAuth();
  const [tab, setTab] = useState(() => readLastTool());

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

  return (
    <AdminShell
      activeTool={tab}
      onSelect={setTab}
      onExit={signOut}
      exitLabel="Cerrar sesión"
      userLabel={adminInfo?.full_name || session.user.email}
    />
  );
}

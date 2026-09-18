import { useState } from 'react';
import { useAdminAuth } from './useAdminAuth.js';
import AdminLogin from './AdminLogin.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SectionsPage from './pages/SectionsPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import TablesPage from './pages/TablesPage.jsx';
import './admin.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', Component: DashboardPage },
  { id: 'orders', label: 'Pedidos', Component: OrdersPage },
  { id: 'tables', label: 'Mesas / POS', Component: TablesPage },
  { id: 'inventory', label: 'Inventario', Component: InventoryPage },
  { id: 'catalog', label: 'Catálogo', Component: CatalogPage },
  { id: 'settings', label: 'Configuración', Component: SettingsPage },
  { id: 'sections', label: 'Secciones', Component: SectionsPage },
];

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

  const ActiveComponent = TABS.find((t) => t.id === tab)?.Component ?? DashboardPage;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">ACERO<span>PRESS</span></div>
        <nav className="admin-nav">
          {TABS.map((t) => (
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

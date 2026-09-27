import DashboardPage from './pages/DashboardPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SectionsPage from './pages/SectionsPage.jsx';
import EspresalePage from './pages/EspresalePage.jsx';
import PublicationsPage from './pages/PublicationsPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import TablesPage from './pages/TablesPage.jsx';

export const ADMIN_TOOLS = [
  { id: 'dashboard', label: 'Dashboard', Component: DashboardPage },
  { id: 'orders', label: 'Pedidos', Component: OrdersPage },
  { id: 'tables', label: 'Mesas / POS', Component: TablesPage },
  { id: 'inventory', label: 'Inventario', Component: InventoryPage },
  { id: 'catalog', label: 'Catálogo', Component: CatalogPage },
  { id: 'settings', label: 'Configuración', Component: SettingsPage },
  { id: 'sections', label: 'Secciones', Component: SectionsPage },
  { id: 'espresale', label: 'Espresale', Component: EspresalePage },
  { id: 'publications', label: 'Publicaciones', Component: PublicationsPage },
];

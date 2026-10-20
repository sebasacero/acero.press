import DashboardPage from './pages/DashboardPage.jsx';
import AlgorithmPage from './pages/AlgorithmPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SectionsPage from './pages/SectionsPage.jsx';
import EspresalePage from './pages/EspresalePage.jsx';
import PublicationsPage from './pages/PublicationsPage.jsx';
import InstagramPage from './pages/InstagramPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import TablesPage from './pages/TablesPage.jsx';
import RecipesPage from './pages/RecipesPage.jsx';
import AppWaitlistPage from './pages/AppWaitlistPage.jsx';

// Grupos por flujo de trabajo: primero lo que se usa en el día a día.
export const ADMIN_GROUPS = [
  { id: 'ops', label: 'Operación', hint: 'Vender y atender' },
  { id: 'biz', label: 'Negocio', hint: 'Medir y abastecer' },
  { id: 'brand', label: 'Marca', hint: 'Sitio y redes' },
  { id: 'sys', label: 'Sistema', hint: 'Ajustes' },
];

// id: estable (lo usan otros componentes, p. ej. openTool('espresale')).
// signal: contador en vivo que se muestra en la navegación (useAdminSignals).
export const ADMIN_TOOLS = [
  // bleed: ocupa todo el contenido, sin márgenes ni scroll (cámara y editor)
  { id: 'espresale', label: 'Micra', group: 'ops', desc: 'Cámara de venta y tarjetas para redes', bleed: true, Component: EspresalePage },
  { id: 'orders', label: 'Pedidos', group: 'ops', desc: 'Confirmar y completar pedidos', signal: 'pending', Component: OrdersPage },
  { id: 'tables', label: 'Mesas / POS', group: 'ops', desc: 'Cuentas abiertas por mesa', signal: 'occupied', Component: TablesPage },
  { id: 'waitlist', label: 'Lista de espera', group: 'ops', desc: 'Quienes se apuntaron a la app Micra', Component: AppWaitlistPage },
  { id: 'dashboard', label: 'Agente', group: 'biz', desc: 'Dashboard e índice de crecimiento', Component: DashboardPage },
  { id: 'algorithm', label: 'Algoritmo', group: 'biz', desc: 'Plan Micra: qué hacer hoy y red de tinteros', Component: AlgorithmPage },
  { id: 'inventory', label: 'Inventario', group: 'biz', desc: 'Stock y movimientos', signal: 'lowStock', Component: InventoryPage },
  { id: 'catalog', label: 'Catálogo', group: 'biz', desc: 'Productos, marcas y precios', Component: CatalogPage },
  { id: 'publications', label: 'Publicaciones', group: 'brand', desc: 'Contenido listo para redes', Component: PublicationsPage },
  { id: 'instagram', label: 'Instagram', group: 'brand', desc: 'Conexión, token y métricas', Component: InstagramPage },
  { id: 'recipes', label: 'Recetas', group: 'brand', desc: 'Café y kit de cada receta campeona', Component: RecipesPage },
  { id: 'sections', label: 'Secciones', group: 'brand', desc: 'Contenido del sitio', Component: SectionsPage },
  { id: 'settings', label: 'Configuración', group: 'sys', desc: 'WhatsApp, redes, metas', Component: SettingsPage },
];

export const toolById = (id) => ADMIN_TOOLS.find((t) => t.id === id) ?? ADMIN_TOOLS[0];

import { lazy, Suspense, useEffect, useState } from 'react';
import { CartProvider } from './features/cart/context/CartContext.jsx';
import { AuthProvider } from './features/account/AuthContext.jsx';
import { LanguageProvider } from './features/i18n/LanguageContext.jsx';
import { AdminUIProvider } from './features/admin/AdminUIContext.jsx';
import AdminDock from './features/admin/AdminDock.jsx';
import AdminOverlayHost from './features/admin/AdminOverlayHost.jsx';
import ActiveFloatWidget from './features/admin/ActiveFloatWidget.jsx';
import NavDrawer from './shared/layout/NavDrawer.jsx';
import Footer from './shared/layout/Footer.jsx';
import CartDrawer from './features/cart/components/CartDrawer.jsx';
import CheckoutModal from './features/payment/CheckoutModal.jsx';
import AccountDrawer from './features/account/AccountDrawer.jsx';
import ProductSection from './features/product/components/ProductSection.jsx';
import RecipeArchive from './features/recipes/components/RecipeArchive.jsx';
import SalesFloatButton from './features/sales/SalesFloatButton.jsx';
import { useIsOwner } from './features/admin/useAdminAuth.js';
import LocalHero from './features/home/sections/LocalHero.jsx';
import MicraSection from './features/home/sections/MicraSection.jsx';
import PostsSection from './features/home/sections/PostsSection.jsx';
import BrewGuide from './features/home/sections/BrewGuide.jsx';
import { useHashLanding } from './shared/layout/useHashLanding.js';
import ConsentBanner from './shared/layout/ConsentBanner.jsx';
import { trackWhatsAppClicks } from './shared/lib/analytics.js';
// La Escuela tiene su página (/escuela): se manda por WhatsApp y se aprende sin la portada
// alrededor. En la portada queda la receta oficial en cinco pasos (BrewGuide), que lleva a ella.
const SchoolPage = lazy(() => import('./features/school/SchoolPage.jsx'));
// La meta de ventas es del equipo: en público era un «0 %» flotando sobre la tienda
function OwnerOnly({ children }) {
  return useIsOwner() ? children : null;
}

const isSchoolRoute = () => /^\/escuela\/?$/.test(window.location.pathname);

export default function App() {
  const [navOpen, setNavOpen] = useState(false);
  const school = isSchoolRoute();
  // /#beans desde otra página: la Escuela lleva sus #leccion-N por su cuenta
  useHashLanding(!school);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
  }, [navOpen]);
  // Cada toque a un enlace de WhatsApp (pedido, cold brew, Escuela, botón flotante) cuenta como contacto
  useEffect(() => trackWhatsAppClicks(), []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <AdminUIProvider>
            {school ? (
              <Suspense fallback={<div style={{ minHeight: '100svh', background: 'var(--paper)' }} />}>
                <SchoolPage navOpen={navOpen} onOpenNavDrawer={() => setNavOpen(true)} />
              </Suspense>
            ) : (
              <>
                {/* La marca: la barra de Chapinero con las recetas de la casa en la vitrina */}
                <LocalHero navOpen={navOpen} onOpenNavDrawer={() => setNavOpen(true)} />

                <MicraSection />

                <ProductSection />

                <PostsSection />

                <BrewGuide />

                <RecipeArchive />
              </>
            )}

            <NavDrawer isOpen={navOpen} onClose={() => setNavOpen(false)} />

            <Footer />

            <CartDrawer />
            <CheckoutModal />
            <AccountDrawer />
            <OwnerOnly><SalesFloatButton /></OwnerOnly>
            <ActiveFloatWidget />

            <AdminDock />
            <AdminOverlayHost />
            <ConsentBanner />
          </AdminUIProvider>
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

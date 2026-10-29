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
import LocalHero from './features/home/sections/LocalHero.jsx';
import EsspresaleHero from './features/esspresale/EsspresaleHero.jsx';
import MicraSection from './features/home/sections/MicraSection.jsx';
import BrewGuide from './features/home/sections/BrewGuide.jsx';
import { useHashLanding } from './shared/layout/useHashLanding.js';
import ConsentBanner from './shared/layout/ConsentBanner.jsx';
import { trackWhatsAppClicks } from './shared/lib/analytics.js';
// La Escuela tiene su página (/escuela): se manda por WhatsApp y se aprende sin la portada
// alrededor. En la portada queda la receta oficial en cinco pasos (BrewGuide), que lleva a ella.
const SchoolPage = lazy(() => import('./features/school/SchoolPage.jsx'));

const isSchoolRoute = () => /^\/escuela\/?$/.test(window.location.pathname);
// Privacidad (/privacidad): la enlaza el permiso de ubicación de Micra
const PrivacyPage = lazy(() => import('./features/legal/PrivacyPage.jsx'));
const isPrivacyRoute = () => /^\/privacidad\/?$/.test(window.location.pathname);

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
            {isPrivacyRoute() ? (
              <Suspense fallback={null}><PrivacyPage /></Suspense>
            ) : school ? (
              <Suspense fallback={<div style={{ minHeight: '100svh', background: 'var(--paper)' }} />}>
                <SchoolPage navOpen={navOpen} onOpenNavDrawer={() => setNavOpen(true)} />
              </Suspense>
            ) : (
              <>
                {/* Primero la app (con el menú), luego la tienda y la barra de Chapinero con las
                    recetas en la vitrina; al final la Escuela, los campeones; las redes van arriba, en Micra, y Visítanos junto a la foto */}
                {/* Los dos banners principales de la web en línea (pedir café, ser barista); llevan el menú y el h1 */}
                <EsspresaleHero navOpen={navOpen} onOpenNavDrawer={() => setNavOpen(true)} />
                <MicraSection />

                <ProductSection />

                <LocalHero />

                <BrewGuide />

                <RecipeArchive />
              </>
            )}

            <NavDrawer isOpen={navOpen} onClose={() => setNavOpen(false)} />

            <Footer />

            <CartDrawer />
            <CheckoutModal />
            <AccountDrawer />
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

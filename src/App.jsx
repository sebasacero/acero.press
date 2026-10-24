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
import Marquee from './features/home/sections/Marquee.jsx';
import SalesFloatButton from './features/sales/SalesFloatButton.jsx';
import ColdBrewHero from './features/home/sections/ColdBrewHero.jsx';
import WacBanner from './features/home/sections/WacBanner.jsx';
import PressStory from './features/home/sections/PressStory.jsx';
import EsspresaleHero from './features/esspresale/EsspresaleHero.jsx';
import { useHashLanding } from './shared/layout/useHashLanding.js';
import ConsentBanner from './shared/layout/ConsentBanner.jsx';
import { trackWhatsAppClicks } from './shared/lib/analytics.js';
// La Escuela tiene su página (/escuela): se manda por WhatsApp y se aprende sin la portada
// alrededor. En la portada queda una franja que lleva a ella. Las dos van en archivos aparte.
const SchoolPage = lazy(() => import('./features/school/SchoolPage.jsx'));
const SchoolTeaser = lazy(() => import('./features/school/SchoolTeaser.jsx'));
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
                <EsspresaleHero navOpen={navOpen} onOpenNavDrawer={() => setNavOpen(true)} />

                <ProductSection />

                <Marquee channel="market" />

                <ColdBrewHero />

                <Marquee channel="city" />

                <WacBanner />

                <RecipeArchive />

                <PressStory />

                <Suspense fallback={null}>
                  <SchoolTeaser />
                </Suspense>

                <Marquee />
              </>
            )}

            <NavDrawer isOpen={navOpen} onClose={() => setNavOpen(false)} />

            <Footer />

            <CartDrawer />
            <CheckoutModal />
            <AccountDrawer />
            <SalesFloatButton />
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

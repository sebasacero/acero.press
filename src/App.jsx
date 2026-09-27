import { useEffect, useState } from 'react';
import { CartProvider } from './features/cart/context/CartContext.jsx';
import { AuthProvider } from './features/account/AuthContext.jsx';
import { LanguageProvider } from './features/i18n/LanguageContext.jsx';
import { AdminUIProvider } from './features/admin/AdminUIContext.jsx';
import AdminDock from './features/admin/AdminDock.jsx';
import AdminOverlayHost from './features/admin/AdminOverlayHost.jsx';
import ActiveFloatWidget from './features/admin/ActiveFloatWidget.jsx';
import Navbar from './shared/layout/Navbar.jsx';
import NavDrawer from './shared/layout/NavDrawer.jsx';
import Footer from './shared/layout/Footer.jsx';
import CartDrawer from './features/cart/components/CartDrawer.jsx';
import CheckoutModal from './features/payment/CheckoutModal.jsx';
import AccountDrawer from './features/account/AccountDrawer.jsx';
import ProductSection from './features/product/components/ProductSection.jsx';
import RecipeArchive from './features/recipes/components/RecipeArchive.jsx';
import CafeHero from './features/home/sections/CafeHero.jsx';
import Marquee from './features/home/sections/Marquee.jsx';
import SalesFloatButton from './features/sales/SalesFloatButton.jsx';
import ColdBrewHero from './features/home/sections/ColdBrewHero.jsx';
import WacBanner from './features/home/sections/WacBanner.jsx';

export default function App() {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
  }, [navOpen]);

  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <AdminUIProvider>
            <header className="hero-container">
              <Navbar navOpen={navOpen} onOpenNavDrawer={() => setNavOpen(true)} />
              <CafeHero />
            </header>

            <NavDrawer isOpen={navOpen} onClose={() => setNavOpen(false)} />

            <ProductSection />

            <Marquee />

            <ColdBrewHero />

            <Marquee />

            <WacBanner />

            <RecipeArchive />

            <Marquee />

            <Footer />

            <CartDrawer />
            <CheckoutModal />
            <AccountDrawer />
            <SalesFloatButton />
            <ActiveFloatWidget />

            <AdminDock />
            <AdminOverlayHost />
          </AdminUIProvider>
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

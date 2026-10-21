import { useEffect, useState } from 'react';
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
            <EsspresaleHero navOpen={navOpen} onOpenNavDrawer={() => setNavOpen(true)} />

            <NavDrawer isOpen={navOpen} onClose={() => setNavOpen(false)} />

            <ProductSection />

            <Marquee channel="market" />

            <ColdBrewHero />

            <Marquee channel="city" />

            <WacBanner />

            <RecipeArchive />

            <PressStory />

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

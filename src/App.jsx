import { lazy, Suspense, useEffect, useState } from 'react';
import { CartProvider } from './features/cart/context/CartContext.jsx';
import { AuthProvider } from './features/account/AuthContext.jsx';
import { LanguageProvider, useLanguage } from './features/i18n/LanguageContext.jsx';
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
import Doors from './features/home/sections/Doors.jsx';
import DaySection, { DayPage } from './features/home/sections/DaySection.jsx';
import SocialBanners from './features/home/sections/SocialBanners.jsx';
import DayBanner from './features/home/sections/DayBanner.jsx';
import MicraSection from './features/home/sections/MicraSection.jsx';
import LearnCard from './features/home/sections/LearnCard.jsx';
import { useHashLanding } from './shared/layout/useHashLanding.js';
import ConsentBanner from './shared/layout/ConsentBanner.jsx';
import { trackWhatsAppClicks } from './shared/lib/analytics.js';
// La piel de la app Micra sobre toda la web: va después de las hojas de cada sección
import './shared/styles/estilo-app.css';
import './shared/styles/termico-web.css';
// La página que sigue el día: va de última, encima de las pieles anteriores
import './features/home/sections/pagina-dia.css';
import './shared/styles/menu-vidrio.css';
// La Escuela tiene su página (/escuela): se manda por WhatsApp y se aprende sin la portada
// alrededor. En la portada queda la receta oficial en cinco pasos (BrewGuide), que lleva a ella.
const SchoolPage = lazy(() => import('./features/school/SchoolPage.jsx'));

const isSchoolRoute = () => /^\/escuela\/?$/.test(window.location.pathname);
// Privacidad (/privacidad): la enlaza el permiso de ubicación de Micra
const PrivacyPage = lazy(() => import('./features/legal/PrivacyPage.jsx'));
const isPrivacyRoute = () => /^\/privacidad\/?$/.test(window.location.pathname);

// La portada: el banner de 24 horas y, debajo, la página que sigue ese mismo día: cada sección es
// unas horas más tarde y lleva su cielo (DaySection). Papel = ACERO.press, térmico = Micra.
function Home({ navOpen, onOpenNavDrawer }) {
  const { t } = useLanguage();
  const n = t('page.names');
  return (
    <DayPage>
      {/* El banner principal: 24 horas con un barista, a la hora de Bogotá; lleva el menú y el h1 */}
      <DayBanner navOpen={navOpen} onOpenNavDrawer={onOpenNavDrawer} />
      {/* Los dos banners de siempre (pedir café, ser barista), como dos puertas a la vez */}
      <DaySection off={1} next={3} name={n[0]}><Doors /></DaySection>
      <DaySection off={3} next={6} name={n[1]}><MicraSection /></DaySection>
      <DaySection off={6} next={9} name={n[2]}><ProductSection /></DaySection>
      <DaySection off={9} next={12} name={n[3]}><LearnCard /></DaySection>
      <DaySection off={12} next={15} name={n[4]}><LocalHero /></DaySection>
      <DaySection off={15} next={18} name={n[5]}><RecipeArchive /></DaySection>
      {/* Las fichas de redes bajan al final, junto al pie */}
      <DaySection off={18} next={21} name={n[6]}>
        <section className="pg-social" aria-labelledby="pg-social-title">
          <div className="pg-w">
            <p className="pg-hand">{t('page.social.hand')}</p>
            <h2 id="pg-social-title">{t('page.social.title')}</h2>
            <SocialBanners />
          </div>
        </section>
      </DaySection>
    </DayPage>
  );
}

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
                <Home navOpen={navOpen} onOpenNavDrawer={() => setNavOpen(true)} />
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

import { useCart } from '../../features/cart/context/CartContext.jsx';
import { useLanguage } from '../../features/i18n/LanguageContext.jsx';
import LanguageSwitcher from '../../features/i18n/LanguageSwitcher.jsx';

export default function Navbar({ onOpenNavDrawer, navOpen }) {
  const { open, totalQty } = useCart();
  const { t } = useLanguage();

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="nav-links left">
          <a href="#home">{t('nav.home')}</a>
          <a href="#beans">{t('nav.beans')}</a>
          <a href="#championship">{t('nav.championship')}</a>
          <a href="#contact">{t('nav.contact')}</a>
        </div>

        <button
          id="nav-hamburger"
          className="hamburger-btn"
          aria-label="Abrir menú"
          aria-expanded={navOpen}
          onClick={onOpenNavDrawer}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div className="nav-logo" id="home">
          <img src="/image/logo_aceropress.png" alt="ACEROPRESS Logo" className="logo-img" />
        </div>

        <div className="nav-icons right">
          <LanguageSwitcher variant="light" />
          <a href="#account" className="icon-link" aria-label="Cuenta de usuario">
            <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </a>
          <a
            href="#cart"
            className="icon-link"
            aria-label="Carrito de compras"
            onClick={(e) => {
              e.preventDefault();
              open();
            }}
          >
            <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            {totalQty > 0 && <span className="cart-count-badge" style={{ display: 'flex' }}>{totalQty}</span>}
          </a>
        </div>
      </div>
    </nav>
  );
}

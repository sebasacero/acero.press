import { useCart } from '../../features/cart/context/CartContext.jsx';
import { useAuth } from '../../features/account/AuthContext.jsx';
import { useLanguage } from '../../features/i18n/LanguageContext.jsx';
import LanguageSwitcher from '../../features/i18n/LanguageSwitcher.jsx';

// variant 'sheet': va dentro del banner de la app Micra (hoja de plano), con el
// logo ACERO + .press a la izquierda; tone 'paper' (tinta) o 'photo' (crema).
export default function Navbar({ onOpenNavDrawer, navOpen, variant = 'overlay', tone = 'photo' }) {
  const { open, totalQty } = useCart();
  const { open: openAccount, isLoggedIn, customer } = useAuth();
  const { t } = useLanguage();

  return (
    <nav className={variant === 'sheet' ? `navbar navbar--sheet navbar--${tone}` : 'navbar'}>
      <div className="navbar-content">
        <div className="nav-links left">
          <a href="#home">{t('nav.home')}</a>
          <a href="#beans">{t('nav.beans')}</a>
          <a href="#championship">{t('nav.championship')}</a>
          <a href="#contact">{t('nav.contact')}</a>
          <a href="#home" className="nav-app-link">{t('nav.app')}</a>
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
          {variant === 'sheet' ? (
            <a href="#home" className="navbar-sheet-logo" aria-label="ACERO.press">
              <img src="/image/logo.png" alt="" />
              <span className="logo-press">.press</span>
            </a>
          ) : (
            <img src="/image/logo_aceropress.png" alt="ACEROPRESS Logo" className="logo-img" />
          )}
        </div>

        <div className="nav-icons right">
          <LanguageSwitcher variant={variant === 'sheet' && tone === 'paper' ? 'ink' : 'light'} />
          <a
            href="#account"
            className="icon-link"
            aria-label="Cuenta de usuario"
            onClick={(e) => {
              e.preventDefault();
              openAccount();
            }}
          >
            {isLoggedIn && customer?.avatar_url ? (
              <img src={customer.avatar_url} alt="" className="nav-account-avatar" />
            ) : (
              <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            )}
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

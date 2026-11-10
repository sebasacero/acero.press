import { useEffect, useRef } from 'react';
import { useLanguage } from '../../features/i18n/LanguageContext.jsx';
import LanguageSwitcher from '../../features/i18n/LanguageSwitcher.jsx';
import { useAuth } from '../../features/account/AuthContext.jsx';
import { homeLink, navItems } from './navLinks.js';

export default function NavDrawer({ isOpen, onClose }) {
  const { t } = useLanguage();
  const { open: openAccount, isLoggedIn, customer } = useAuth();
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Cerrado no recibe el foco del teclado (está fuera de la pantalla, no oculto); abierto,
  // el foco entra al primer enlace, Esc lo cierra y al cerrar vuelve a donde estaba.
  useEffect(() => {
    if (ref.current) ref.current.inert = !isOpen;
    if (!isOpen) return undefined;
    const before = document.activeElement;
    ref.current?.querySelector('.nav-drawer-links a')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (before && typeof before.focus === 'function' && document.contains(before)) before.focus();
    };
  }, [isOpen]);

  return (
    <>
      <div className={`nav-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside ref={ref} className={`nav-drawer ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen} aria-label={t('nav.menu')}>
        <div className="nav-drawer-header">
          <a href={homeLink('#home')} className="navbar-sheet-logo" aria-label="ACERO.press" onClick={onClose}>
            <img src="/image/logo.png" alt="" />
            <span className="logo-press">.press</span>
          </a>
          <button className="cart-close-btn" aria-label="Cerrar menú" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <nav className="nav-drawer-links">
          {navItems().map((it) => (
            <a key={it.key} href={it.href} className={it.className} onClick={onClose} aria-current={it.current ? 'page' : undefined}>{t(`nav.${it.key}`)}</a>
          ))}
        </nav>

        {/* Lo que arriba ya no cabe: la cuenta y el idioma. Las redes están en su sección y en el pie. */}
        <div className="nav-drawer-footer">
          <button type="button" className="nav-drawer-account" onClick={() => { onClose(); openAccount(); }}>
            {isLoggedIn && customer?.avatar_url ? (
              <img src={customer.avatar_url} alt="" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            )}
            {t('account.title')}
          </button>
          <LanguageSwitcher variant="dark" />
        </div>
      </aside>
    </>
  );
}

import { useCart } from '../context/CartContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function CartDrawer() {
  const { cart, isOpen, close, updateQty, removeItem, checkout, subtotal, money } = useCart();
  const { t } = useLanguage();

  return (
    <>
      <div className={`cart-overlay ${isOpen ? 'open' : ''}`} onClick={close} />
      <aside className={`cart-drawer ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <div className="cart-drawer-header">
          <h2>{t('cart.title')}</h2>
          <button className="cart-close-btn" aria-label="Cerrar carrito" onClick={close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <p className="cart-empty">{t('cart.empty')}</p>
          ) : (
            cart.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="cart-item-thumb">
                  <img src={item.image} alt={item.name} />
                </div>
                <div className="cart-item-body">
                  <div className="cart-item-top">
                    <div>
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-variant">{item.variant}</div>
                    </div>
                    <button className="cart-item-remove" onClick={() => removeItem(item.id)}>
                      {t('cart.remove')}
                    </button>
                  </div>
                  <div className="cart-item-bottom">
                    <div className="cart-item-qty">
                      <button onClick={() => updateQty(item.id, -1)}>−</button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)}>+</button>
                    </div>
                    <div className="cart-item-price">{money(item.price * item.qty)}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-drawer-footer">
          <p className="cart-subtotal-note">{t('cart.subtotalNote')}</p>
          <div className="cart-subtotal-row">
            <span>{t('cart.subtotal')}</span>
            <span>{money(subtotal)}</span>
          </div>
          <button className="btn-checkout" onClick={checkout}>{t('cart.checkout')}</button>
          <button className="btn-continue" onClick={close}>{t('cart.continue')}</button>
        </div>
      </aside>
    </>
  );
}

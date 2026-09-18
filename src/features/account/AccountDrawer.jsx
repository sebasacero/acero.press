import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { fetchMyOrders } from '../../shared/lib/orders.js';

const STATUS_LABEL = {
  pending: { es: 'Pendiente', en: 'Pending', ja: '保留中' },
  confirmed: { es: 'Confirmado', en: 'Confirmed', ja: '確認済み' },
  completed: { es: 'Entregado', en: 'Completed', ja: '完了' },
  cancelled: { es: 'Cancelado', en: 'Cancelled', ja: 'キャンセル' },
};

export default function AccountDrawer() {
  const {
    isOpen,
    close,
    isLoggedIn,
    loading,
    customer,
    session,
    signInWithGoogle,
    signOut,
    toggleOffersSubscription,
    toggleMonthlySubscription,
  } = useAuth();
  const { t, lang } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (isOpen && isLoggedIn) {
      setOrdersLoading(true);
      fetchMyOrders(5).then((data) => {
        setOrders(data);
        setOrdersLoading(false);
      });
    }
  }, [isOpen, isLoggedIn]);

  return (
    <>
      <div className={`cart-overlay ${isOpen ? 'open' : ''}`} onClick={close} />
      <aside className={`cart-drawer account-drawer ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <div className="cart-drawer-header">
          <h2>{t('account.title')}</h2>
          <button className="cart-close-btn" aria-label="Cerrar" onClick={close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="account-drawer-body">
          {loading ? (
            <p className="account-loading">{t('account.loading')}</p>
          ) : !isLoggedIn ? (
            <div className="account-login-panel">
              <p className="account-blurb">{t('account.loginBlurb')}</p>
              <button className="btn-google" onClick={signInWithGoogle}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14.1-5l-6.5-5.5C29.6 35.1 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.5 5.5C41.4 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"/>
                </svg>
                {t('account.signInGoogle')}
              </button>
              <p className="account-fineprint">{t('account.offersHint')}</p>
            </div>
          ) : (
            <div className="account-profile-panel">
              <div className="account-profile-head">
                {customer?.avatar_url ? (
                  <img src={customer.avatar_url} alt="" className="account-avatar" />
                ) : (
                  <div className="account-avatar account-avatar-fallback">
                    {(customer?.full_name || session.user.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="account-name">{customer?.full_name || t('account.noName')}</div>
                  <div className="account-email">{customer?.email || session.user.email}</div>
                </div>
              </div>

              <label className="account-offers-toggle">
                <input
                  type="checkbox"
                  checked={!!customer?.subscribed_offers}
                  onChange={(e) => toggleOffersSubscription(e.target.checked)}
                />
                <span>{t('account.subscribeOffers')}</span>
              </label>

              <button
                className={`account-monthly-btn ${customer?.monthly_subscription ? 'active' : ''}`}
                onClick={() => toggleMonthlySubscription(!customer?.monthly_subscription)}
              >
                {customer?.monthly_subscription ? t('account.monthlyActive') : t('account.monthlySubscribe')}
              </button>

              <div className="account-orders">
                <h4>{t('account.ordersTitle')}</h4>
                {ordersLoading ? (
                  <p className="account-loading">{t('account.loading')}</p>
                ) : orders.length === 0 ? (
                  <p className="account-fineprint">{t('account.noOrders')}</p>
                ) : (
                  <ul className="account-orders-list">
                    {orders.map((o) => (
                      <li key={o.id} className="account-order-item">
                        <div className="account-order-top">
                          <span>{new Date(o.created_at).toLocaleDateString(lang === 'es' ? 'es-CO' : lang)}</span>
                          <span className={`account-order-status status-${o.status}`}>
                            {STATUS_LABEL[o.status]?.[lang] || o.status}
                          </span>
                        </div>
                        <div className="account-order-items">
                          {o.order_items.map((it, i) => (
                            <span key={i}>
                              {it.qty}× {it.product_name_snapshot}{it.variant_label_snapshot ? ` (${it.variant_label_snapshot})` : ''}
                              {i < o.order_items.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="account-links">
                <a href="#beans" onClick={close}>{t('account.linkBeans')}</a>
                <a href="#championship" onClick={close}>{t('account.linkChampionship')}</a>
                <a href="#contact" onClick={close}>{t('account.linkContact')}</a>
              </div>

              <button className="btn-continue account-signout" onClick={signOut}>
                {t('account.signOut')}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

import { useState, useMemo } from 'react';
import { useCart } from '../cart/context/CartContext.jsx';
import { useAuth } from '../account/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { detectCardBrand, formatCardNumber, isValidLuhn } from '../../shared/lib/cardBrand.js';
import { tokenizeWompiCard, PSE_BANKS } from '../../shared/lib/wompi.js';
import { recordLocalOrderIntent } from '../../shared/lib/orders.js';

// Función serverless que crea la transacción en Wompi (ver /api/create-local-payment.js).
// Necesita WOMPI_PRIVATE_KEY configurada en el servidor — ver README y .env.example.
const LOCAL_PAYMENT_ENDPOINT = '/api/create-local-payment';

const money = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24, 36];

const BRAND_LABEL = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  diners: 'Diners Club',
  discover: 'Discover',
};

export default function CheckoutModal() {
  const {
    paymentModalOpen,
    paymentItems,
    closePaymentModal,
    payWithCard,
    cardStatus,
    cardError,
  } = useCart();
  const { t } = useLanguage();
  const { customer } = useAuth();

  const [tab, setTab] = useState('local_card');

  // --- Tarjeta local ---
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [installments, setInstallments] = useState(1);

  // --- PSE ---
  const [bankCode, setBankCode] = useState('');
  const [personType, setPersonType] = useState('natural');
  const [documentType, setDocumentType] = useState('CC');
  const [documentNumber, setDocumentNumber] = useState('');

  // --- Nequi / Daviplata ---
  const [walletType, setWalletType] = useState('nequi');
  const [phone, setPhone] = useState('');

  const [localStatus, setLocalStatus] = useState('idle'); // idle | loading | error | redirecting | pending_wallet
  const [localError, setLocalError] = useState(null);

  const totalCOP = useMemo(
    () => paymentItems.reduce((s, i) => s + i.price * i.qty, 0),
    [paymentItems]
  );

  if (!paymentModalOpen) return null;

  const brand = detectCardBrand(cardNumber);

  const resetLocalStatus = () => {
    setLocalStatus('idle');
    setLocalError(null);
  };

  const changeTab = (next) => {
    setTab(next);
    resetLocalStatus();
  };

  async function submitLocalPayment(method, extraPayload) {
    setLocalStatus('loading');
    setLocalError(null);
    try {
      const orderId = await recordLocalOrderIntent(paymentItems, method, customer?.id);
      const res = await fetch(LOCAL_PAYMENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          method: method.toUpperCase(),
          amount_in_cents: Math.round(totalCOP * 100),
          currency: 'COP',
          redirect_url: `${window.location.origin}${window.location.pathname}?payment=pending`,
          ...extraPayload,
        }),
      });
      if (!res.ok) throw new Error('bad-response');
      const data = await res.json();

      if (data.redirectUrl) {
        setLocalStatus('redirecting');
        window.location.href = data.redirectUrl;
        return;
      }
      if (method === 'nequi' || method === 'daviplata') {
        setLocalStatus('pending_wallet');
        return;
      }
      setLocalStatus('pending_wallet');
    } catch (err) {
      setLocalStatus('error');
      setLocalError(err.message === 'bad-response' ? 'not-configured' : 'generic');
    }
  }

  const handleLocalCardSubmit = async (e) => {
    e.preventDefault();
    if (!isValidLuhn(cardNumber)) {
      setLocalStatus('error');
      setLocalError('invalid-card');
      return;
    }
    setLocalStatus('loading');
    setLocalError(null);
    const tokenRes = await tokenizeWompiCard({
      number: cardNumber,
      expMonth,
      expYear,
      cvc,
      cardHolder: cardName,
    });
    if (tokenRes.error) {
      setLocalStatus('error');
      setLocalError(tokenRes.error);
      return;
    }
    await submitLocalPayment('card', { installments, card_token: tokenRes.token });
  };

  const handlePseSubmit = (e) => {
    e.preventDefault();
    if (!bankCode || !documentNumber) {
      setLocalStatus('error');
      setLocalError('missing-fields');
      return;
    }
    submitLocalPayment('pse', {
      financial_institution_code: bankCode,
      user_type: personType === 'natural' ? 0 : 1,
      user_legal_id_type: documentType,
      user_legal_id: documentNumber,
    });
  };

  const handleWalletSubmit = (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) {
      setLocalStatus('error');
      setLocalError('invalid-phone');
      return;
    }
    submitLocalPayment(walletType, { phone_number: phone });
  };

  const localErrorMsg = () => {
    if (localError === 'not-configured') return t('payment.notConfiguredLocal');
    if (localError === 'invalid-card') return t('payment.invalidCard');
    if (localError === 'invalid-phone') return t('payment.invalidPhone');
    if (localError === 'missing-fields') return t('payment.missingFields');
    return t('payment.errorGeneric');
  };

  return (
    <>
      <div className="cart-overlay open" onClick={closePaymentModal} />
      <div className="payment-modal-wrap" role="dialog" aria-modal="true">
        <div className="payment-modal-banner">
          <button className="modal-close" onClick={closePaymentModal} aria-label={t('sales.close')}>×</button>

          <div className="payment-modal-header">
            <h2 className="hero-title" style={{ color: 'var(--cream)' }}>{t('payment.title')}</h2>
            <p className="payment-modal-total">{t('cart.subtotal')}: {money(totalCOP)}</p>
          </div>

          <div className="payment-tabs">
            <button className={`payment-tab-btn ${tab === 'local_card' ? 'active' : ''}`} onClick={() => changeTab('local_card')}>
              {t('payment.tabLocalCard')}
            </button>
            <button className={`payment-tab-btn ${tab === 'pse' ? 'active' : ''}`} onClick={() => changeTab('pse')}>
              PSE
            </button>
            <button className={`payment-tab-btn ${tab === 'wallet' ? 'active' : ''}`} onClick={() => changeTab('wallet')}>
              {t('payment.tabWallet')}
            </button>
            <button className={`payment-tab-btn ${tab === 'stripe' ? 'active' : ''}`} onClick={() => changeTab('stripe')}>
              {t('payment.tabInternational')}
            </button>
          </div>

          <div className="payment-modal-body">
            {tab === 'local_card' && (
              <form className="payment-form" onSubmit={handleLocalCardSubmit}>
                <label className="payment-field">
                  <span>{t('payment.cardNumber')}</span>
                  <div className="payment-card-input-row">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="4242 4242 4242 4242"
                      maxLength={23}
                      required
                    />
                    {brand && <span className="payment-brand-tag">{BRAND_LABEL[brand]}</span>}
                  </div>
                </label>

                <label className="payment-field">
                  <span>{t('payment.cardName')}</span>
                  <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)} required />
                </label>

                <div className="payment-row">
                  <label className="payment-field">
                    <span>{t('payment.expiry')}</span>
                    <div className="payment-expiry-row">
                      <input
                        type="text" inputMode="numeric" placeholder="MM" maxLength={2}
                        value={expMonth} onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ''))} required
                      />
                      <span>/</span>
                      <input
                        type="text" inputMode="numeric" placeholder="AA" maxLength={2}
                        value={expYear} onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ''))} required
                      />
                    </div>
                  </label>
                  <label className="payment-field">
                    <span>CVC</span>
                    <input
                      type="text" inputMode="numeric" maxLength={4}
                      value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))} required
                    />
                  </label>
                </div>

                <label className="payment-field">
                  <span>{t('payment.installments')}</span>
                  <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                    {INSTALLMENT_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n === 1 ? t('payment.oneInstallment') : `${n} ${t('payment.installmentsSuffix')}`}</option>
                    ))}
                  </select>
                </label>

                {localStatus === 'error' && <p className="cart-payment-error">{localErrorMsg()}</p>}
                {localStatus === 'pending_wallet' && <p className="payment-status-msg">{t('payment.processingLocal')}</p>}

                <button className="btn-checkout" type="submit" disabled={localStatus === 'loading'}>
                  {localStatus === 'loading' ? t('payment.processing') : `${t('payment.payButton')} · ${money(totalCOP)}`}
                </button>
              </form>
            )}

            {tab === 'pse' && (
              <form className="payment-form" onSubmit={handlePseSubmit}>
                <label className="payment-field">
                  <span>{t('payment.bank')}</span>
                  <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} required>
                    <option value="">{t('payment.selectBank')}</option>
                    {PSE_BANKS.map((b) => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </label>

                <label className="payment-field">
                  <span>{t('payment.personType')}</span>
                  <select value={personType} onChange={(e) => setPersonType(e.target.value)}>
                    <option value="natural">{t('payment.natural')}</option>
                    <option value="juridica">{t('payment.legal')}</option>
                  </select>
                </label>

                <div className="payment-row">
                  <label className="payment-field">
                    <span>{t('payment.documentType')}</span>
                    <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                      <option value="CC">Cédula (CC)</option>
                      <option value="CE">Cédula extranjería (CE)</option>
                      <option value="NIT">NIT</option>
                      <option value="PPN">Pasaporte</option>
                    </select>
                  </label>
                  <label className="payment-field">
                    <span>{t('payment.documentNumber')}</span>
                    <input
                      type="text" inputMode="numeric"
                      value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value.replace(/\D/g, ''))} required
                    />
                  </label>
                </div>

                {localStatus === 'error' && <p className="cart-payment-error">{localErrorMsg()}</p>}
                {localStatus === 'redirecting' && <p className="payment-status-msg">{t('payment.pseRedirecting')}</p>}

                <button className="btn-checkout" type="submit" disabled={localStatus === 'loading'}>
                  {localStatus === 'loading' ? t('payment.processing') : `${t('payment.payButton')} · ${money(totalCOP)}`}
                </button>
              </form>
            )}

            {tab === 'wallet' && (
              <form className="payment-form" onSubmit={handleWalletSubmit}>
                <div className="payment-wallet-options">
                  <button
                    type="button"
                    className={`payment-wallet-btn ${walletType === 'nequi' ? 'active' : ''}`}
                    onClick={() => setWalletType('nequi')}
                  >
                    Nequi
                  </button>
                  <button
                    type="button"
                    className={`payment-wallet-btn ${walletType === 'daviplata' ? 'active' : ''}`}
                    onClick={() => setWalletType('daviplata')}
                  >
                    Daviplata
                  </button>
                </div>

                <label className="payment-field">
                  <span>{t('payment.phoneNumber')}</span>
                  <input
                    type="text" inputMode="numeric" maxLength={10} placeholder="3001234567"
                    value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} required
                  />
                </label>

                <p className="payment-hint">{t('payment.walletHint')}</p>

                {localStatus === 'error' && <p className="cart-payment-error">{localErrorMsg()}</p>}
                {localStatus === 'pending_wallet' && <p className="payment-status-msg">{t('payment.walletPending')}</p>}

                <button className="btn-checkout" type="submit" disabled={localStatus === 'loading'}>
                  {localStatus === 'loading' ? t('payment.processing') : `${t('payment.payButton')} · ${money(totalCOP)}`}
                </button>
              </form>
            )}

            {tab === 'stripe' && (
              <div className="payment-form">
                <p className="payment-hint">{t('payment.subtitle')}</p>
                {cardStatus === 'error' && (
                  <p className="cart-payment-error">
                    {cardError === 'not-configured' ? t('payment.notConfigured') : t('payment.errorGeneric')}
                  </p>
                )}
                <button
                  className="btn-checkout btn-checkout-card"
                  onClick={() => payWithCard(paymentItems)}
                  disabled={cardStatus === 'loading'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                  </svg>
                  {cardStatus === 'loading' ? t('payment.processing') : t('payment.payStripe')}
                </button>
                <p className="account-fineprint">{t('payment.secure')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

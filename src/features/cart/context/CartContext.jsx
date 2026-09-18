import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { recordWhatsAppOrder, recordCardOrderIntent } from '../../../shared/lib/orders.js';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import { useAuth } from '../../account/AuthContext.jsx';

const CartContext = createContext(null);

// Número de respaldo, solo por si Supabase no responde a tiempo (p. ej. sin
// conexión) — el número real y editable vive en la tabla app_config y se
// puede cambiar sin tocar código ni volver a desplegar el sitio.
const FALLBACK_WHATSAPP_NUMBER = '573152125327';

// === Pago con tarjeta (Stripe) ===
// Endpoint de la función serverless que crea la sesión de pago (ver /api/create-checkout-session.js
// y el README para desplegarla en Vercel/Netlify con tu clave secreta de Stripe).
export const CARD_CHECKOUT_ENDPOINT = '/api/create-checkout-session';

// Los precios del sitio están en pesos colombianos (COP). Para cobrar con tarjeta a nivel
// mundial se convierten a USD con esta tasa aproximada. AJUSTA esta constante a la tasa real,
// o mejor aún, define un precio en USD fijo por producto en vez de convertir.
const USD_PER_COP = 1 / 4000;
export const toUSD = (copAmount) => Math.max(0.5, Math.round(copAmount * USD_PER_COP * 100) / 100);

const money = (n) => '$' + Math.round(n).toLocaleString('es-CO');

const slugify = (str) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function buildOrderMessage(items) {
  const lines = items.map(
    (i) => `• ${i.qty}x ${i.name}${i.variant ? ' (' + i.variant + ')' : ''} — ${money(i.price * i.qty)}`
  );
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  return ['¡Hola! Quiero hacer este pedido:', '', ...lines, '', `Total: ${money(total)}`].join('\n');
}

export function sendToWhatsApp(message, number) {
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
}

export function CartProvider({ children }) {
  const { isLoggedIn, customer, open: openAccount } = useAuth();
  const [cart, setCart] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [cardStatus, setCardStatus] = useState('idle'); // idle | loading | error
  const [cardError, setCardError] = useState(null); // 'not-configured' | 'generic'
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentItems, setPaymentItems] = useState([]);
  const [whatsappNumber, setWhatsappNumber] = useState(FALLBACK_WHATSAPP_NUMBER);

  useEffect(() => {
    fetchAppConfig('whatsapp_number', FALLBACK_WHATSAPP_NUMBER).then(setWhatsappNumber);
  }, []);

  const addItem = useCallback(({ name, price, variant, qty, image, variantId }) => {
    const id = slugify(name) + (variant ? '-' + slugify(variant) : '');
    setCart((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { id, name, price, variant, qty, image, variantId }];
    });
  }, []);

  const updateQty = useCallback((id, delta) => {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
    );
  }, []);

  const removeItem = useCallback((id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const checkout = useCallback(() => {
    if (cart.length === 0) {
      alert('Tu carrito está vacío.');
      return;
    }
    // No se espera (await) a propósito: si abrimos WhatsApp después de una
    // pausa asíncrona, el navegador puede bloquear la ventana emergente por
    // no considerarla ya "en respuesta directa" al clic del usuario.
    recordWhatsAppOrder(cart, customer?.id);
    sendToWhatsApp(buildOrderMessage(cart), whatsappNumber);
  }, [cart, customer, whatsappNumber]);

  // El botón "Comprar" ya no manda directo a WhatsApp: agrega el producto al
  // carrito y abre el drawer, para que ahí se elija el medio de pago
  // (WhatsApp o tarjeta).
  const buyNow = useCallback(
    (item) => {
      addItem(item);
      setIsOpen(true);
    },
    [addItem]
  );

  const resetCardStatus = useCallback(() => {
    setCardStatus('idle');
    setCardError(null);
  }, []);

  // Crea una sesión de pago con tarjeta (Stripe Checkout) válida para cualquier país y redirige
  // al usuario ahí. Requiere que /api/create-checkout-session.js esté desplegado con una clave
  // secreta de Stripe real (ver README). Primero registra el pedido en Supabase (status:
  // pending, source: web_card) para poder conciliarlo después con la sesión de Stripe.
  const payWithCard = useCallback(async (items) => {
    if (!items || items.length === 0) return;
    setCardStatus('loading');
    setCardError(null);
    try {
      const orderId = await recordCardOrderIntent(items, customer?.id);

      const res = await fetch(CARD_CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          items: items.map((i) => ({
            name: i.name + (i.variant ? ` (${i.variant})` : ''),
            quantity: i.qty,
            unitAmountUSD: toUSD(i.price),
          })),
          successUrl: `${window.location.origin}${window.location.pathname}?payment=success`,
          cancelUrl: `${window.location.origin}${window.location.pathname}?payment=cancelled`,
        }),
      });

      if (!res.ok) throw new Error('bad-response');
      const data = await res.json();
      if (!data || !data.url) throw new Error('no-url');

      window.location.href = data.url;
    } catch (err) {
      setCardStatus('error');
      setCardError(err.message === 'bad-response' || err.message === 'no-url' ? 'not-configured' : 'generic');
    }
  }, [customer]);

  // Pagar con tarjeta requiere sesión iniciada (para poder guardar el
  // historial de pedidos en la cuenta). Si no hay sesión, abre el drawer de
  // cuenta para que inicie sesión con Google en vez de abrir el checkout.
  const checkoutCard = useCallback(() => {
    if (cart.length === 0) {
      alert('Tu carrito está vacío.');
      return;
    }
    if (!isLoggedIn) {
      openAccount();
      return;
    }
    setPaymentItems(cart);
    setPaymentModalOpen(true);
  }, [cart, isLoggedIn, openAccount]);

  const buyNowCard = useCallback(
    (item) => {
      if (!isLoggedIn) {
        openAccount();
        return;
      }
      setPaymentItems([item]);
      setPaymentModalOpen(true);
    },
    [isLoggedIn, openAccount]
  );

  const closePaymentModal = useCallback(() => {
    setPaymentModalOpen(false);
    resetCardStatus();
  }, [resetCardStatus]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const totalQty = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const value = {
    cart,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    addItem,
    updateQty,
    removeItem,
    checkout,
    buyNow,
    checkoutCard,
    buyNowCard,
    cardStatus,
    cardError,
    resetCardStatus,
    paymentModalOpen,
    paymentItems,
    closePaymentModal,
    payWithCard,
    subtotal,
    totalQty,
    money,
    toUSD,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}

import { createContext, useContext, useMemo, useState, useCallback } from 'react';

const CartContext = createContext(null);

// Cambia este número por el real. Formato: código de país + número, sin +, sin espacios.
export const WHATSAPP_NUMBER = '573001112233';

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

export function sendToWhatsApp(message) {
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback(({ name, price, variant, qty, image }) => {
    const id = slugify(name) + (variant ? '-' + slugify(variant) : '');
    setCart((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { id, name, price, variant, qty, image }];
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
    sendToWhatsApp(buildOrderMessage(cart));
  }, [cart]);

  const buyNow = useCallback((item) => {
    sendToWhatsApp(buildOrderMessage([item]));
  }, []);

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
    subtotal,
    totalQty,
    money,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}

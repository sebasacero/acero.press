import { supabase } from './supabaseClient.js';

async function insertOrder(source, items, extra = {}) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ source, status: 'pending', total, ...extra })
    .select('id')
    .single();

  if (orderError) {
    console.error('No se pudo registrar el pedido en Supabase:', orderError.message);
    return null;
  }

  const rows = items.map((i) => ({
    order_id: order.id,
    variant_id: i.variantId ?? null,
    product_name_snapshot: i.name,
    variant_label_snapshot: i.variant ?? null,
    unit_price: i.price,
    qty: i.qty,
    subtotal: i.price * i.qty,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(rows);
  if (itemsError) {
    console.error('No se pudieron registrar los items del pedido:', itemsError.message);
  }

  return order.id;
}

/**
 * Registra un pedido como "intención de compra" (status: pending) antes de
 * abrir WhatsApp. No descuenta inventario todavía — eso solo pasa cuando un
 * admin confirma la venta desde el panel (el pedido en WhatsApp podría no
 * cerrarse). Esto es lo que alimenta el contador/odómetro y el dashboard.
 *
 * items: [{ name, price, variant, qty, variantId }]
 * Devuelve el id del pedido creado, o null si falló (no debe bloquear el
 * flujo de WhatsApp aunque el guardado falle).
 */
export async function recordWhatsAppOrder(items, customerId) {
  return insertOrder('whatsapp', items, customerId ? { customer_id: customerId } : {});
}

/**
 * Igual que recordWhatsAppOrder, pero para pagos con tarjeta internacional
 * (Stripe). A diferencia del flujo de WhatsApp, aquí SÍ se espera (await) a
 * que termine, porque el id del pedido se necesita para pasárselo a Stripe
 * antes de redirigir — la redirección con window.location.href no la
 * bloquean los navegadores como sí bloquean window.open tras una pausa
 * asíncrona. El pedido sigue quedando en 'pending' hasta que se confirme el pago.
 */
export async function recordCardOrderIntent(items, customerId) {
  return insertOrder('web_card', items, {
    payment_provider: 'stripe',
    payment_method: 'card',
    ...(customerId ? { customer_id: customerId } : {}),
  });
}

/**
 * Igual que recordCardOrderIntent, pero para pagos locales de Colombia vía
 * Wompi (tarjeta local, PSE, Nequi o Daviplata).
 * method: 'card' | 'pse' | 'nequi' | 'daviplata'
 */
export async function recordLocalOrderIntent(items, method, customerId) {
  return insertOrder('web_card', items, {
    payment_provider: 'wompi',
    payment_method: method,
    ...(customerId ? { customer_id: customerId } : {}),
  });
}

/**
 * Historial de pedidos del cliente logueado, para mostrar en su cuenta.
 * RLS ya garantiza que solo puede ver los suyos.
 */
export async function fetchMyOrders(limit = 10) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total, source, created_at, order_items(product_name_snapshot, variant_label_snapshot, qty)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Error trayendo tus pedidos:', error.message);
    return [];
  }
  return data ?? [];
}


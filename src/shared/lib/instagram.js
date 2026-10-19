import { supabase } from './supabaseClient.js';

// Llamadas a las Edge Functions de Instagram. supabase.functions.invoke
// envía la sesión del usuario: las funciones verifican que sea el owner.

async function call(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // El cuerpo del error trae el mensaje de Meta o de la función.
    let message = error.message;
    try {
      const payload = await error.context?.json?.();
      message = payload?.error || message;
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(message);
  }
  if (data && data.ok === false) throw new Error(data.error || 'Error desconocido');
  return data;
}

export const instagramStatus = () => call('instagram-auth', { action: 'status' });
export const instagramConnect = (token) => call('instagram-auth', { action: 'connect', token });
export const instagramRefresh = () => call('instagram-auth', { action: 'refresh' });
export const instagramSync = () => call('instagram-sync', {});

/**
 * Publica en Instagram. kind: 'image' (feed) | 'story' | 'reel' | 'story_video'.
 * Devuelve el resultado de Instagram ({ success, post_id } o { error }).
 */
export async function publishToInstagram({ mediaUrl, kind, caption, publicationId }) {
  const data = await call('publish-content', {
    media_url: mediaUrl,
    media_kind: kind,
    caption,
    platforms: { ig: true },
    publication_id: publicationId,
  });
  return data?.results?.instagram ?? { success: false, error: 'Instagram no respondió.' };
}

/**
 * Registra una venta de Micra (barra) como pedido completado: suma al contador,
 * al dashboard, al agente y al algoritmo, y descuenta el inventario. Un
 * ticket puede tener varias líneas (varios cafés o presentaciones).
 * lines: [{ variant: { id, label, price }, productName, qty }]
 */
export async function recordMicraSale({ lines, paymentMethod, phone }) {
  const valid = (lines || []).filter((l) => l.variant && l.qty > 0);
  if (!valid.length) throw new Error('El ticket está vacío.');
  const total = valid.reduce((s, l) => s + Number(l.variant.price) * l.qty, 0);
  const now = new Date().toISOString();
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      source: 'esspresale',
      status: 'completed',
      total,
      payment_method: paymentMethod,
      payment_provider: 'esspresale',
      customer_phone: phone || null,
      closed_at: now,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const { error: itemError } = await supabase.from('order_items').insert(valid.map((l) => ({
    order_id: order.id,
    variant_id: l.variant.id,
    product_name_snapshot: l.productName,
    variant_label_snapshot: l.variant.label,
    unit_price: Number(l.variant.price),
    qty: l.qty,
    subtotal: Number(l.variant.price) * l.qty,
  })));
  if (itemError) throw new Error(itemError.message);

  // Inventario: mismo flujo que al confirmar un pedido en el panel.
  await moveStock(valid.map((l) => ({ variantId: l.variant.id, change: -l.qty })), 'sale', order.id, now);
  return { orderId: order.id, total };
}

/** Anula una venta recién registrada («Deshacer»): la cancela y devuelve el inventario. */
export async function voidMicraSale({ orderId, lines }) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  if (error) throw new Error(error.message);
  await moveStock(lines.map((l) => ({ variantId: l.variantId, change: l.qty })), 'adjustment', orderId, now);
}

async function moveStock(changes, reason, orderId, now) {
  for (const { variantId, change } of changes) {
    await supabase.from('inventory_movements').insert({
      variant_id: variantId,
      change_qty: change,
      reason,
      reference_order_id: orderId,
    });
    const { data: inv } = await supabase.from('inventory').select('stock_qty').eq('variant_id', variantId).maybeSingle();
    if (inv) {
      await supabase
        .from('inventory')
        .update({ stock_qty: Math.max(0, inv.stock_qty + change), updated_at: now })
        .eq('variant_id', variantId);
    }
  }
}

/** Una sola línea (como lo registraba la consola de Micra). */
export function recordEspresaleSale({ variant, productName, qty, paymentMethod, phone }) {
  return recordMicraSale({ lines: [{ variant, productName, qty }], paymentMethod, phone });
}

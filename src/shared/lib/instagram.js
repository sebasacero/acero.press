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
 * Registra una venta de Espresale como pedido completado (suma al contador,
 * al dashboard y al agente) y descuenta el inventario de la variante.
 */
export async function recordEspresaleSale({ variant, productName, qty, paymentMethod, phone }) {
  const total = Number(variant.price) * qty;
  const now = new Date().toISOString();
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      source: 'espresale',
      status: 'completed',
      total,
      payment_method: paymentMethod,
      payment_provider: 'espresale',
      customer_phone: phone || null,
      closed_at: now,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const { error: itemError } = await supabase.from('order_items').insert({
    order_id: order.id,
    variant_id: variant.id,
    product_name_snapshot: productName,
    variant_label_snapshot: variant.label,
    unit_price: Number(variant.price),
    qty,
    subtotal: total,
  });
  if (itemError) throw new Error(itemError.message);

  // Inventario: mismo flujo que al confirmar un pedido en el panel.
  await supabase.from('inventory_movements').insert({
    variant_id: variant.id,
    change_qty: -qty,
    reason: 'sale',
    reference_order_id: order.id,
  });
  const { data: inv } = await supabase.from('inventory').select('stock_qty').eq('variant_id', variant.id).maybeSingle();
  if (inv) {
    await supabase
      .from('inventory')
      .update({ stock_qty: Math.max(0, inv.stock_qty - qty), updated_at: now })
      .eq('variant_id', variant.id);
  }
  return { orderId: order.id, total };
}

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

// La venta y la anulación van en una sola transacción de la base
// (micra_record_sale / micra_void_sale, migración 20261021120000). Mientras
// esa migración no esté aplicada se usa el camino de antes, llamada por llamada.
let atomicMissing = false;
const isMissingFn = (e) => e?.code === 'PGRST202' || e?.code === '42883';

/**
 * Registra una venta de Micra (barra) como pedido completado: suma al contador,
 * al dashboard, al agente y al algoritmo, y descuenta el inventario. Un
 * ticket puede tener varias líneas (varios cafés o presentaciones).
 * lines: [{ variant: { id, label, price }, productName, qty }]
 * clientRef: identifica el ticket; un reintento con la misma referencia
 * devuelve el pedido ya creado en vez de duplicarlo.
 *
 * Devuelve { orderId, total, stock: [{ variantId, applied }], stockError, replay }:
 * `applied` es lo que de verdad cambió el inventario (no baja de 0), para que
 * «Deshacer» devuelva exactamente eso; `replay`: el pedido ya existía (reintento).
 */
export async function recordMicraSale({ lines, paymentMethod, phone, clientRef }) {
  const valid = (lines || []).filter((l) => l.variant && l.qty > 0);
  if (!valid.length) throw new Error('El ticket está vacío.');
  if (!atomicMissing) {
    // Precios y nombres los pone la base; aquí solo van presentación y cantidad
    const { data, error } = await supabase.rpc('micra_record_sale', {
      p_lines: valid.map((l) => ({ variant_id: l.variant.id, qty: l.qty })),
      p_payment_method: paymentMethod ?? null,
      p_phone: phone || null,
      p_client_ref: clientRef ?? null,
    });
    if (!error) {
      return {
        orderId: data.order_id,
        total: Number(data.total),
        stock: (data.stock ?? []).map((x) => ({ variantId: x.variant_id, applied: x.applied })),
        stockError: null,
        replay: !!data.replay,
      };
    }
    // Sin código = no hubo respuesta: la venta pudo guardarse y el mismo ticket se puede reintentar
    if (!error.code) throw new Error('sin respuesta del servidor. Reintenta el mismo ticket: si ya se había guardado, no se registra dos veces.');
    if (!isMissingFn(error)) throw new Error(error.message);
    atomicMissing = true;
  }
  return recordMicraSaleSteps({ lines: valid, paymentMethod, phone });
}

/** Camino de antes (sin la migración): si las líneas no se guardan, el pedido se cancela antes de avisar. */
async function recordMicraSaleSteps({ lines: valid, paymentMethod, phone }) {
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
  if (itemError) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    throw new Error(itemError.message);
  }

  // Inventario: mismo flujo que al confirmar un pedido en el panel (una vez por presentación)
  const perVariant = new Map();
  for (const l of valid) perVariant.set(l.variant.id, (perVariant.get(l.variant.id) || 0) + l.qty);
  const { applied, error: stockError } = await moveStock(
    [...perVariant].map(([variantId, qty]) => ({ variantId, change: -qty })), 'sale', order.id, now,
  );
  return { orderId: order.id, total, stock: applied, stockError, replay: false };
}

/**
 * Anula una venta recién registrada («Deshacer»): la cancela (solo si sigue
 * completada: anular dos veces no devuelve el stock dos veces), devuelve al
 * inventario lo que la venta descontó y suelta las publicaciones que la citaban.
 * stock: [{ variantId, applied }] (lo que devolvió recordMicraSale; la función
 * de la base no lo necesita: lo lee de los movimientos del pedido).
 */
export async function voidMicraSale({ orderId, stock }) {
  if (!atomicMissing) {
    const { data, error } = await supabase.rpc('micra_void_sale', { p_order_id: orderId });
    if (!error) return { alreadyVoided: !!data?.already_voided };
    if (!isMissingFn(error)) throw new Error(error.message);
    atomicMissing = true;
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('status', 'completed')
    .select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) return { alreadyVoided: true };
  await supabase.from('publications').update({ order_id: null }).eq('order_id', orderId);
  const { error: stockError } = await moveStock(
    (stock || []).filter((x) => x.applied).map((x) => ({ variantId: x.variantId, change: -x.applied })), 'adjustment', orderId, now,
  );
  if (stockError) throw new Error(`La venta se anuló, pero el inventario no se actualizó: ${stockError}`);
  return { alreadyVoided: false };
}

/**
 * Mueve el inventario; devuelve lo aplicado de verdad por presentación y el
 * primer error. Como en la base: la venta registra −qty y, si no alcanzaba, un
 * 'adjustment' con lo que no se descontó (la suma de movimientos del pedido es
 * lo que de verdad cambió el inventario).
 */
async function moveStock(changes, reason, orderId, now) {
  const applied = [];
  let firstError = null;
  for (const { variantId, change } of changes) {
    const { data: inv, error: readError } = await supabase.from('inventory').select('stock_qty').eq('variant_id', variantId).maybeSingle();
    if (readError) { firstError ??= readError.message; applied.push({ variantId, applied: 0 }); continue; }
    if (!inv) { applied.push({ variantId, applied: 0 }); continue; }
    // Una salida no baja de 0 (y si ya estaba en 0 o menos, no se mueve)
    const next = change < 0 ? Math.min(inv.stock_qty, Math.max(0, inv.stock_qty + change)) : inv.stock_qty + change;
    const { error: updateError } = await supabase
      .from('inventory')
      .update({ stock_qty: next, updated_at: now })
      .eq('variant_id', variantId);
    if (updateError) { firstError ??= updateError.message; applied.push({ variantId, applied: 0 }); continue; }
    applied.push({ variantId, applied: next - inv.stock_qty });
    const { error: logError } = await supabase.from('inventory_movements').insert({
      variant_id: variantId,
      change_qty: reason === 'sale' ? change : next - inv.stock_qty,
      reason,
      reference_order_id: orderId,
    });
    if (logError) firstError ??= logError.message;
    if (reason === 'sale' && next - inv.stock_qty !== change) {
      const { error: clampError } = await supabase.from('inventory_movements').insert({
        variant_id: variantId,
        change_qty: next - inv.stock_qty - change,
        reason: 'adjustment',
        reference_order_id: orderId,
      });
      if (clampError) firstError ??= clampError.message;
    }
  }
  return { applied, error: firstError };
}

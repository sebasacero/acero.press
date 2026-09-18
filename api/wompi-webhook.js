// Webhook de Wompi: escucha el evento "transaction.updated" y, cuando llega con
// status APPROVED, confirma el pedido en Supabase, descuenta inventario y registra
// el movimiento — el equivalente local de /api/stripe-webhook.js.
//
// CÓMO CONECTARLO
// En tu Dashboard de Wompi: Configuración → Eventos → agrega la URL
// https://TU-DOMINIO/api/wompi-webhook. Wompi firma cada evento con el "Secreto de
// eventos" (distinto del secreto de integridad) — guárdalo como WOMPI_EVENTS_SECRET.

async function sha256Hex(message) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(message).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method not allowed');
  }

  const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!eventsSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('Faltan variables de entorno para el webhook de Wompi.');
    return res.status(500).end('Webhook not configured');
  }

  const event = req.body;

  try {
    // Verifica la firma del evento (evita que cualquiera falsifique una "compra aprobada").
    const props = event?.signature?.properties || [];
    const concatenated = props.map((p) => p.split('.').reduce((obj, k) => obj?.[k], event.data)).join('');
    const checksum = await sha256Hex(`${concatenated}${event.timestamp}${eventsSecret}`);
    if (checksum !== event?.signature?.checksum) {
      console.error('Firma de evento de Wompi inválida.');
      return res.status(400).end('Invalid signature');
    }
  } catch (err) {
    console.error('Error verificando firma de Wompi:', err);
    return res.status(400).end('Invalid signature');
  }

  if (event.event === 'transaction.updated' && event.data?.transaction?.status === 'APPROVED') {
    const transaction = event.data.transaction;
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, status')
      .eq('payment_reference', transaction.id)
      .maybeSingle();

    if (!order || order.status !== 'pending') {
      return res.status(200).json({ received: true, note: 'pedido ya procesado o no encontrado' });
    }

    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('variant_id, qty')
      .eq('order_id', order.id);

    for (const item of items ?? []) {
      if (!item.variant_id) continue;

      await supabaseAdmin.from('inventory_movements').insert({
        variant_id: item.variant_id,
        change_qty: -item.qty,
        reason: 'sale',
        reference_order_id: order.id,
      });

      const { data: inv } = await supabaseAdmin
        .from('inventory')
        .select('stock_qty')
        .eq('variant_id', item.variant_id)
        .maybeSingle();

      if (inv) {
        await supabaseAdmin
          .from('inventory')
          .update({ stock_qty: Math.max(0, inv.stock_qty - item.qty) })
          .eq('variant_id', item.variant_id);
      }
    }

    await supabaseAdmin
      .from('orders')
      .update({ status: 'confirmed', closed_at: new Date().toISOString() })
      .eq('id', order.id);
  }

  return res.status(200).json({ received: true });
}

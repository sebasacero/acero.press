// Webhook de Stripe: escucha el evento "checkout.session.completed" y, cuando
// llega, confirma el pedido correspondiente en Supabase (status: confirmed),
// descuenta el inventario de cada producto vendido y registra el movimiento —
// exactamente lo mismo que hace un admin al confirmar un pedido a mano en el
// panel, pero automático.
//
// CÓMO CONECTARLO
// 1) En el Dashboard de Stripe: Developers → Webhooks → "Add endpoint".
//    URL: https://TU-DOMINIO/api/stripe-webhook
//    Evento a escuchar: checkout.session.completed
// 2) Stripe te da un "Signing secret" (empieza con whsec_...). Guárdalo como
//    variable de entorno STRIPE_WEBHOOK_SECRET en tu hosting (Vercel/Netlify).
// 3) Este endpoint también necesita STRIPE_SECRET_KEY, SUPABASE_URL y
//    SUPABASE_SERVICE_ROLE_KEY (las mismas que usa create-checkout-session.js).
// 4) IMPORTANTE (Vercel): este endpoint necesita el cuerpo crudo (raw body)
//    de la petición para verificar la firma de Stripe, por eso desactivamos
//    el bodyParser de Vercel más abajo (config.api.bodyParser: false).

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: false },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method not allowed');
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('Faltan variables de entorno para el webhook de Stripe.');
    return res.status(500).end('Webhook not configured');
  }

  const stripe = new Stripe(secretKey);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Firma de webhook inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.client_reference_id;

    if (!orderId) {
      console.error('El evento de Stripe no trae client_reference_id (orderId).');
      return res.status(200).json({ received: true, note: 'sin orderId, se ignora' });
    }

    // Evita procesar dos veces el mismo pedido si Stripe reenvía el evento.
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .maybeSingle();

    if (!order || order.status !== 'pending') {
      return res.status(200).json({ received: true, note: 'pedido ya procesado o no encontrado' });
    }

    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('variant_id, qty')
      .eq('order_id', orderId);

    for (const item of items ?? []) {
      if (!item.variant_id) continue;

      await supabaseAdmin.from('inventory_movements').insert({
        variant_id: item.variant_id,
        change_qty: -item.qty,
        reason: 'sale',
        reference_order_id: orderId,
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
      .eq('id', orderId);
  }

  return res.status(200).json({ received: true });
}

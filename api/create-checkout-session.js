// Función serverless para Vercel: crea una sesión de Stripe Checkout que acepta
// tarjetas de cualquier país (Stripe soporta tarjetas internacionales de forma nativa).
//
// CÓMO USARLA
// 1) Crea una cuenta en https://dashboard.stripe.com y activa el modo "Live" cuando estés listo
//    para cobrar de verdad (usa "Test mode" mientras pruebas).
// 2) Copia tu clave secreta (Developers → API keys → "Secret key") y guárdala como variable de
//    entorno STRIPE_SECRET_KEY en tu proveedor de hosting (Vercel/Netlify). NUNCA la pongas en
//    el código del frontend.
// 3) Copia también la Service Role Key de tu proyecto de Supabase (Project Settings → API →
//    "service_role secret") y guárdala como SUPABASE_SERVICE_ROLE_KEY. Esta clave tiene permisos
//    totales sobre la base de datos, así que NUNCA la pongas en el frontend — solo vive aquí,
//    en el servidor.
// 4) Instala los SDKs: npm install stripe @supabase/supabase-js
// 5) Despliega este proyecto en Vercel (o adapta este archivo al formato de function de Netlify).
//    Vercel detecta automáticamente cualquier archivo dentro de /api como un endpoint serverless
//    disponible en /api/create-checkout-session.
//
// El frontend (ver src/features/cart/context/CartContext.jsx) primero crea el pedido en Supabase
// (status: pending, source: web_card) y luego llama a este endpoint con el carrito y el id de
// ese pedido. Este endpoint crea la sesión de Stripe, guarda su id en el pedido (para poder
// confirmarlo después con un webhook de Stripe) y devuelve la URL de pago a la que se redirige
// al comprador.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    // Falta configurar Stripe: el frontend interpreta este 500 como "not-configured".
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY no está configurada en el servidor.' });
  }

  try {
    const stripe = new Stripe(secretKey);
    const { items, orderId, successUrl, cancelUrl } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío.' });
    }

    const line_items = items.map((item) => ({
      quantity: Math.max(1, Number(item.quantity) || 1),
      price_data: {
        currency: 'usd',
        product_data: { name: String(item.name || 'AceroPress').slice(0, 250) },
        // Stripe espera el monto en centavos.
        unit_amount: Math.round(Number(item.unitAmountUSD || 0) * 100),
      },
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      client_reference_id: orderId || undefined,
      // Sin restricción de país: Stripe Checkout ya acepta compradores y tarjetas de todo el
      // mundo por defecto. Si además necesitas recolectar la dirección de envío, agrega aquí
      // shipping_address_collection: { allowed_countries: ['US', 'CO', 'MX', 'ES', 'JP', ...] }.
      success_url: successUrl || 'https://www.aceropress.com/?payment=success',
      cancel_url: cancelUrl || 'https://www.aceropress.com/?payment=cancelled',
    });

    // Guarda la referencia de la sesión de Stripe en el pedido, si tenemos las
    // credenciales de Supabase configuradas. Esto NO marca el pedido como pagado
    // — eso solo debería pasar cuando Stripe confirme el pago (webhook), que es
    // un paso siguiente a este. Aquí solo dejamos el rastro para poder cruzarlo.
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (orderId && supabaseUrl && serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ payment_provider: 'stripe', payment_reference: session.id })
        .eq('id', orderId);
      if (updateError) {
        console.error('No se pudo guardar la referencia de Stripe en el pedido:', updateError.message);
      }
    }

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe checkout session error:', err);
    return res.status(500).json({ error: 'No se pudo crear la sesión de pago.' });
  }
}

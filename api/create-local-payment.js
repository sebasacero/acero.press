// Función serverless para Vercel: crea la transacción en Wompi para métodos de pago
// locales de Colombia (tarjeta con token ya generado en el cliente, PSE, Nequi, Daviplata).
//
// CÓMO USARLA
// 1) Crea una cuenta en https://comercios.wompi.co (usa el ambiente sandbox mientras pruebas).
// 2) En Configuración → API Keys copia:
//    - "Llave pública" → variable VITE_WOMPI_PUBLIC_KEY (esta SÍ va en el frontend, ver
//      src/shared/lib/wompi.js — es segura de exponer, como la publishable key de Stripe).
//    - "Llave privada" → variable WOMPI_PRIVATE_KEY (NUNCA en el frontend, solo aquí).
//    - "Secreto de integridad" → variable WOMPI_INTEGRITY_SECRET (para firmar cada transacción).
// 3) Instala el SDK nativo de fetch ya viene incluido en Node 18+, no se necesita un paquete
//    adicional de Wompi.
// 4) Despliega en Vercel. Este archivo queda disponible en /api/create-local-payment.
//
// El frontend (ver src/features/payment/CheckoutModal.jsx) ya arma el payload correcto para
// cada método: CARD (con card_token generado en el navegador), PSE, NEQUI o DAVIPLATA.

const WOMPI_ENV = process.env.WOMPI_ENV === 'production' ? 'production' : 'sandbox';
const WOMPI_API_BASE =
  WOMPI_ENV === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';

async function sha256Hex(message) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(message).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const privateKey = process.env.WOMPI_PRIVATE_KEY;
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;

  if (!privateKey || !integritySecret) {
    // Wompi no está configurado todavía: el frontend interpreta este 500 como "not-configured".
    return res.status(500).json({ error: 'WOMPI_PRIVATE_KEY / WOMPI_INTEGRITY_SECRET no configuradas.' });
  }

  try {
    const {
      orderId,
      method, // 'CARD' | 'PSE' | 'NEQUI' | 'DAVIPLATA'
      amount_in_cents,
      currency = 'COP',
      redirect_url,
      installments,
      card_token,
      financial_institution_code,
      user_type,
      user_legal_id_type,
      user_legal_id,
      phone_number,
    } = req.body || {};

    if (!orderId || !method || !amount_in_cents) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    // Referencia única que Wompi exige y que debe firmarse con el secreto de integridad.
    const reference = `acero-${orderId}`;
    const signaturePayload = `${reference}${amount_in_cents}${currency}${integritySecret}`;
    const signature = await sha256Hex(signaturePayload);

    let payment_method;
    if (method === 'CARD') {
      payment_method = { type: 'CARD', token: card_token, installments: installments || 1 };
    } else if (method === 'PSE') {
      payment_method = {
        type: 'PSE',
        user_type,
        user_legal_id_type,
        user_legal_id,
        financial_institution_code,
        payment_description: `Pedido AceroPress ${reference}`,
      };
    } else if (method === 'NEQUI') {
      payment_method = { type: 'NEQUI', phone_number };
    } else if (method === 'DAVIPLATA') {
      payment_method = { type: 'DAVIPLATA', phone_number };
    } else {
      return res.status(400).json({ error: 'Método de pago no soportado.' });
    }

    const wompiRes = await fetch(`${WOMPI_API_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${privateKey}`,
      },
      body: JSON.stringify({
        amount_in_cents,
        currency,
        signature,
        customer_email: req.body.customerEmail || 'compras@acero.press',
        reference,
        payment_method,
        redirect_url,
      }),
    });

    const wompiData = await wompiRes.json();
    if (!wompiRes.ok) {
      console.error('Wompi rechazó la transacción:', wompiData);
      return res.status(502).json({ error: 'No se pudo crear la transacción en Wompi.' });
    }

    const transaction = wompiData.data;

    // Guarda la referencia de Wompi en el pedido (para conciliar después con el webhook).
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      await supabaseAdmin
        .from('orders')
        .update({ payment_reference: transaction.id })
        .eq('id', orderId);
    }

    // PSE (y a veces Nequi) devuelven una URL para redirigir al usuario a su banco/app.
    const redirectUrl = transaction.payment_method?.extra?.async_payment_url || null;

    return res.status(200).json({ redirectUrl, transactionId: transaction.id, status: transaction.status });
  } catch (err) {
    console.error('Error creando pago local con Wompi:', err);
    return res.status(500).json({ error: 'No se pudo procesar el pago.' });
  }
}

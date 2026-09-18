// Función serverless: envía las métricas reales del negocio a la API de Claude
// (Anthropic) para que las analice con contexto de mercado del café de
// especialidad y devuelva recomendaciones concretas. Complementa —no
// reemplaza— las recomendaciones basadas en reglas que ya calcula el
// algoritmo de crecimiento (esas son deterministas y siempre disponibles;
// esta es la capa "inteligente" que entiende matices que las reglas no
// capturan, como tendencias de mercado).
//
// CÓMO USARLA
// 1) Crea una cuenta en https://console.anthropic.com y genera una API key
//    (Settings → API Keys). Esto factura por uso — NO es lo mismo que un
//    plan de Claude.ai/Claude Max, que es solo para chatear en la app; para
//    que un servidor llame al modelo automáticamente se necesita esta API key.
// 2) Guárdala como variable de entorno ANTHROPIC_API_KEY en tu hosting
//    (Vercel/Netlify) — nunca en el frontend.
// 3) (Opcional) Cambia el modelo si quieres uno más económico o más potente.

import { createClient } from '@supabase/supabase-js';

const MODEL = 'claude-sonnet-5';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no está configurada en el servidor.' });
  }

  try {
    const { metrics } = req.body || {};
    if (!metrics) {
      return res.status(400).json({ error: 'Faltan las métricas del negocio.' });
    }

    const systemPrompt = `Eres un consultor de crecimiento especializado en cafeterías y e-commerce de café de especialidad en Colombia y mercados internacionales. AceroPress vende bolsas de café de origen y equipo AeroPress, con canales de venta por web, WhatsApp, tarjeta (Stripe/Wompi) y mesas físicas (POS).

Te paso las métricas reales del negocio en JSON. Responde en español, en 3 a 5 puntos concretos y accionables (no genéricos), considerando:
- Tendencias actuales del mercado de café de especialidad (métodos de preparación en tendencia, formatos de empaque, sostenibilidad, trazabilidad de origen, suscripciones de café).
- Qué está pidiendo el mercado que estas métricas sugieren que el negocio no está capturando todavía.
- Prioriza por impacto: qué haría primero si solo pudiera hacer una cosa esta semana.

No repitas los números que ya te doy, interprétalos. Sé específico y breve (máximo 220 palabras).`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: JSON.stringify(metrics) }],
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      console.error('Error de la API de Claude:', data);
      return res.status(502).json({ error: 'El agente de IA no pudo responder.' });
    }

    const insight = data.content?.map((c) => c.text).filter(Boolean).join('\n') || 'Sin respuesta.';

    // Guarda el análisis en el historial (usa la service role para no
    // depender de que quien llama esté autenticado como admin en este contexto).
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      await supabaseAdmin.from('growth_ai_insights').insert({
        metrics_snapshot: metrics,
        insight,
        model: MODEL,
      });
    }

    return res.status(200).json({ insight, model: MODEL });
  } catch (err) {
    console.error('Error en el agente de crecimiento:', err);
    return res.status(500).json({ error: 'No se pudo completar el análisis.' });
  }
}

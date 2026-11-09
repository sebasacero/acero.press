// «Jefe de turno» de Micra (función serverless de Vercel, solo el owner).
//
// El equipo pregunta desde Equipo › Hoy («¿cómo vamos hoy?», «¿dónde buscan
// café?»). Claude responde usando las herramientas del servidor MCP de Micra
// (mcp/micra/), conectado en memoria y con la sesión de quien pregunta: la base
// vuelve a verificar el rol en cada lectura. No hay herramientas que escriban.
//
// CONFIGURACIÓN (Vercel → Environment Variables): ANTHROPIC_API_KEY,
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (las mismas de growth-agent.js).

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { askAgent, connectMicra } from '../mcp/micra/agent.js';
import { remoteSource } from '../mcp/micra/sources.js';

export const config = { maxDuration: 60 };

// Tope por usuario en la instancia: cada pregunta cuesta (ver «Deuda conocida» 4)
const RATE = { windowMs: 10 * 60_000, max: 30 };
const hits = new Map();
function limited(key) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE.windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE.max;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en Vercel.' });

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!jwt) return res.status(401).json({ error: 'Entra con tu cuenta del equipo.' });

  // Solo el owner: se comprueba antes de gastar una llamada al modelo
  const sb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });
  const { data: userData } = await sb.auth.getUser(jwt);
  const user = userData?.user;
  const { data: adminRow } = user ? await sb.from('admin_users').select('role').eq('auth_user_id', user.id).maybeSingle() : { data: null };
  if (adminRow?.role !== 'owner') return res.status(403).json({ error: 'El Jefe de turno es solo para el dueño.' });
  if (limited(user.id)) return res.status(429).json({ error: 'Muchas preguntas seguidas: espera unos minutos.' });

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const apiBase = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const { client: mcp, close } = await connectMicra(remoteSource({ apiBase, supabaseUrl, anonKey, token: jwt }));
  try {
    const out = await askAgent({ anthropic: new Anthropic(), mcp, question: req.body?.question, history: req.body?.history });
    return res.status(200).json(out);
  } catch (err) {
    console.error('micra-agent', err);
    const status = err.status && err.status < 500 ? err.status : 502;
    return res.status(status).json({ error: status === 400 ? err.message : 'El Jefe de turno no pudo responder. Intenta de nuevo.' });
  } finally {
    await close();
  }
}

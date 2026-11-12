// Celestra (antes «Jefe de turno»): la inteligencia de Micra, solo para el dueño.
//
// Dos pedidos desde Equipo › Hoy:
//   { question, history }   una pregunta («¿cómo vamos hoy?», «¿dónde buscan café?»)
//   { action: 'parte' }     el parte del día: resumen y 3 propuestas, una vez al día
// Claude responde con las herramientas del servidor MCP de Micra (mcp/micra/),
// conectado en memoria y con la sesión de quien pregunta: la base vuelve a
// verificar el rol en cada lectura. No hay herramientas que escriban en Micra;
// lo único que se escribe es la propia memoria de Celestra (celestra_guardar).
//
// Tope: US$50 al mes (TOPE_USD). Cada corrida se anota con lo que costó en
// celestra_runs (20261111200000_celestra.sql). Sin esa migración Celestra
// responde igual, pero no guarda el parte ni puede contar el tope: lo dice.
//
// CONFIGURACIÓN (Vercel → Environment Variables): ANTHROPIC_API_KEY,
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (las mismas de growth-agent.js).

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { askAgent, connectMicra, writeParte } from '../mcp/micra/agent.js';
import { remoteSource } from '../mcp/micra/sources.js';
import { TOPE_USD, cleanDecisions, overBudget } from '../mcp/micra/celestra.js';

export const config = { maxDuration: 120 };

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

const bogotaDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const runRow = (kind, out) => ({
  kind,
  model: out.model,
  input_tokens: out.usage?.input_tokens ?? 0,
  output_tokens: out.usage?.output_tokens ?? 0,
  cache_read_tokens: out.usage?.cache_read_input_tokens ?? 0,
  cache_write_tokens: out.usage?.cache_creation_input_tokens ?? 0,
  cost_usd: out.cost ?? 0,
  tools: out.tools ?? [],
});

// La app Micra instalada llama desde su propio origen (iOS: capacitor://localhost,
// Android: https://localhost), como en api/_acero/app.py. Va con el token en la
// cabecera, sin cookies. Sin esto el navegador del celular corta en la consulta
// previa (OPTIONS) y la tarjeta solo dice «Load failed».
const APP_ORIGINS = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);
function cors(req, res) {
  const origin = req.headers.origin;
  if (!APP_ORIGINS.has(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
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
  if (adminRow?.role !== 'owner') return res.status(403).json({ error: 'Celestra es solo para el dueño.' });

  // La memoria y el gasto del mes. Sin la migración: null y se sigue sin guardar.
  const { data: estado, error: estadoError } = await sb.rpc('celestra_estado');
  const saved = !estadoError && estado != null;
  const isParte = req.body?.action === 'parte';

  // El parte de hoy ya escrito no se vuelve a pagar
  if (isParte && saved && estado.parte) return res.status(200).json({ estado, saved: true });
  if (saved && overBudget(Number(estado.gastado_mes))) {
    return res.status(429).json({ error: `Celestra llegó al tope de US$${TOPE_USD} de este mes. Vuelve el 1.º del mes que viene.`, estado });
  }
  if (limited(user.id)) return res.status(429).json({ error: 'Muchas preguntas seguidas: espera unos minutos.' });

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const apiBase = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const { client: mcp, close } = await connectMicra(remoteSource({ apiBase, supabaseUrl, anonKey, token: jwt }));
  try {
    const anthropic = new Anthropic();
    const out = isParte
      ? await writeParte({ anthropic, mcp, today: bogotaDay(), decisions: saved ? estado.decisiones : cleanDecisions(req.body?.decisions) })
      : await askAgent({ anthropic, mcp, question: req.body?.question, history: req.body?.history });

    let after = null;
    if (saved) {
      const row = runRow(isParte ? 'parte' : 'pregunta', out);
      const { data, error } = await sb.rpc('celestra_guardar', { p: isParte ? { ...row, parte: out.parte } : row });
      if (error) console.error('celestra_guardar', error.message);
      else after = data;
    }
    const base = { tools: out.tools, model: out.model, cost: out.cost, saved: after != null, estado: after };
    return res.status(200).json(isParte ? { ...base, parte: out.parte } : { ...base, answer: out.answer });
  } catch (err) {
    console.error('celestra', err);
    const status = err.status && err.status < 500 ? err.status : 502;
    return res.status(status).json({ error: status === 400 ? err.message : 'Celestra no pudo responder. Intenta de nuevo.' });
  } finally {
    await close();
  }
}

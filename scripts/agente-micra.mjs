#!/usr/bin/env node
// Pregúntale a Celestra desde la terminal (demo del proyecto).
//
//   node scripts/agente-micra.mjs "¿Cómo vamos hoy y dónde buscan café?"
//   node scripts/agente-micra.mjs --parte        (el parte del día con 3 propuestas)
//
// Sin más variables lee los datos de demostración (mcp/micra/demo.json, sin red
// a Supabase); con MICRA_TOKEN (sesión del owner), los reales. Necesita
// ANTHROPIC_API_KEY o una sesión de `ant auth login`.

import Anthropic from '@anthropic-ai/sdk';
import { askAgent, connectMicra, writeParte } from '../mcp/micra/agent.js';
import { sourceFromEnv } from '../mcp/micra/sources.js';

const args = process.argv.slice(2);
const parte = args.includes('--parte');
const question = args.filter((a) => a !== '--parte').join(' ').trim();
if (!parte && !question) {
  console.error('Uso: node scripts/agente-micra.mjs "tu pregunta"  |  node scripts/agente-micra.mjs --parte');
  process.exit(1);
}

const { client: mcp, close } = await connectMicra(await sourceFromEnv());
try {
  const anthropic = new Anthropic();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const out = parte ? await writeParte({ anthropic, mcp, today }) : await askAgent({ anthropic, mcp, question });
  if (parte) {
    console.log(out.parte.resumen);
    out.parte.propuestas.forEach((p, i) => console.log(`\n${i + 1}. [${p.oficio}] ${p.titulo}\n   ${p.por_que}${p.accion ? `\n   Hoy: ${p.accion}` : ''}`));
  } else {
    console.log(out.answer);
  }
  console.error(`\n— ${out.model} · US$${out.cost.toFixed(4)} · herramientas MCP: ${out.tools.join(', ') || 'ninguna'}`);
} catch (err) {
  console.error(`No se pudo: ${err.message}`);
  process.exitCode = 1;
} finally {
  await close();
}

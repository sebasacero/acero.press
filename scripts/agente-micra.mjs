#!/usr/bin/env node
// Pregúntale al Jefe de turno desde la terminal (demo del proyecto).
//
//   node scripts/agente-micra.mjs "¿Cómo vamos hoy y dónde buscan café?"
//
// Sin más variables lee los datos de demostración (mcp/micra/demo.json, sin red
// a Supabase); con MICRA_TOKEN (sesión del owner), los reales. Necesita
// ANTHROPIC_API_KEY o una sesión de `ant auth login`.

import Anthropic from '@anthropic-ai/sdk';
import { askAgent, connectMicra } from '../mcp/micra/agent.js';
import { sourceFromEnv } from '../mcp/micra/sources.js';

const question = process.argv.slice(2).join(' ').trim();
if (!question) {
  console.error('Uso: node scripts/agente-micra.mjs "tu pregunta"');
  process.exit(1);
}

const { client: mcp, close } = await connectMicra(await sourceFromEnv());
try {
  const { answer, tools, model } = await askAgent({ anthropic: new Anthropic(), mcp, question });
  console.log(answer);
  console.error(`\n— ${model} · herramientas MCP: ${tools.join(', ') || 'ninguna'}`);
} catch (err) {
  console.error(`No se pudo: ${err.message}`);
  process.exitCode = 1;
} finally {
  await close();
}

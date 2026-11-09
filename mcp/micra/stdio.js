#!/usr/bin/env node
// Servidor MCP de Micra por stdio, para Claude Code (ver .mcp.json) o Claude Desktop.
//
//   Demo sin red:   node mcp/micra/stdio.js            (lee mcp/micra/demo.json)
//   Otro JSON:      MICRA_MCP_DATA=ruta.json node mcp/micra/stdio.js
//   Producción:     MICRA_TOKEN=<sesión del owner> VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… node mcp/micra/stdio.js
// Por stdout solo viaja el protocolo: los avisos van a stderr.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMicraServer } from './server.js';
import { sourceFromEnv } from './sources.js';

try {
  const server = createMicraServer(await sourceFromEnv());
  await server.connect(new StdioServerTransport());
  const { MICRA_MCP_DATA: file, MICRA_TOKEN: token } = process.env;
  console.error(`micra-mcp listo (${file ? `datos de ${file}` : token ? 'datos reales' : 'datos de demostración'})`);
} catch (err) {
  console.error(`micra-mcp no arrancó: ${err.message}`);
  process.exit(1);
}

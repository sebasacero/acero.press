// Servidor MCP de Micra. El mismo objeto sirve por stdio (Claude Code, Claude
// Desktop) y en memoria (el agente de api/micra-agent.js): ambos hablan MCP.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, callTool } from './tools.js';

export const SERVER_INFO = { name: 'micra', version: '1.0.0' };

const INSTRUCTIONS =
  'Datos de Micra (ACERO.press) para Celestra: estudio de mercado del café de la calle en Bogotá y las encuestas que faltan, ' +
  'mapa en vivo de baristas, el día del equipo, los apartados (notas, precio pagado, tiempos), el precio del café y las ' +
  'fincas en internet. Todo es de solo lectura. Las cifras traen su n: con pocas respuestas, dilo en vez de sacar ' +
  'conclusiones. En lo público se dice «barista», no «tintero».';

/** @param {{ piloto(days:number):Promise<any>, liveMap(min:number):Promise<any>, ownerDay():Promise<any>, pulse():Promise<any>, holdRatings():Promise<any>, holdTimes(days:number):Promise<any>, fincas():Promise<any> }} source */
export function createMicraServer(source) {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} }, instructions: INSTRUCTIONS });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(({ name, title, description, inputSchema }) => ({
      name, title, description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: false },
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => callTool(source, req.params.name, req.params.arguments));
  return server;
}

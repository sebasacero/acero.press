---
name: herramienta-mcp
description: Agrega o cambia una herramienta del servidor MCP de Micra (mcp/micra/) para que la usen el Jefe de turno y Claude Code. Úsala cuando pidan que el agente «sepa» algo nuevo de Micra.
---

# Nueva herramienta en el MCP de Micra

El servidor (`mcp/micra/server.js`) solo publica lo que está en `TOOLS` de `mcp/micra/tools.js`; el agente (`mcp/micra/agent.js`) y Claude Code (`.mcp.json`) leen esa misma lista.

1. **Solo lectura.** Si lo nuevo escribe en la base, no va aquí: va en una función SQL transaccional con su pantalla en la app (ver CLAUDE.md › Convenciones).
2. **De dónde sale el dato.** Agrega un método a las fuentes de `mcp/micra/sources.js`: en `remoteSource` por una RPC de Supabase (`rpc('micra_…')`) o la API de Acero (`/api/v1/bi/…`) con el token de quien pregunta, nunca con la service key; y en `memorySource` con su clave en `mcp/micra/demo.json`.
3. **La herramienta.** En `TOOLS`: `name` en snake_case y en español, `description` que diga cuándo usarla, `inputSchema` con `additionalProperties: false`, y `run(source, args)` que recorta: nombres de pila, nada de puntos exactos de personas, grupos de menos de 5 ocultos.
4. **Prueba** en `mcp/micra/micra.test.js` con la demo: la forma de la salida y que no salgan datos privados. El hook `.claude/hooks/test-pure.mjs` la corre sola al guardar, si está activado.
5. **El agente.** Nombra la herramienta en `SYSTEM_PROMPT` de `agent.js` y en `TOOL_LABEL` de `src/features/micra-app/JefeDeTurno.jsx`.
6. Corre `npm test`, `npm run build` y `npm run e2e` antes de dar por terminado.

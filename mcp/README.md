# Jefe de turno: un agente de Micra con API, MCP y Claude Code

Proyecto final. Un agente que le responde al equipo de Micra (la app de
ACERO.press para quienes venden café en la calle en Bogotá) preguntas como
«¿cómo vamos hoy?», «¿dónde buscan café ahora?» o «¿qué dice el estudio del
precio del tinto?», con datos reales y sin poder cambiar nada.

```
            ┌──────────── Claude Code (.mcp.json, skills, hook) ───────────┐
            │                                                              │
  Equipo › Hoy ──► /api/micra-agent ──► API de Claude (Tool Runner)        │
  (JefeDeTurno.jsx)        │                    │ tool_use                 │
                           │                    ▼                          ▼
                           └──► cliente MCP ──► servidor MCP «micra» ◄── stdio
                                (en memoria)    (mcp/micra/server.js)
                                                    │ solo lectura, con la sesión del owner
                                                    ▼
                                    Supabase (RPC micra_*) · API de Acero (/api/v1)
```

## Las tres piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| **API de Claude** | `mcp/micra/agent.js`, `api/micra-agent.js` | `client.beta.messages.toolRunner` con `claude-opus-5-5`, pensamiento adaptativo y respaldo del servidor si el modelo se niega. El SDK corre el ciclo pedir → usar herramienta → seguir. |
| **MCP** | `mcp/micra/server.js`, `tools.js`, `sources.js`, `stdio.js` | Servidor MCP propio con 4 herramientas de solo lectura. El agente lo usa como **cliente MCP** (transporte en memoria, convertido con `mcpTools` del SDK de Anthropic); Claude Code lo usa por **stdio**. Es el mismo servidor. |
| **Claude Code** | `CLAUDE.md`, `.mcp.json`, `.claude/skills/`, `.claude/hooks/` | El repo ya trae el servidor MCP conectado, dos skills (`informe-estudio`, `herramienta-mcp`) y un hook que corre las pruebas del módulo que se edita. |

### Herramientas del servidor MCP

| Herramienta | Lee | Recorta |
|---|---|---|
| `estudio_resumen` | `/api/v1/bi/piloto` → `buildReport` (el mismo del informe imprimible) | sin nombres, sin puntos uno a uno, sin el nombre del aliado; cada cifra con su n y grupos de menos de 5 ocultos |
| `mapa_en_vivo` | RPC `micra_live_map` | nombre de pila; zonas de ~440 m con 2 señales o más, nunca puntos de personas |
| `dia_del_equipo` | RPC `micra_owner_day` | nombre de pila; tazas, plata, apartados, semana |
| `precio_cafe` | `/api/v1/pulse` | carga FNC, bolsa de NY, dólar con su cambio; clima de Bogotá |

Seguridad: el agente lee con la sesión de quien pregunta, así que la base
vuelve a verificar el rol en cada llamada (el MCP no salta RLS). La función
`api/micra-agent.js` verifica que sea el owner antes de gastar una llamada al
modelo y tiene un tope de 30 preguntas cada 10 minutos. Ninguna herramienta
escribe.

## Probarlo

```bash
npm install
npm test                                   # incluye mcp/micra/micra.test.js (11 pruebas)
npx playwright test e2e/micra-app/jefe.spec.js

# El servidor MCP solo (datos de demostración, sin red):
npm run mcp

# El agente desde la terminal (necesita ANTHROPIC_API_KEY):
npm run agente -- "¿Cómo vamos hoy y dónde buscan café?"
```

Sin `MICRA_TOKEN` todo usa `mcp/micra/demo.json`. Con datos reales:
`MICRA_TOKEN` (el `access_token` de la sesión del owner), `VITE_SUPABASE_URL`
y `VITE_SUPABASE_ANON_KEY`; `MICRA_API_BASE` si la API no es
`https://www.aceropress.com`. En la app: Micra › Equipo › Hoy › «Jefe de turno».

### En Claude Code

Al abrir el repo, Claude Code ofrece activar el servidor `micra` de
`.mcp.json` (o `/mcp`). Luego: «arma el informe de hoy» usa la skill
`informe-estudio`; «que el agente sepa X» usa `herramienta-mcp`.

El hook de pruebas (`.claude/hooks/test-pure.mjs`) se activa agregando esto a
`.claude/settings.json` (es un cambio de configuración de Claude Code, así que
lo decide el dueño del repo):

```json
{
  "enabledMcpjsonServers": ["micra"],
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/test-pure.mjs\"", "timeout": 60 }]
      }
    ]
  }
}
```

## Límites

- El agente no escribe: para registrar ventas o mover baristas está la app.
- El servidor MCP no se publica en internet todavía (el conector MCP de la
  API necesitaría una URL pública con su propia autenticación).
- Sin datos suficientes en el estudio, el agente lo dice en vez de concluir.

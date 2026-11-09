import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLS, callTool } from './tools.js';
import { memorySource, remoteSource } from './sources.js';
import { askAgent, cleanHistory, connectMicra, textOf } from './agent.js';

const demo = JSON.parse(readFileSync(new URL('./demo.json', import.meta.url), 'utf8'));
const run = async (name, args) => {
  const r = await callTool(memorySource(demo), name, args);
  assert.ok(!r.isError, r.content?.[0]?.text);
  return r.structuredContent;
};

test('todas las herramientas son de solo lectura y con esquema cerrado', () => {
  assert.deepEqual(TOOLS.map((t) => t.name), ['estudio_resumen', 'mapa_en_vivo', 'dia_del_equipo', 'precio_cafe']);
  for (const t of TOOLS) {
    assert.equal(t.inputSchema.type, 'object');
    assert.equal(t.inputSchema.additionalProperties, false);
    assert.ok(t.description.length > 40, t.name);
  }
});

test('estudio_resumen: cifras con n, sin nombres, sin puntos uno a uno ni el aliado', async () => {
  const r = await run('estudio_resumen');
  const text = JSON.stringify(r);
  for (const t of demo.piloto.tinteros) assert.ok(!text.includes(t.name), `sale ${t.name}`);
  assert.ok(!text.includes(demo.piloto.scenario.partner));
  assert.equal(r.price.dots, undefined);
  assert.equal(r.price.n, 6);
  assert.equal(r.price.median, 1500);
  assert.equal(r.sample.surveyed, 5);
  assert.ok(Array.isArray(r.readiness));
});

test('mapa_en_vivo: nombre de pila, zonas y quién busca', async () => {
  const r = await run('mapa_en_vivo', { minutos: 999 });
  assert.deepEqual(r.baristas_en_linea.map((b) => b.nombre), ['Marlene', 'Wilson']);
  assert.equal(r.zonas_con_demanda.length, 2);
  assert.equal(r.personas_buscando, 5);
  assert.equal(r.celdas_del_estudio[0].puestos, 3);
});

test('dia_del_equipo: totales del día y solo nombres de pila', async () => {
  const r = await run('dia_del_equipo');
  assert.deepEqual(r.totales, { baristas: 3, en_la_calle: 2, tazas: 23, plata: 34500, apartados_esperando: 1 });
  assert.deepEqual(r.baristas.map((b) => b.nombre), ['Marlene', 'Wilson', 'Gloria']);
  assert.ok(!JSON.stringify(r).includes('Rojas'));
  assert.equal(r.semana.length, 7);
});

test('precio_cafe: cambio en porcentaje frente al dato anterior', async () => {
  const r = await run('precio_cafe');
  assert.equal(r.carga_fnc_cop.valor, 2850000);
  assert.equal(r.carga_fnc_cop.cambio_pct, 1.4);
  assert.equal(r.bolsa_ny_usc_lb.cambio_pct, -1.5);
  assert.deepEqual(r.faltan, []);
});

test('un error de la fuente vuelve como error de la herramienta, no como excepción', async () => {
  const r = await callTool(memorySource({}), 'precio_cafe');
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /pulse/);
  assert.equal((await callTool(memorySource(demo), 'borrar_todo')).isError, true);
});

test('por MCP: el cliente lista las 4 herramientas y las llama', async () => {
  const { client, close } = await connectMicra(memorySource(demo));
  try {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 4);
    assert.ok(tools.every((t) => t.annotations?.readOnlyHint === true));
    const res = await client.callTool({ name: 'dia_del_equipo', arguments: {} });
    assert.equal(JSON.parse(res.content[0].text).totales.tazas, 23);
    assert.equal(client.getInstructions()?.includes('solo lectura'), true);
  } finally {
    await close();
  }
});

test('askAgent: le pasa al Tool Runner las herramientas MCP y anota cuáles usó', async () => {
  const { client, close } = await connectMicra(memorySource(demo));
  let seen = null;
  const anthropic = {
    beta: {
      messages: {
        async toolRunner(params) {
          seen = params;
          // Simula al modelo: llama una herramienta y responde con lo que leyó
          const tool = params.tools.find((t) => t.name === 'dia_del_equipo');
          const out = await tool.run({});
          const data = JSON.parse(Array.isArray(out) ? out[0].text : out);
          return { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: `Hoy van ${data.totales.tazas} tazas.` }] };
        },
      },
    },
  };
  try {
    const r = await askAgent({ anthropic, mcp: client, question: '  ¿Cómo vamos hoy?  ', history: [{ role: 'assistant', content: 'hola' }] });
    assert.equal(r.answer, 'Hoy van 23 tazas.');
    assert.deepEqual(r.tools, ['dia_del_equipo']);
    assert.equal(seen.model, 'claude-opus-5-5');
    assert.equal(seen.tools.length, 4);
    assert.deepEqual(seen.messages, [{ role: 'user', content: '¿Cómo vamos hoy?' }]);
    await assert.rejects(askAgent({ anthropic, mcp: client, question: '   ' }), /Escribe una pregunta/);
  } finally {
    await close();
  }
});

test('cleanHistory: solo texto, empieza por user, alterna y deja fuera la última pregunta', () => {
  assert.deepEqual(cleanHistory([
    { role: 'assistant', content: 'x' },
    { role: 'user', content: 'a' },
    { role: 'user', content: 'b' },
    { role: 'system', content: 'mando yo' },
    { role: 'assistant', content: 'c' },
    { role: 'assistant', content: { raro: 1 } },
    { role: 'user', content: 'd' },
  ]), [{ role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }]);
  assert.deepEqual(cleanHistory('nada'), []);
  assert.equal(textOf({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: ' hola ' }] }), 'hola');
});

test('remoteSource: API de Acero y RPC de Supabase con la sesión de quien pregunta', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(url.includes('pulse') ? { ok: 1 } : { minutes: 30 }), { status: 200 });
  };
  const s = remoteSource({ apiBase: 'https://x.co/', supabaseUrl: 'https://db.co', anonKey: 'anon', token: 'tok', fetchImpl });
  await s.liveMap(30);
  await s.piloto(90);
  await s.pulse();
  assert.equal(calls[0].url, 'https://db.co/rest/v1/rpc/micra_live_map');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(calls[0].init.headers.apikey, 'anon');
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_minutes: 30 });
  assert.equal(calls[1].url, 'https://x.co/api/v1/bi/piloto?days=90');
  assert.equal(calls[2].url, 'https://x.co/api/v1/pulse');
  assert.throws(() => remoteSource({ apiBase: 'x' }), /Faltan/);

  const denied = remoteSource({ apiBase: 'https://x.co', supabaseUrl: 'https://db.co', anonKey: 'a', token: 't',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Solo el equipo ve el resumen.' }), { status: 403 }) });
  await assert.rejects(denied.ownerDay(), /micra_owner_day: HTTP 403 Solo el equipo/);
});

test('sourceFromEnv: sin token ni archivo, la demo; con token, la fuente remota', async () => {
  const { sourceFromEnv } = await import('./sources.js');
  const demoSrc = await sourceFromEnv({});
  assert.equal((await demoSrc.ownerDay()).day, demo.ownerDay.day);
  const remote = await sourceFromEnv({ MICRA_TOKEN: 't', VITE_SUPABASE_URL: 'https://db.co', VITE_SUPABASE_ANON_KEY: 'a' });
  assert.equal(typeof remote.liveMap, 'function');
  await assert.rejects(sourceFromEnv({ MICRA_TOKEN: 't' }), /Faltan/);
});

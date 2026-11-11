// Celestra: la inteligencia de Micra para el equipo (antes «Jefe de turno»).
//
// Lógica pura, sin red: el tope de gasto, el costo de cada corrida, el pedido
// del parte diario, cómo se lee lo que el modelo devuelve y la memoria de lo
// que el dueño aprobó o descartó. La usan api/micra-agent.js, agent.js y la
// tarjeta de la app (Celestra.jsx).

export const NAME = 'Celestra';

// Tope que puso el dueño (11 nov 2026): hasta US$50 al mes en la API
export const TOPE_USD = 50;

// US$ por millón de tokens. La escritura en caché (5 min) cuesta 1,25 veces la entrada.
export const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};
const DEFAULT_PRICE = PRICES['claude-opus-5-5'];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Suma el uso de una respuesta al acumulado (el Tool Runner hace varias llamadas por pregunta). */
export function addUsage(acc = {}, u = {}) {
  return {
    input_tokens: num(acc.input_tokens) + num(u?.input_tokens),
    output_tokens: num(acc.output_tokens) + num(u?.output_tokens),
    cache_read_input_tokens: num(acc.cache_read_input_tokens) + num(u?.cache_read_input_tokens),
    cache_creation_input_tokens: num(acc.cache_creation_input_tokens) + num(u?.cache_creation_input_tokens),
  };
}

/** Lo que costó, en dólares, con 4 decimales. Un modelo sin precio conocido se cobra como Opus 5.5. */
export function costUsd(usage = {}, model = '') {
  const p = PRICES[model] ?? DEFAULT_PRICE;
  const usd = (num(usage.input_tokens) * p.input + num(usage.output_tokens) * p.output
    + num(usage.cache_read_input_tokens) * p.cacheRead + num(usage.cache_creation_input_tokens) * p.cacheWrite) / 1e6;
  return Math.round(usd * 10000) / 10000;
}

/** ¿Ya se gastó el tope del mes? Sin cifra (sin la migración) no se puede saber: no frena. */
export const overBudget = (spent, tope = TOPE_USD) => spent != null && Number.isFinite(Number(spent)) && Number(spent) >= tope;

// ---------- El parte del día ----------

export const OFICIOS = ['estudio', 'calle', 'clientes', 'mercado', 'fincas', 'equipo'];
export const ESTADOS = ['pendiente', 'aprobada', 'descartada', 'hecha'];
export const PARTE_PROPUESTAS = 3;
const LIMITS = { resumen: 400, titulo: 90, por_que: 260, accion: 220, nota: 200 };

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Lo aprobado o descartado antes, limpio y corto, para que no se repita (máx. 20, lo último primero). */
export function cleanDecisions(list) {
  return (Array.isArray(list) ? list : [])
    .filter((d) => d && ['aprobada', 'descartada', 'hecha'].includes(d.estado) && clip(d.titulo, 1))
    .map((d) => ({ dia: clip(d.dia, 10) || null, titulo: clip(d.titulo, LIMITS.titulo), estado: d.estado, nota: clip(d.nota, LIMITS.nota) || null }))
    .slice(0, 20);
}

/** El pedido del parte: qué leer y el JSON que debe devolver. */
export function partePrompt({ today, decisions = [] } = {}) {
  const memory = cleanDecisions(decisions);
  const lines = memory.length
    ? memory.map((d) => `- ${d.dia ?? 's/f'} · ${d.estado}: ${d.titulo}${d.nota ? ` (nota del dueño: ${d.nota})` : ''}`).join('\n')
    : '- Todavía no hay decisiones anteriores.';
  return `Escribe el parte de hoy${today ? ` (${today})` : ''} para el dueño.

Lee con las herramientas lo que necesites; como mínimo: dia_del_equipo, encuestas_pendientes y apartados. Mira el mapa, el precio del café o las fincas si te sirven para una propuesta.

Lo que el dueño decidió en partes anteriores (no repitas lo descartado si no hay un dato nuevo; lo aprobado y no hecho puedes recordarlo):
${lines}

Devuelve SOLO un objeto JSON, sin texto antes ni después, con esta forma:
{"resumen": "2 o 3 frases: cómo va Micra hoy, con cifras y su n",
 "propuestas": [{"oficio": "${OFICIOS.join('|')}", "titulo": "qué hacer, empieza con un verbo, máx. 70 caracteres", "por_que": "una frase con la cifra que lo sostiene y su n", "accion": "el primer paso concreto para hoy"}]}

Exactamente ${PARTE_PROPUESTAS} propuestas, de la más útil a la menos. Si un dato falta o tiene n menor que 5, una propuesta puede ser medirlo. Nada de nombres de baristas del estudio ni de aliados.`;
}

/** Saca el primer objeto JSON del texto (tolera ```json``` y texto alrededor). */
function firstJson(text) {
  const s = String(text ?? '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (inStr) {
      if (ch === '\\') i += 1;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/** Lee el parte que escribió el modelo. Lanza si no trae resumen ni una propuesta válida. */
export function parseParte(text) {
  const raw = firstJson(text);
  const resumen = clip(raw?.resumen, LIMITS.resumen);
  const propuestas = (Array.isArray(raw?.propuestas) ? raw.propuestas : [])
    .map((p) => ({
      oficio: OFICIOS.includes(p?.oficio) ? p.oficio : 'equipo',
      titulo: clip(p?.titulo, LIMITS.titulo),
      por_que: clip(p?.por_que, LIMITS.por_que),
      accion: clip(p?.accion, LIMITS.accion) || null,
    }))
    .filter((p) => p.titulo && p.por_que)
    .slice(0, PARTE_PROPUESTAS);
  if (!resumen || propuestas.length === 0) throw Object.assign(new Error('Celestra no devolvió un parte que se pueda leer.'), { status: 502 });
  return { resumen, propuestas };
}

/** Lo que manda la tarjeta al decidir: estado válido y nota corta. */
export function cleanDecision({ estado, nota } = {}) {
  if (!ESTADOS.includes(estado) || estado === 'pendiente') throw Object.assign(new Error('Estado no válido.'), { status: 400 });
  return { estado, nota: clip(nota, LIMITS.nota) || null };
}

// Emparejamiento automático receta → café + kit, sin IA.
//
// Regla de la página (determinista y explicable): de la receta campeona se
// extraen variedad, origen, proceso y perfil de sabor del café original; de
// cada café del catálogo, su variedad, región y perfil. Gana el que más se
// parece (variedad igual > perfil > proceso > origen), con una penalización
// para que no todas las recetas recomienden el mismo café.
//
// Prioridad final de cada receta (useRecipePairings, panel y barista):
//   1. manual  → lo que eligió el dueño en Panel → Recetas
//   2. agent   → lo que ajustó el agente de crecimiento con ventas y mercado
//   3. auto    → esta regla
//
// Funciona en el navegador y en las funciones de Vercel (ESM puro).

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Variedad canónica ← cómo puede aparecer escrita.
const VARIETIES = {
  gesha: ['gesha', 'geisha'],
  sidra: ['sidra'],
  'bourbon rosado': ['bourbon rosado', 'pink bourbon', 'bourbon rojo rayado'],
  'bourbon aji': ['bourbon aji', 'aji'],
  chiroso: ['chiroso'],
  castillo: ['castillo'],
  caturra: ['caturra'],
  bourbon: ['bourbon'],
  typica: ['typica', 'tipica'],
  sl28: ['sl28', 'sl34', 'kenia ab', 'kenya ab'],
  heirloom: ['heirloom', 'landrace'],
};

// Perfil de sabor por variedad (lo que se espera en taza).
const VARIETY_PROFILE = {
  gesha: ['floral', 'delicado'],
  sidra: ['floral', 'frutal'],
  'bourbon rosado': ['frutal', 'brillante'],
  'bourbon aji': ['frutal', 'dulce'],
  chiroso: ['floral', 'frutal'],
  castillo: ['balanceado', 'dulce'],
  caturra: ['balanceado', 'dulce'],
  bourbon: ['dulce', 'balanceado'],
  typica: ['dulce', 'balanceado'],
  sl28: ['frutal', 'brillante'],
  heirloom: ['floral', 'brillante'],
};

// Perfil por origen y palabras de cata.
const ORIGIN_PROFILE = {
  kenia: ['frutal', 'brillante'], kenya: ['frutal', 'brillante'], kenyano: ['frutal', 'brillante'],
  etiopia: ['floral', 'brillante'], ethiopia: ['floral', 'brillante'],
  colombia: ['balanceado', 'dulce'], guatemala: ['dulce', 'balanceado'], ecuador: ['floral', 'dulce'],
  panama: ['floral', 'delicado'], 'el salvador': ['dulce', 'balanceado'],
};
const NOTE_PROFILE = [
  [/flor|floral|jazmin|te negro|elegante/, 'floral'],
  [/frut|cassis|frutos rojos|baya|berry|uva|cereza/, 'frutal'],
  [/acidez|brillante|citric|malic|limon/, 'brillante'],
  [/dulz|dulce|caramel|panela|miel|chocolate/, 'dulce'],
  [/balance|redondo|suave/, 'balanceado'],
  [/delicad|limpio|clean/, 'delicado'],
];
const PROCESSES = [
  [/anaerob/, 'anaerobico'], [/natural/, 'natural'], [/honey|miel/, 'honey'], [/lavad|washed/, 'lavado'],
];
const PROCESS_PROFILE = { natural: ['frutal', 'dulce'], anaerobico: ['frutal'], honey: ['dulce'], lavado: ['brillante', 'delicado'] };
const COLOMBIAN_REGIONS = ['huila', 'narino', 'antioquia', 'cauca', 'tolima', 'santander', 'quindio', 'caldas', 'risaralda', 'cundinamarca', 'boyaca', 'valle', 'sierra nevada'];

function varietiesIn(text) {
  const t = norm(text);
  const found = [];
  for (const [canon, names] of Object.entries(VARIETIES)) {
    if (names.some((n) => new RegExp(`\\b${n}\\b`).test(t))) found.push(canon);
  }
  // "bourbon" suelto no cuenta si ya hay un bourbon más específico.
  return found.filter((v) => !(v === 'bourbon' && found.some((x) => x.startsWith('bourbon '))));
}

function profileOf(text, varieties, process) {
  const t = norm(text);
  const set = new Set();
  varieties.forEach((v) => (VARIETY_PROFILE[v] ?? []).forEach((p) => set.add(p)));
  for (const [origin, prof] of Object.entries(ORIGIN_PROFILE)) if (t.includes(origin)) prof.forEach((p) => set.add(p));
  for (const [re, p] of NOTE_PROFILE) if (re.test(t)) set.add(p);
  (PROCESS_PROFILE[process] ?? []).forEach((p) => set.add(p));
  return set;
}

/** Rasgos del café original de una receta campeona. */
export function recipeTraits(recipe) {
  const text = recipe.coffee?.es ?? '';
  const t = norm(text);
  const varieties = varietiesIn(text);
  const process = PROCESSES.find(([re]) => re.test(t))?.[1] ?? null;
  const origin = Object.keys(ORIGIN_PROFILE).find((o) => t.includes(o)) ?? null;
  const region = COLOMBIAN_REGIONS.find((r) => t.includes(r)) ?? null;
  const temp = parseInt(recipe.temp, 10) || null;
  const profile = profileOf(text, varieties, process);
  // Agua baja (≤ 85 °C) suele buscar perfiles delicados y florales.
  if (temp && temp <= 85) profile.add('delicado');
  return { varieties, process, origin, region, profile, text };
}

/** Rasgos de un café del catálogo (forma de catalog.js). */
export function productTraits(p) {
  const text = [p.variety, p.name, p.description, p.region].filter(Boolean).join(' · ');
  const t = norm(text);
  const varieties = varietiesIn([p.variety, p.name].filter(Boolean).join(' '));
  const process = PROCESSES.find(([re]) => re.test(norm(p.description)))?.[1] ?? null;
  const region = norm(p.region) || null;
  // Café propio o sin región declarada: se asume colombiano (la tienda es de Bogotá).
  const colombian = !p.brand || COLOMBIAN_REGIONS.some((r) => t.includes(r)) || t.includes('colombia');
  return { varieties, process, region, colombian, profile: profileOf(text, varieties, process) };
}

const ORIGIN_NAME = { kenia: 'Kenia', kenya: 'Kenia', kenyano: 'Kenia', etiopia: 'Etiopía', ethiopia: 'Etiopía', colombia: 'Colombia', guatemala: 'Guatemala', ecuador: 'Ecuador', panama: 'Panamá', 'el salvador': 'El Salvador' };
const PROCESS_NAME = { lavado: 'lavado', natural: 'natural', honey: 'honey', anaerobico: 'con fermentación anaeróbica' };
const PROFILE_WORD = { floral: 'floral', frutal: 'frutal', brillante: 'de acidez brillante', dulce: 'dulce', balanceado: 'balanceado', delicado: 'delicado' };

function scorePair(rt, pt) {
  let score = 0;
  const why = [];
  const sameVariety = rt.varieties.find((v) => pt.varieties.includes(v));
  if (sameVariety) { score += 60; why.push('variety'); }
  const shared = [...rt.profile].filter((x) => pt.profile.has(x));
  if (rt.profile.size) score += Math.round((30 * shared.length) / rt.profile.size);
  if (rt.process && rt.process === pt.process) { score += 10; why.push('process'); }
  if (rt.region && pt.region && pt.region.includes(rt.region)) { score += 15; why.push('region'); }
  else if (rt.origin === 'colombia' && pt.colombian) { score += 8; why.push('origin'); }
  return { score, sameVariety, shared };
}

function noteFor(recipe, product, { sameVariety, shared }, rt) {
  if (sameVariety) {
    return `La misma variedad que usó ${recipe.name}: ${product.variety || product.name}${rt.process ? `, como su café ${PROCESS_NAME[rt.process]}` : ''}.`;
  }
  const words = shared.slice(0, 2).map((w) => PROFILE_WORD[w]);
  const origin = rt.origin ? ` como el café de ${ORIGIN_NAME[rt.origin]} que usó el campeón` : ' como el café que usó el campeón';
  return words.length
    ? `Perfil ${words.join(' y ')}${origin}.`
    : `Nuestra mejor opción de la tienda para el estilo de esta receta.`;
}

const isFilter = (p) => /filtro|filter|papel|paper/i.test(`${p.name} ${p.description ?? ''}`);
const isFlowControl = (p) => /flow control/i.test(`${p.name} ${p.description ?? ''}`);
/** El equipo principal (la prensa) va al kit desmarcado: muchos clientes ya la tienen. */
export const isDevice = (p) => /aeropress/i.test(p.name) && !isFilter(p) && !/tapa|cap|accesori|repuesto/i.test(p.name);

/** Extras del kit según la receta: filtros siempre, Flow Control si la receta lo usa, la prensa como opción. */
export function kitFor(recipe, gear) {
  const text = norm(recipe.equipment?.map((e) => e.value?.es).join(' '));
  const out = [];
  const filters = gear.filter(isFilter).sort((a, b) => minPrice(a) - minPrice(b));
  if (filters[0]) out.push(filters[0]);
  if (text.includes('flow control')) gear.filter(isFlowControl).slice(0, 1).forEach((p) => out.push(p));
  const device = gear.filter(isDevice).sort((a, b) => minPrice(a) - minPrice(b))[0];
  if (device) out.push(device);
  return [...new Set(out)];
}

function minPrice(p) {
  const vals = Object.values(p.prices ?? {}).filter((n) => n != null);
  return vals.length ? Math.min(...vals) : Infinity;
}

/**
 * Empareja todas las recetas con el catálogo de una vez (así se reparte
 * entre cafés). Devuelve { [año]: { coffee, size, extras, note, source: 'auto', score } }.
 */
export function autoPairAll(recipes, coffees, gear = []) {
  const out = {};
  if (!coffees.length) return out;
  const traits = new Map(coffees.map((p) => [p.id, productTraits(p)]));
  const uses = new Map();
  // Primero las recetas con más pistas (variedad o perfil), para que elijan antes.
  const ordered = recipes
    .map((r) => ({ r, rt: recipeTraits(r) }))
    .sort((a, b) => (b.rt.varieties.length * 10 + b.rt.profile.size) - (a.rt.varieties.length * 10 + a.rt.profile.size) || b.r.year - a.r.year);

  for (const { r, rt } of ordered) {
    let best = null;
    for (const p of coffees) {
      const s = scorePair(rt, traits.get(p.id));
      // Reparto: cada uso previo resta un poco, sin llegar a imponerse a un buen parecido.
      const total = s.score - 6 * (uses.get(p.id) ?? 0);
      if (!best || total > best.total || (total === best.total && minPrice(p) < minPrice(best.p))) best = { p, s, total };
    }
    uses.set(best.p.id, (uses.get(best.p.id) ?? 0) + 1);
    const size = best.p.sizes?.find((x) => x === '250G') ?? best.p.sizes?.find((x) => best.p.prices[x] != null) ?? best.p.sizes?.[0];
    out[r.year] = {
      coffee: best.p,
      size,
      extras: kitFor(r, gear),
      note: noteFor(r, best.p, best.s, rt),
      source: 'auto',
      score: best.s.score,
    };
  }
  return out;
}

/**
 * Emparejamiento efectivo de cada receta: filas guardadas (manual o agente)
 * sobre la regla automática. `rows` son filas de recipe_pairings.
 */
export function resolvePairings(recipes, coffees, gear, rows = []) {
  const out = autoPairAll(recipes, coffees, gear);
  const byUuid = Object.fromEntries([...coffees, ...gear].map((p) => [p.uuid, p]));
  for (const r of rows) {
    const coffee = byUuid[r.coffee_id];
    if (!coffee || !out[r.recipe_year]) continue; // café oculto o borrado: queda la regla
    out[r.recipe_year] = {
      coffee,
      size: coffee.prices[r.coffee_size] != null ? r.coffee_size : coffee.sizes[0],
      extras: (r.kit_ids ?? []).map((id) => byUuid[id]).filter(Boolean),
      note: r.note ?? null,
      source: r.source ?? 'manual',
    };
  }
  return out;
}

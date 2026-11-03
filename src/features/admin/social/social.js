// Redes: lógica pura del panel (sin React ni Supabase), con tests al lado.
//
// Analizar: toma los posts de Instagram (tabla ig_media, o el CSV que exporta
// Meta Business Suite cuando la sincronización no ha corrido) y responde qué
// formato, qué pilar y qué día/hora funcionan, siempre con su n.
// Crear: arma la semana de contenido del plan (5 cortos + 1 carrusel +
// historias) con ideas concretas: gancho, guion de tomas, texto y hashtags.
//
// Por qué «por alcance»: Instagram dijo (Mosseri, 2025) que sus señales más
// fuertes son el tiempo de vista, los envíos por alcance y los me gusta por
// alcance. La sincronización no trae tiempo de vista, así que el puntaje pesa
// compartidos y guardados sobre alcance; los totales solos premian al post que
// tuvo suerte con la distribución.

export const MIN_N = 3; // menos de esto por grupo no se compara: se dice «faltan datos»

// ── Formatos ────────────────────────────────────────────────────────────
export const FORMATS = {
  reel: { label: 'Reel', hint: '9:16 · 15–45 s' },
  carrusel: { label: 'Carrusel', hint: '4:5 · 5–8 láminas' },
  foto: { label: 'Foto', hint: '4:5' },
  historia: { label: 'Historia', hint: '9:16 · 24 h' },
};

/** media_product/media_type de Instagram (o «Tipo de publicación» del CSV) → formato del panel. */
export function formatOf(post) {
  const t = `${post?.media_product ?? ''} ${post?.media_type ?? ''}`.toUpperCase();
  if (/STOR|HISTORIA/.test(t)) return 'historia';
  if (/REEL|VIDEO/.test(t)) return 'reel';
  if (/CAROUSEL|CARRUSEL|SECUENCIA/.test(t)) return 'carrusel';
  return 'foto';
}

// ── Pilares del plan (3 nov 2026) ───────────────────────────────────────
// share: la parte de las piezas del mes que le toca a cada pilar.
export const PILLARS = [
  { id: 'receta', label: 'Receta en un minuto', share: 0.3, words: ['receta', 'prepara', 'molienda', 'gramos', ' g ', 'agua', 'temperatura', 'aeropress', 'filtro', 'cold brew', 'paso'] },
  { id: 'campeones', label: 'Campeones WAC', share: 0.2, words: ['campe', 'wac', 'world aeropress', 'mundial', 'championship', 'final'] },
  { id: 'calle', label: 'Café de la calle', share: 0.2, words: ['calle', 'barista', 'tinto', 'carrito', 'termo', 'andén', 'esquina', 'ruta'] },
  { id: 'barra', label: 'La barra (latas y kit)', share: 0.2, words: ['lata', 'kit', 'tienda', 'compra', 'pedido', 'envío', 'bolsa', 'cafe de origen', 'café de origen', 'precio', 'whatsapp'] },
  { id: 'micra', label: 'Construyendo Micra', share: 0.1, words: ['micra', 'app', 'estudio', 'mapa', 'certific'] },
];
export const pillarById = (id) => PILLARS.find((p) => p.id === id) ?? null;

const fold = (s) => ` ${String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')} `;

/** Pilar de un texto por palabras clave; el de más coincidencias gana, empate al primero. null si ninguna. */
export function pillarOf(caption) {
  const text = fold(caption);
  let best = null;
  let bestHits = 0;
  for (const p of PILLARS) {
    const hits = p.words.reduce((n, w) => n + (text.includes(fold(w).slice(1, -1)) ? 1 : 0), 0);
    if (hits > bestHits) { best = p.id; bestHits = hits; }
  }
  return best;
}

// ── Tiempo de Bogotá (UTC-5 todo el año, sin horario de verano) ─────────
export const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const SLOTS = [
  { id: 'manana', label: 'Mañana', from: 5, to: 11 },
  { id: 'mediodia', label: 'Mediodía', from: 11, to: 14 },
  { id: 'tarde', label: 'Tarde', from: 14, to: 18 },
  { id: 'noche', label: 'Noche', from: 18, to: 29 }, // hasta las 5 a. m.
];

/** { day: 0–6, hour: 0–23, slot } en hora de Bogotá; null si la fecha no sirve. */
export function bogotaTime(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t - 5 * 3600_000);
  const hour = d.getUTCHours();
  const h = hour < 5 ? hour + 24 : hour;
  return { day: d.getUTCDay(), hour, slot: SLOTS.find((s) => h >= s.from && h < s.to).id };
}

// ── Métricas por post ───────────────────────────────────────────────────
const n0 = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : 0);

/** Tasas por alcance (en %) y el puntaje del post. Sin alcance no hay tasas (null). */
export function rates(post) {
  const reach = n0(post.reach);
  if (reach <= 0) return null;
  const likes = n0(post.like_count);
  const comments = n0(post.comments_count);
  const saved = n0(post.saved);
  const shares = n0(post.shares);
  const pct = (x) => (x / reach) * 100;
  return {
    engagement: pct(likes + comments + saved + shares),
    shares: pct(shares),
    saves: pct(saved),
    likes: pct(likes),
    // Envíos pesan 3, guardados 2, comentarios 1,5, me gusta 1 (ver arriba).
    score: pct(shares * 3 + saved * 2 + comments * 1.5 + likes),
  };
}

export function median(xs) {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function groupStats(posts, keyOf, keys) {
  return keys.map((key) => {
    const rows = posts.filter((p) => keyOf(p) === key);
    const r = rows.map(rates).filter(Boolean);
    return {
      key,
      n: rows.length,
      reach: median(rows.map((p) => n0(p.reach))),
      score: median(r.map((x) => x.score)),
      shares: median(r.map((x) => x.shares)),
      saves: median(r.map((x) => x.saves)),
    };
  });
}

const pct1 = (x) => `${(Math.round(x * 10) / 10).toLocaleString('es-CO')} %`;

/**
 * Todo lo que muestra «Analizar». posts: filas como ig_media. daily: ig_account_daily.
 * now: para la ventana (por defecto los últimos `days` días).
 */
export function analyze(posts = [], daily = [], { days = 90, now = Date.now() } = {}) {
  const since = now - days * 86_400_000;
  const all = posts
    .filter((p) => { const t = Date.parse(p.posted_at); return Number.isFinite(t) && t >= since && t <= now + 86_400_000; })
    .map((p) => ({ ...p, format: formatOf(p), pillar: pillarOf(p.caption), when: bogotaTime(p.posted_at) }));
  // Las historias tienen otra vida (24 h, sin guardados): se cuentan, pero no se comparan con el feed.
  const feed = all.filter((p) => p.format !== 'historia');
  const r = feed.map(rates).filter(Boolean);

  const byFormat = groupStats(feed, (p) => p.format, ['reel', 'carrusel', 'foto']);
  const byPillar = groupStats(feed, (p) => p.pillar ?? 'otro', [...PILLARS.map((p) => p.id), 'otro']);
  const byDay = groupStats(feed, (p) => p.when?.day, [1, 2, 3, 4, 5, 6, 0]);
  const bySlot = groupStats(feed, (p) => p.when?.slot, SLOTS.map((s) => s.id));

  const top = feed
    .map((p) => ({ ...p, rates: rates(p) }))
    .filter((p) => p.rates)
    .sort((a, b) => b.rates.score - a.rates.score)
    .slice(0, 5);

  // Seguidores: primer y último día de la ventana
  const d = [...daily].filter((x) => Date.parse(x.day) >= since).sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const followers = d.length ? { now: n0(d.at(-1).followers_count), delta: d.length > 1 ? n0(d.at(-1).followers_count) - n0(d[0].followers_count) : null, days: d.length } : null;

  const weeks = Math.max(1, days / 7);
  const totals = {
    posts: all.length,
    feed: feed.length,
    stories: all.length - feed.length,
    perWeek: Math.round((feed.length / weeks) * 10) / 10,
    reach: median(feed.map((p) => n0(p.reach))),
    engagement: median(r.map((x) => x.engagement)),
    shares: median(r.map((x) => x.shares)),
    saves: median(r.map((x) => x.saves)),
  };

  return { totals, byFormat, byPillar, byDay, bySlot, top, followers, findings: findings({ totals, byFormat, byPillar, byDay, bySlot }), days };
}

/** Mejor grupo con al menos MIN_N posts (por puntaje mediano), o null. */
export function bestOf(groups) {
  const ok = groups.filter((g) => g.n >= MIN_N && g.score !== null);
  if (ok.length < 2) return null;
  const sorted = [...ok].sort((a, b) => b.score - a.score);
  return { best: sorted[0], worst: sorted.at(-1), ratio: sorted.at(-1).score > 0 ? sorted[0].score / sorted.at(-1).score : null };
}

const FORMAT_LABEL = (k) => FORMATS[k]?.label ?? k;
const PILLAR_LABEL = (k) => pillarById(k)?.label ?? 'Sin pilar';
const SLOT_LABEL = (k) => SLOTS.find((s) => s.id === k)?.label ?? k;

/** Hallazgos en frases cortas, cada uno con su n. Nunca compara grupos con menos de MIN_N posts. */
export function findings({ totals, byFormat, byPillar, byDay, bySlot }) {
  const out = [];
  if (totals.feed === 0) {
    out.push('Todavía no hay posts para analizar: trae las métricas de Instagram o sube el CSV de Meta Business Suite.');
    return out;
  }
  if (totals.feed < MIN_N * 2) out.push(`Solo hay ${totals.feed} post${totals.feed === 1 ? '' : 's'} del feed: las comparaciones empiezan con ${MIN_N} por grupo.`);
  const say = (groups, label, what) => {
    const b = bestOf(groups);
    if (!b) return;
    const x = b.ratio && Number.isFinite(b.ratio) && b.ratio >= 1.15 ? ` (${(Math.round(b.ratio * 10) / 10).toLocaleString('es-CO')}× ${label(b.worst.key)})` : '';
    out.push(`${what} que mejor funciona: ${label(b.best.key)}, puntaje ${pct1(b.best.score)} con n=${b.best.n}${x}.`);
  };
  say(byFormat, FORMAT_LABEL, 'El formato');
  say(byPillar.filter((g) => g.key !== 'otro'), PILLAR_LABEL, 'El pilar');
  say(byDay, (k) => DAYS[k], 'El día');
  say(bySlot, SLOT_LABEL, 'La franja');
  if (totals.perWeek < 5) out.push(`Publicas ${totals.perWeek.toLocaleString('es-CO')} por semana en el feed; el plan pide 6 (5 cortos y 1 carrusel).`);
  if (totals.shares !== null && totals.saves !== null && totals.shares < totals.saves / 2) out.push('Se guarda mucho más de lo que se comparte: cierra con una pregunta o «mándaselo a quien…» para subir los envíos.');
  const missing = PILLARS.filter((p) => !byPillar.find((g) => g.key === p.id)?.n).map((p) => p.label);
  if (missing.length && missing.length < PILLARS.length) out.push(`Pilares sin publicar en la ventana: ${missing.join(', ')}.`);
  return out;
}

// ── CSV de Meta Business Suite ──────────────────────────────────────────
// Meta exporta en el idioma de la cuenta y cambia los nombres de vez en cuando:
// se reconoce cada columna por varios nombres posibles.
const CSV_COLUMNS = {
  posted_at: ['hora de publicacion', 'fecha de publicacion', 'publish time', 'date'],
  media_product: ['tipo de publicacion', 'post type', 'tipo'],
  caption: ['descripcion', 'description', 'titulo', 'title'],
  permalink: ['enlace permanente', 'permalink', 'enlace'],
  reach: ['alcance', 'reach', 'cuentas alcanzadas'],
  views: ['visualizaciones', 'views', 'reproducciones', 'impresiones', 'impressions'],
  like_count: ['me gusta', 'likes'],
  comments_count: ['comentarios', 'comments'],
  shares: ['veces que se compartio', 'compartidos', 'shares', 'veces compartido'],
  saved: ['veces que se guardo', 'guardados', 'saves'],
};

/** Divide un CSV respetando comillas ("a, b" y "" dentro). Detecta ; o , como separador. */
export function splitCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const toNumber = (v) => {
  const s = String(v ?? '').trim().replace(/[\s.](?=\d{3}\b)/g, '');
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Fecha del CSV («10/28/2026 18:30», «2026-10-28T18:30», «28/10/2026 18:30») en hora de Bogotá → ISO. */
export function csvDate(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}${s.length <= 10 ? 'T12:00' : ''}-05:00`;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2}))?/.exec(s);
  if (!m) return null;
  let [, a, b, y, hh = '12', mm = '00'] = m;
  // Meta exporta mes/día; si el primero pasa de 12 es día/mes.
  let month = Number(a);
  let day = Number(b);
  if (month > 12) [month, day] = [day, month];
  const t = Date.parse(`${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hh.padStart(2, '0')}:${mm}:00-05:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** CSV de Meta → { posts (forma de ig_media), skipped, columns }. Exige fecha y alcance. */
export function parseMetaCsv(text) {
  const rows = splitCsv(text);
  if (rows.length < 2) return { posts: [], skipped: 0, columns: [], error: 'El archivo no tiene filas.' };
  const head = rows[0].map((h) => fold(h).trim());
  const idx = {};
  for (const [field, names] of Object.entries(CSV_COLUMNS)) {
    const i = head.findIndex((h) => names.some((n) => h === n || h.startsWith(`${n} `) || h.startsWith(`${n}(`)));
    if (i >= 0) idx[field] = i;
  }
  if (idx.posted_at === undefined || idx.reach === undefined) {
    return { posts: [], skipped: rows.length - 1, columns: Object.keys(idx), error: 'No encontré las columnas de fecha y alcance. Exporta desde Meta Business Suite › Estadísticas › Contenido.' };
  }
  const posts = [];
  let skipped = 0;
  rows.slice(1).forEach((r, i) => {
    const get = (f) => (idx[f] === undefined ? null : r[idx[f]]);
    const posted = csvDate(get('posted_at'));
    if (!posted) { skipped += 1; return; }
    posts.push({
      id: get('permalink') || `csv-${i + 1}`,
      posted_at: posted,
      media_product: get('media_product') || null,
      caption: get('caption') || '',
      permalink: get('permalink') || null,
      reach: toNumber(get('reach')),
      views: toNumber(get('views')),
      like_count: toNumber(get('like_count')),
      comments_count: toNumber(get('comments_count')),
      shares: toNumber(get('shares')),
      saved: toNumber(get('saved')),
      source: 'csv',
    });
  });
  return { posts, skipped, columns: Object.keys(idx) };
}

// ── Crear: ideas y semana ───────────────────────────────────────────────
// Ganchos y cierres por pilar. {x} se cambia por el tema de la idea.
// En lo público se dice «barista», nunca «tintero», y ningún aliado se nombra.
const HOOKS = {
  receta: ['¿Tu AeroPress sabe amarga? Cambia solo esto: {x}.', '{x} en 60 segundos, sin báscula de laboratorio.', 'La receta que uso todos los días: {x}.'],
  campeones: ['Así ganó {x} el mundial de AeroPress.', 'Probé la receta campeona de {x}. ¿Vale la pena?', '{x}: la receta que ganó el mundo, en Bogotá.'],
  calle: ['Un día con {x}.', '¿Cuánto cuesta un buen tinto en la calle? Se lo pregunté a {x}.', 'El café que pasa por tu esquina: {x}.'],
  barra: ['{x}: lo que pides cuando no tienes tiempo de prepararlo.', 'Abrimos {x} contigo.', 'Todo lo que necesitas para empezar: {x}.'],
  micra: ['Estamos construyendo {x}.', 'Esto aprendimos esta semana de {x}.', '{x}: así se ve por dentro.'],
};
const CTAS = {
  receta: 'Guárdala para tu próxima taza y mándasela a quien siempre te pide el café.',
  campeones: '¿Cuál campeón quieres que prepare la otra semana? Te leo.',
  calle: 'Mándaselo a alguien que se toma un tinto todos los días.',
  barra: 'Pídelo por WhatsApp, el enlace está en la bio.',
  micra: 'Si vendes café en la calle, escríbenos: Micra es para ti.',
};
const TAGS = {
  base: ['#AeroPress', '#CaféDeEspecialidad', '#Bogotá'],
  receta: ['#RecetaDeCafé', '#CaféEnCasa'],
  campeones: ['#WorldAeroPressChampionship', '#WAC'],
  calle: ['#CaféDeLaCalle', '#Baristas'],
  barra: ['#ColdBrew', '#CaféColombiano'],
  micra: ['#Micra', '#Barismo'],
};
// Tomas por formato: el guion mínimo para grabar sin pensar.
const SHOTS = {
  reel: ['0–2 s: el gancho en pantalla sobre la toma más fuerte', '2–20 s: el proceso en planos cerrados, un corte por paso', '20–30 s: el resultado servido y el cierre en texto'],
  carrusel: ['Lámina 1: el gancho grande', 'Láminas 2–6: un paso o un dato por lámina', 'Última: el resumen para guardar y el llamado'],
  foto: ['Una foto de cerca, luz de ventana', 'El dato principal en el texto'],
  historia: ['Encuesta o pregunta', 'El detrás de cámara del día', 'Enlace a la pieza del feed'],
};

// Temas de la casa por pilar (los de campeones salen de las recetas del WAC).
export const TOPICS = {
  receta: ['la molienda', 'la temperatura del agua', 'la receta invertida', 'el cold brew en AeroPress', 'la proporción 1:15', 'el filtro de metal vs. papel'],
  calle: ['un barista de Chapinero', 'el carrito de la esquina', 'el termo de 10 litros', 'la ruta de la mañana', 'una barista de Kennedy'],
  barra: ['la lata de cold brew', 'el kit AeroPress', 'el café de origen de la semana', 'la barra de ACERO.press'],
  micra: ['Micra', 'el mapa de baristas', 'la certificación de baristas', 'el estudio del café de la calle'],
};

/** Número pseudoaleatorio estable a partir de una semilla (para que la misma semana dé las mismas ideas). */
export function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, xs) => xs[Math.floor(rand() * xs.length) % xs.length];

/**
 * Una idea lista para grabar. champions: [{ year, name }] de recipes.js (para el pilar campeones).
 * topic: si no llega, se escoge uno con la semilla.
 */
export function buildIdea({ pillar = 'receta', format = 'reel', seed = 'x', topic, champions = [], series } = {}) {
  const rand = seeded(`${seed}|${pillar}|${format}`);
  let x = topic;
  let source = null;
  if (!x && pillar === 'campeones' && champions.length) {
    const c = pick(rand, champions);
    x = `${c.name} (${c.year})`;
    source = { kind: 'wac', year: c.year };
  }
  if (!x) x = pick(rand, TOPICS[pillar] ?? TOPICS.receta);
  const raw = pick(rand, HOOKS[pillar] ?? HOOKS.receta).replace('{x}', x);
  const hook = raw.charAt(0).toUpperCase() + raw.slice(1); // «la molienda…» al inicio va en mayúscula
  const cta = CTAS[pillar] ?? CTAS.receta;
  const tags = [...TAGS.base, ...(TAGS[pillar] ?? [])];
  return {
    id: `${pillar}-${format}-${Math.floor(rand() * 1e9).toString(36)}`,
    pillar,
    format,
    series: series ?? null,
    topic: x,
    hook,
    shots: SHOTS[format] ?? SHOTS.reel,
    caption: `${hook}\n\n${cta}`,
    hashtags: tags,
    source,
    done: false,
  };
}

// La semana del plan: Receta del lunes, Campeón del miércoles, Viernes de calle,
// dos cortos más, un carrusel e historias casi a diario.
export const WEEK_TEMPLATE = [
  { day: 1, pillar: 'receta', format: 'reel', series: 'Receta del lunes' },
  { day: 2, pillar: 'barra', format: 'reel' },
  { day: 3, pillar: 'campeones', format: 'reel', series: 'Campeón del miércoles' },
  { day: 4, pillar: 'receta', format: 'carrusel' },
  { day: 5, pillar: 'calle', format: 'reel', series: 'Viernes de calle' },
  { day: 6, pillar: 'micra', format: 'reel' },
  { day: 0, pillar: 'barra', format: 'historia' },
];

/** Lunes (fecha YYYY-MM-DD) de la semana de `date`, en Bogotá. */
export function mondayOf(date = new Date()) {
  const d = new Date(new Date(date).getTime() - 5 * 3600_000);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/**
 * La semana con una idea por día y su hora sugerida.
 * bestSlot: la franja que ganó en Analizar (si hay datos); si no, la noche (18–21), la hora de más uso en Colombia.
 */
export function weekPlan({ monday, champions = [], bestSlot = null } = {}) {
  const slot = SLOTS.find((s) => s.id === bestSlot) ?? SLOTS.find((s) => s.id === 'noche');
  const hour = slot.id === 'noche' ? 19 : slot.from + 1;
  return WEEK_TEMPLATE.map((t, i) => {
    const date = new Date(`${monday}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    return {
      date: date.toISOString().slice(0, 10),
      day: t.day,
      time: `${String(hour).padStart(2, '0')}:00`,
      ...buildIdea({ ...t, seed: `${monday}|${i}`, champions }),
    };
  });
}

/** La semana en texto plano (para WhatsApp o una nota). */
export function planText(plan) {
  return plan.map((p) => {
    const d = new Date(`${p.date}T12:00:00Z`);
    const when = `${DAYS[p.day]} ${d.getUTCDate()}/${d.getUTCMonth() + 1} · ${p.time}`;
    return `${p.done ? '✅' : '⬜'} ${when} · ${FORMATS[p.format]?.label ?? p.format} · ${pillarById(p.pillar)?.label ?? p.pillar}${p.series ? ` (${p.series})` : ''}\n${p.hook}`;
  }).join('\n\n');
}

/** Texto final para pegar en Instagram: el caption y los hashtags. */
export const postText = (idea) => `${idea.caption}\n\n${idea.hashtags.join(' ')}`;

/** Mezcla del plan por pilar (para la barra de «cuánto toca de cada uno»). */
export function mixOf(plan) {
  const feed = plan.filter((p) => p.format !== 'historia');
  return PILLARS.map((p) => ({ id: p.id, label: p.label, target: p.share, actual: feed.length ? feed.filter((x) => x.pillar === p.id).length / feed.length : 0 }));
}

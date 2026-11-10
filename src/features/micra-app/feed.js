import { STREAK_BADGES } from './motivation.js';
// El muro de Hoy: el mundo del barismo en una sola lista (precios, logros,
// ideas para publicar, el café de Colombia, puestos, recetas y videos). Lógica
// pura, sin React ni Supabase. Todo lo que sale aquí es real: lo de la casa y
// lo curado con su fuente, los puestos de la base (micra_baristas) y la racha
// y las lecciones del propio barista. No se publica cuántas tazas vendió: el
// muro celebra la constancia (racha, meta, lecciones), como Duolingo.
import { windowLabel, status } from './micraApp.js';

export const CHIPS = [
  ['todo', 'Todo'],
  ['publicaciones', 'De los baristas'],
  ['logros', 'Logros'],
  ['publicar', 'Para publicar'],
  ['cafe', 'Café de Colombia'],
  ['precios', 'Precios'],
  ['puestos', 'Puestos'],
  ['recetas', 'Recetas'],
  ['videos', 'Videos'],
];

// Dónde mira el precio del día quien no tiene el número del equipo
export const FNC_PRICE_URL = 'https://federaciondecafeteros.org/wp/estadisticas-cafeteras/';

// El café de Colombia: la Federación, marcas y fincas. Curado a mano, siempre
// con su fuente; lo nuevo se agrega aquí o desde el muro (app_config micra_muro).
export const CURATED = [
  {
    id: 'expo-2026', kind: 'cafe', org: 'FNC', by: 'Federación Nacional de Cafeteros', date: '2026-10-15',
    title: 'Cafés de Colombia Expo 2026 en Corferias',
    text: 'La feria de la Federación en Bogotá: más de 150 expositores, cafés de origen y la apuesta por que en Colombia se tome más café especial.',
    source: 'https://www.publimetro.co/bogota/2026/10/15/del-coffee-party-al-cafe-de-origen-las-experiencias-que-sorprenderan-en-cafes-de-colombia-expo-2026/',
  },
  {
    id: 'catacion-2027', kind: 'cafe', org: 'FNC', by: 'Federación Nacional de Cafeteros',
    title: 'Tolima, sede del Campeonato Nacional de Catación 2027',
    text: 'El ganador representa a Colombia en el mundial de catación.',
    source: 'https://www.eltiempo.com/cultura/gastronomia/tolima-sera-la-sede-del-campeonato-nacional-de-catacion-2027-certamen-que-entrega-un-cupo-para-representar-al-pais-en-la-feria-mundial-del-cafe-3576481',
  },
];
export const CAFE_ORGS = ['FNC', 'Marca', 'Finca'];

/**
 * Lo que agrega el equipo desde el muro (app_config `micra_muro`, un JSON).
 * Solo pasa lo que tiene título, de qué es (FNC, marca o finca) y enlaces https.
 */
export function readCurated(raw) {
  let list;
  try { list = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  if (!Array.isArray(list)) return [];
  const https = (u) => (typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) ? u : null);
  const text = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  return list.map((x, i) => ({
    id: `muro-${text(x?.id, 40) || i}`, kind: 'cafe',
    org: CAFE_ORGS.includes(x?.org) ? x.org : null,
    by: text(x?.by, 60), title: text(x?.title, 120), text: text(x?.text, 400),
    date: /^\d{4}-\d{2}-\d{2}$/.test(x?.date ?? '') ? x.date : null,
    source: https(x?.source), image: https(x?.image),
  })).filter((x) => x.title && x.org && x.by);
}

/** Una publicación nueva del equipo al principio de la lista (máximo 30). */
export function addCurated(list, post) {
  const date = post.date ?? null;
  const next = [{ id: `${Date.now().toString(36)}`, ...post, date }, ...(Array.isArray(list) ? list : [])];
  return next.slice(0, 30);
}

// Lo de la casa, fechado. La noticia lleva su fuente para que se pueda revisar.
export const HOUSE = [
  {
    id: 'woc-bogota-2027', kind: 'noticias', date: '2026-10-28', by: 'ACERO.press',
    title: 'World of Coffee llega a Bogotá en 2027',
    text: 'Del 30 de septiembre al 2 de octubre de 2027, con la Federación de Cafeteros y el Mundial de filtrados (World Brewers Cup).',
    source: 'https://sca.coffee/latest-news-announcements/world-of-coffee-and-the-world-brewers-cup-head-to-bogot-colombia-in-2027',
  },
  {
    id: 'receta-aeropress-original', kind: 'recetas', date: '2026-10-27', by: 'Escuela Micra',
    title: 'La receta oficial de AeroPress',
    text: '16 a 18 g de molienda media, agua a 85 °C hasta el n.º 4, revuelve 3 s y presiona al minuto.',
    chips: ['17 g', '85 °C', '1 min'], link: '/escuela',
  },
  {
    id: 'wac-2025', kind: 'recetas', date: '2025-11-15', by: 'World AeroPress Championship',
    title: 'Némo Pop, campeón del Mundial 2025',
    text: 'Upright, 18 g a 84 °C, 100 g de agua y 70 g para diluir; presiona suave a los 50 s.',
    chips: ['18 g', '84 °C', 'upright'], link: '/#metodo',
  },
  {
    id: 'video-metodo', kind: 'videos', date: '2026-10-27', by: 'ACERO.press',
    title: 'Una AeroPress en un minuto',
    text: 'El método completo, de la molienda a la taza.',
    video: '/image/metodo/aeropress-metodo.mp4', poster: '/image/metodo/poster.webp',
  },
];

// El tinto en la calle: la mediana del estudio de calle (oct. 2026, 7 puestos con precio)
export const STUDY_TINTO = { value: 1300, n: 7, date: '2026-10' };

/** Los precios del café que pone el equipo (app_config): solo números positivos. */
export function readPrices(cfg = {}) {
  // «2.850.000» (puntos de miles) o «3,80» / «3.8» (decimales)
  const num = (v) => {
    let t = String(v ?? '').trim().replace(/[$\s]/g, '');
    t = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t.replace(',', '.');
    const n = /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const out = { carga: num(cfg.micra_precio_carga), ny: num(cfg.micra_precio_ny), date: /^\d{4}-\d{2}-\d{2}$/.test(cfg.micra_precio_fecha ?? '') ? cfg.micra_precio_fecha : null };
  // El precio anterior, para la flechita de si subió o bajó (solo si existe)
  const prevCarga = num(cfg.micra_precio_carga_ant);
  const prevNy = num(cfg.micra_precio_ny_ant);
  if (prevCarga) out.prevCarga = prevCarga;
  if (prevNy) out.prevNy = prevNy;
  return out;
}

/**
 * ¿Subió o bajó? { dir: 'up' | 'down' | 'flat', pct: '1,8 %' } o null sin precio anterior.
 * Menos de 0,05 % cuenta como igual.
 */
export function priceTrend(cur, prev) {
  if (!(cur > 0) || !(prev > 0)) return null;
  const change = ((cur - prev) / prev) * 100;
  const dir = Math.abs(change) < 0.05 ? 'flat' : change > 0 ? 'up' : 'down';
  return { dir, pct: `${Math.abs(change).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` };
}

/**
 * Lo que guarda «Actualizar» en app_config: el precio nuevo y, si cambia de día, el
 * de antes pasa a ser el anterior (si corrige el mismo día, el anterior se queda).
 */
export function priceRows({ carga, ny }, cfg = {}, today) {
  const sameDay = cfg.micra_precio_fecha === today;
  const prevCarga = sameDay ? cfg.micra_precio_carga_ant : cfg.micra_precio_carga;
  const prevNy = sameDay ? cfg.micra_precio_ny_ant : cfg.micra_precio_ny;
  return [
    ['micra_precio_carga', carga], ['micra_precio_ny', ny], ['micra_precio_fecha', today],
    ['micra_precio_carga_ant', prevCarga], ['micra_precio_ny_ant', prevNy],
  ].filter(([k, v]) => !k.endsWith('_ant') || String(v ?? '').trim())
    .map(([key, value]) => ({ key, value: String(value ?? '').trim() }));
}

/** «$2,85 M» para la carga de 125 kg. */
export const millions = (n) => `$${(Math.round(n / 10000) / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })} M`;

// Hitos de racha (viven en motivation.js: también los usa la pantalla de la primera taza)
export { STREAK_BADGES };

/**
 * Los logros del barista para el muro: la racha (siempre), el hito más alto que
 * alcanzó, la meta de hoy si la cumplió y las lecciones. Nunca cuántas tazas
 * vendió ni cuánta plata hizo.
 * me: { name, streak: { count, todayDone }, goalMet, lessonsDone, lessonsTotal }
 */
export function achievements(me) {
  if (!me) return [];
  const n = me.streak?.count ?? 0;
  const today = !!me.streak?.todayDone;
  const out = [{
    id: 'racha', kind: 'logros', badge: 'racha', count: n, by: me.name, mine: true,
    title: n > 0 ? `${n} ${n === 1 ? 'día' : 'días'} en racha` : 'Empieza tu racha hoy',
    text: n === 0 ? 'Sal a vender y vende tu primera taza: mañana ya llevas dos días.'
      : today ? '¡Hoy ya sumaste! Vuelve mañana para que no se apague.'
        : 'Sal a vender hoy para no perderla.',
    cta: today ? 'share' : 'out',
  }];
  const badge = [...STREAK_BADGES].reverse().find(([d]) => n >= d);
  if (badge) out.push({ id: `hito-${badge[0]}`, kind: 'logros', badge: 'hito', count: badge[0], by: me.name, mine: true, title: badge[1], text: badge[2], cta: 'share' });
  if (me.goalMet) out.push({ id: 'meta', kind: 'logros', badge: 'meta', by: me.name, mine: true, title: '¡Cumpliste tu meta de hoy!', text: 'Lo que venga de aquí en adelante es ganancia.', cta: 'share' });
  const total = me.lessonsTotal ?? 0;
  const done = Math.min(me.lessonsDone ?? 0, total);
  if (total > 0) {
    out.push(done >= total
      ? { id: 'escuela', kind: 'logros', badge: 'escuela', by: me.name, mine: true, title: 'Escuela completa', text: `Viste las ${total} lecciones. Graba tu video para subir a Barista de calle.`, cta: 'learn' }
      : { id: 'escuela', kind: 'logros', badge: 'escuela', by: me.name, mine: true, done, total, title: done ? `${done} de ${total} lecciones` : 'Tu primera lección te espera', text: done ? 'Una más y subes en tu camino de barista.' : 'Son 5 minutos y la puedes ver en la calle.', cta: 'learn' });
  }
  return out;
}

// Ideas para publicar, como las sugerencias de Instagram. Cada día cambian.
export const PHOTO_IDEAS = [
  { id: 'cliente', icon: '🤝', title: 'Una foto con tu cliente de siempre', text: 'Pídele permiso y tómala al entregarle el tinto. A la gente le gusta ver a quién le compra.' },
  { id: 'preparacion', icon: '☕', title: 'Tu preparación en el carrito', text: 'La AeroPress, el termo y el vaso servido. Que se vea cómo lo haces.' },
  { id: 'lugar', icon: '📍', title: 'Tu esquina', text: 'El lugar donde vendes, con el letrero de la calle: así te encuentran.' },
  { id: 'temprano', icon: '🌅', title: 'El primer tinto del día', text: 'La primera taza con la luz de la mañana.' },
  { id: 'recorrido', icon: '🚶', title: 'Tu recorrido', text: 'Un video caminando tu ruta: por dónde pasas y a qué hora.', modes: ['caminando'] },
  { id: 'sombrilla', icon: '⛱️', title: 'Tu sombrilla abierta', text: 'Tu puesto listo para el primer cliente.', modes: ['sombrilla', 'fijo'] },
];

/** Dos ideas para hoy: cambian con el día y se ajustan a cómo sale (caminando, sombrilla, fijo). */
export function photoIdeas(dayKey = '', mode = null) {
  const pool = PHOTO_IDEAS.filter((i) => !i.modes || (mode && i.modes.includes(mode)));
  let h = 0;
  for (const c of String(dayKey)) h = (h * 31 + c.charCodeAt(0)) % 997;
  const a = pool[h % pool.length];
  const b = pool[(h + 1 + Math.floor(pool.length / 2)) % pool.length];
  return [a, b].filter((x, i, all) => all.indexOf(x) === i).map((x) => ({ ...x, id: `idea-${x.id}`, kind: 'publicar' }));
}

/** Cuántos puestos van en el muro (con 150 baristas medía 90 pantallas). */
export const FEED_PUESTOS = 12;

/**
 * El muro: el precio arriba (siempre hay uno, el del estudio), luego los logros
 * del barista, dos ideas para publicar, lo que publicaron los baristas (ya
 * revisado por el equipo, lo más nuevo primero; posts.js), los puestos con su
 * horario y lo de la casa y lo curado, lo más nuevo primero.
 */
export function buildFeed({ baristas = [], selfId = null, me = null, prices = {}, house = HOUSE, curated = CURATED, dayKey = '', mode = null, posts = [], challenge = null } = {}) {
  const items = [{ id: 'precio', kind: 'precios', prices, study: STUDY_TINTO }];
  // El reto de la semana (Competencia), justo después del precio
  if (challenge?.id && challenge.title) items.push({ id: `reto-${challenge.id}`, kind: 'reto', title: challenge.title, text: challenge.brief ?? null, daysLeft: challenge.days_left, entries: challenge.entries ?? 0 });
  items.push(...achievements(me));
  if (me) items.push(...photoIdeas(dayKey, mode));
  items.push(...posts);
  const puestos = baristas.filter((b) => b.id !== selfId && (b.referencia || b.localidad)).map((b) => ({
    id: `puesto-${b.id}`, kind: 'puestos', by: b.name, baristaId: b.id, live: b.status === 'live',
    title: b.referencia || b.localidad, text: windowLabel(b.hora_inicio, b.hora_fin) ? `Suele pasar ${windowLabel(b.hora_inicio, b.hora_fin)}` : null,
    price: b.prices?.tinto ?? null,
  }));
  // En la calle primero, y solo los primeros: la lista completa está en el inicio, con «Ver más»
  puestos.sort((a, b) => Number(b.live) - Number(a.live));
  puestos.splice(FEED_PUESTOS);
  // Lo fechado del más nuevo al más viejo; lo curado sin fecha, al final
  const dated = [...house, ...curated].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  return [...items, ...puestos, ...dated];
}

/** Lo que se ve con un chip: «todo» lo muestra todo; las noticias van solo en «todo». */
export const filterFeed = (items, chip = 'todo') => (chip === 'todo' ? items : items.filter((i) => i.kind === chip));

/** Cuántas cosas hay por chip (para no mostrar un chip vacío). */
export function chipCounts(items) {
  const out = Object.fromEntries(CHIPS.map(([id]) => [id, 0]));
  for (const i of items) { out.todo += 1; if (out[i.kind] != null) out[i.kind] += 1; }
  return out;
}

/** El costo de café de una taza (12 g) con un precio por kilo. */
export const cupCost = (perKilo, grams = 12) => Math.round((perKilo * grams) / 1000);

/** El mensaje para pedir café por kilos al equipo. */
export function coffeeOrderText({ name, kilos, where }) {
  const k = `${kilos} ${kilos === 1 ? 'kilo' : 'kilos'}`;
  return `Hola, soy ${String(name || '').split(' ')[0] || 'barista'} de Micra. Quiero pedir ${k} de café para la AeroPress${where ? `, para recoger o recibir en ${where}` : ''}. ¿Cuánto es y cuándo me llega?`;
}

/**
 * La cabecera de Hoy (6 nov 2026, pedido del usuario: «como la de Vender, con los datos más
 * importantes del café»): la carga de la FNC en grande (o, sin precio, el tinto en la calle) y
 * debajo la libra en Nueva York, el kilo en pergamino, el café de una taza, el tinto en la calle y
 * cuántos baristas hay en la calle ahora. Solo lo que existe: sin precio no hay cifra inventada.
 */
export function coffeeHead({ prices = {}, baristas = [], study = STUDY_TINTO, now = new Date() } = {}) {
  const kilo = prices.carga ? Math.round(prices.carga / 125) : null;
  const live = (baristas ?? []).filter((b) => status(b, now) === 'live').length;
  const peso = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
  const cargaTrend = priceTrend(prices.carga, prices.prevCarga);
  const big = prices.carga
    ? { value: millions(prices.carga), label: 'la carga de 125 kg · FNC', trend: cargaTrend }
    : { value: peso(study.value), label: `el tinto en la calle · mediana de ${study.n} puestos` };
  const kpis = [
    prices.ny && { id: 'ny', value: `US$${prices.ny.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, label: 'libra en Nueva York', trend: priceTrend(prices.ny, prices.prevNy) },
    kilo && { id: 'kilo', value: peso(kilo), label: 'kilo en pergamino', trend: cargaTrend },
    kilo && { id: 'taza', value: peso(cupCost(kilo)), label: 'de café por taza (12 g)', trend: cargaTrend },
    prices.carga && { id: 'tinto', value: peso(study.value), label: 'tinto en la calle' },
    { id: 'live', value: String(live), label: live === 1 ? 'barista en la calle' : 'baristas en la calle' },
  ].filter(Boolean);
  return { big, kpis, date: prices.date ?? null };
}

// Hoy en tres pestañas (10 nov 2026): lo que pasa ahora, las noticias en filas y las recetas.
export const HOY_TABS = [['ahora', 'Ahora'], ['noticias', 'Noticias'], ['recetas', 'Recetas']];
const TAB_OF = { cafe: 'noticias', noticias: 'noticias', videos: 'noticias', recetas: 'recetas' };
export const hoyTab = (kind) => TAB_OF[kind] ?? 'ahora';
/** Lo de una pestaña; los logros no van como publicación, van como medallas. */
export const tabFeed = (items, tab) => (items ?? []).filter((i) => hoyTab(i.kind) === tab && i.kind !== 'logros');
/** Los logros como medallas en fila: la cifra (o un ✓), el título y una línea. */
export function medalsOf(items) {
  return (items ?? []).filter((i) => i.kind === 'logros').map((i) => ({
    id: i.id,
    mark: i.count != null ? String(i.count) : i.done != null && i.total ? `${i.done}/${i.total}` : '✓',
    title: i.badge === 'racha' ? (i.count === 1 ? 'Día de racha' : 'Días de racha') : i.badge === 'hito' ? 'Días seguidos' : i.title,
    sub: i.badge === 'racha' || i.badge === 'hito' ? i.title : i.text ?? '',
    cta: i.cta ?? null,
  }));
}
/** Las letras de la miniatura de una noticia: la sigla de quien publica. */
export function newsMark(i) {
  if (i.kind === 'videos') return '▶';
  const who = String(i.org || i.by || 'M').replace(/[^A-Za-zÁÉÍÓÚÑ ]/g, ' ').trim();
  if (/^[A-ZÁÉÍÓÚÑ]{2,4}$/.test(who)) return who; // una sigla ya es la marca
  return who.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'M';
}

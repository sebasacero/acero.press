// El muro de Hoy: el mundo del barismo en una sola lista (precios, videos,
// recorridos, puestos, recetas y noticias). Lógica pura, sin React ni Supabase.
// Todo lo que sale aquí es real: lo de la casa con su fecha y su fuente, los
// puestos de la base (micra_baristas) y el día del propio barista. Lo que aún
// no tiene fuente (videos de otros baristas, recorridos ajenos) no se inventa.
import { windowLabel, cupsLabel } from './micraApp.js';

export const CHIPS = [
  ['todo', 'Todo'],
  ['precios', 'Precios'],
  ['videos', 'Videos'],
  ['recorridos', 'Recorridos'],
  ['puestos', 'Puestos'],
  ['recetas', 'Recetas'],
];

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
  return { carga: num(cfg.micra_precio_carga), ny: num(cfg.micra_precio_ny), date: /^\d{4}-\d{2}-\d{2}$/.test(cfg.micra_precio_fecha ?? '') ? cfg.micra_precio_fecha : null };
}

/** «$2,85 M» para la carga de 125 kg. */
export const millions = (n) => `$${(Math.round(n / 10000) / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })} M`;

/**
 * El muro: el precio arriba (siempre hay uno, el del estudio), luego los
 * puestos con su horario, el día propio y lo de la casa, lo más nuevo primero.
 */
export function buildFeed({ baristas = [], selfId = null, myDay = null, prices = {}, house = HOUSE } = {}) {
  const items = [{ id: 'precio', kind: 'precios', prices, study: STUDY_TINTO }];
  if (myDay && myDay.cups > 0) {
    items.push({ id: 'mi-dia', kind: 'recorridos', by: myDay.name, title: `Tu día: ${cupsLabel(myDay.cups)}`, km: myDay.km ?? 0, streak: myDay.streak ?? 0, mine: true });
  }
  const puestos = baristas.filter((b) => b.id !== selfId && (b.referencia || b.localidad)).map((b) => ({
    id: `puesto-${b.id}`, kind: 'puestos', by: b.name, baristaId: b.id, live: b.status === 'live',
    title: b.referencia || b.localidad, text: windowLabel(b.hora_inicio, b.hora_fin) ? `Suele pasar ${windowLabel(b.hora_inicio, b.hora_fin)}` : null,
    price: b.prices?.tinto ?? null,
  }));
  // En la calle primero
  puestos.sort((a, b) => Number(b.live) - Number(a.live));
  const dated = [...house].sort((a, b) => String(b.date).localeCompare(String(a.date)));
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

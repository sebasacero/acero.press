// El juego de Celestra (12 nov 2026, pedido del usuario: «gamifica toda mi experiencia con
// Celestra… la meta es el World of Coffee»). Puro: recibe cuentas y devuelve puntos, nivel,
// racha y el camino. Los puntos premian decidir y hacer, no abrir la app:
// escribir el parte, decidir cada propuesta, marcarla hecha y dejar el día sin pendientes.

export const META = 'World of Coffee';
export const XP = { parte: 10, decidir: 5, hecha: 30, pleno: 15 };

/** Del grano a la taza; el último nivel es la meta. */
export const NIVELES = [
  { min: 0, nombre: 'Semilla' },
  { min: 100, nombre: 'Almácigo' },
  { min: 300, nombre: 'Cafeto' },
  { min: 700, nombre: 'Cereza' },
  { min: 1500, nombre: 'Pergamino' },
  { min: 3000, nombre: 'Tueste' },
  { min: 6000, nombre: META },
];

const n0 = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);

/** stats: { partes, decididas, hechas, plenos } (plenos = días con las 3 propuestas decididas). */
export function puntos(stats = {}) {
  return n0(stats.partes) * XP.parte + n0(stats.decididas) * XP.decidir + n0(stats.hechas) * XP.hecha + n0(stats.plenos) * XP.pleno;
}

export function nivel(xp = 0) {
  const x = n0(xp);
  let i = 0;
  while (i + 1 < NIVELES.length && x >= NIVELES[i + 1].min) i += 1;
  const next = NIVELES[i + 1] ?? null;
  return {
    n: i + 1,
    nombre: NIVELES[i].nombre,
    xp: x,
    siguiente: next?.nombre ?? null,
    faltan: next ? next.min - x : 0,
    pct: next ? Math.round(((x - NIVELES[i].min) / (next.min - NIVELES[i].min)) * 100) : 100,
  };
}

const prevDay = (day) => new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Días seguidos con parte. Si hoy aún no hay parte, la racha de ayer sigue viva. */
export function racha(dias = [], today) {
  const set = new Set((dias ?? []).map((d) => String(d).slice(0, 10)));
  if (!today) return 0;
  let d = set.has(today) ? today : prevDay(today);
  let n = 0;
  while (set.has(d)) { n += 1; d = prevDay(d); }
  return n;
}

/** Sin celestra_juego() en la base: lo que se puede contar con el estado de la tarjeta (hoy y las últimas 20 decisiones). */
export function statsFromEstado(estado = {}) {
  const dec = Array.isArray(estado?.decisiones) ? estado.decisiones : [];
  const dias = new Set(dec.map((d) => String(d.dia ?? '').slice(0, 10)).filter(Boolean));
  const props = estado?.parte?.propuestas ?? [];
  if (estado?.parte?.day) dias.add(estado.parte.day);
  const porDia = new Map();
  for (const d of dec) porDia.set(String(d.dia).slice(0, 10), (porDia.get(String(d.dia).slice(0, 10)) ?? 0) + 1);
  return {
    partes: dias.size,
    decididas: dec.length,
    hechas: dec.filter((d) => d.estado === 'hecha').length,
    plenos: [...porDia.values()].filter((n) => n >= 3).length,
    dias: [...dias],
    parcial: true,
    hoy_pendientes: props.filter((p) => p.estado === 'pendiente').length,
  };
}

/** Todo lo que pinta la tarjeta. */
export function juego(stats = {}, today) {
  const xp = puntos(stats);
  return { xp, nivel: nivel(xp), racha: racha(stats.dias, today), parcial: !!stats.parcial };
}

/** Lo que suma una decisión, para el aviso «+35 puntos» (decidir + hacer). `ultima`: era la última pendiente del día. */
export function ganado(estado, { ultima = false } = {}) {
  return XP.decidir + (estado === 'hecha' ? XP.hecha : 0) + (ultima ? XP.pleno : 0);
}

// Metas iniciales del camino (se ajustan cuando haya historia): las del estudio y las fincas
// salen de sus propios planes; redes es el plan de contenido (6 por semana); tazas y pedidos
// son un primer listón.
export const CAMINO_METAS = { tazas_semana: 100, posts_30d: 24, pedidos_30d: 10 };

/**
 * El camino al World of Coffee: cada tramo con su dato real, o con lo que falta para medirlo.
 * l: lecturas del algoritmo. redes / tienda: como en candidatas().
 * Devuelve [{ id, nombre, valor, meta, pct, texto }]; valor null = todavía no se mide.
 */
export function camino(l = {}, { redes = null, tienda = null } = {}) {
  const tramo = (id, nombre, valor, meta, texto) => ({ id, nombre, valor, meta, pct: valor == null || !meta ? 0 : Math.min(100, Math.round((valor / meta) * 100)), texto });
  const out = [];
  const e = l.encuestas;
  out.push(e ? tramo('estudio', 'Estudio', e.encuestas, e.meta, `${e.encuestas} de ${e.meta} encuestas`) : tramo('estudio', 'Estudio', null, null, 'Sin lectura del estudio'));
  const semana = l.dia?.semana;
  const tazas = semana ? semana.reduce((a, d) => a + (Number(d.tazas) || 0), 0) : null;
  out.push(tramo('ventas', 'Ventas', tazas, CAMINO_METAS.tazas_semana, tazas == null ? 'Sin lectura de ventas' : `${tazas} de ${CAMINO_METAS.tazas_semana} tazas en 7 días`));
  const posts = redes && Number(redes.posts) > 0 ? Number(redes.posts) : null;
  out.push(tramo('redes', 'Redes', posts, CAMINO_METAS.posts_30d, posts == null ? 'Conecta Instagram para medirlo' : `${posts} de ${CAMINO_METAS.posts_30d} publicaciones en 30 días`));
  const ped = tienda ? Number(tienda.pedidos_30d) || 0 : null;
  out.push(tramo('tienda', 'Tienda', ped, CAMINO_METAS.pedidos_30d, ped == null ? 'Sin lectura de la tienda' : `${ped} de ${CAMINO_METAS.pedidos_30d} pedidos en 30 días`));
  out.push(tramo('descargas', 'Descargas', null, null, 'Se miden cuando la app esté en las tiendas'));
  return out;
}

/** Qué tan lejos va el camino: promedio de los tramos que sí se miden (0–100), o null. */
export function avance(tramos = []) {
  const medidos = tramos.filter((t) => t.valor != null);
  return medidos.length ? Math.round(medidos.reduce((a, t) => a + t.pct, 0) / medidos.length) : null;
}

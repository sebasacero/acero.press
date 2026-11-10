// Los avisos del centro de control (pedido del usuario, 10 nov 2026: «notificaciones en tiempo
// real de posibles mejoras y tendencias»). Lógica pura, sin modelo ni servidor: reglas sobre lo
// que ya dan micra_owner_day, micra_live_map y micra_hold_ratings.
// - insights(): lo que se puede mejorar y hacia dónde va la operación, con lo de ahora.
// - diffEvents(): lo que cambió entre dos lecturas (cada 20 s): eso es el «tiempo real».
// Los textos van en español: es el panel del equipo.

/** Nunca se compara ni se promedia con menos de esto (misma regla que Redes). */
export const MIN_N = 3;
/** Un barista «cubre» una zona si está a menos de estos metros. */
export const COVER_M = 600;
/** Cuánto se aleja lo pagado de lo pedido para avisar. */
export const PRICE_GAP = 0.1;

const DRINK = { tinto: 'tinto', perico: 'perico', aromatica: 'aromática' };
const money = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const first = (name) => (name ?? '').split(' ')[0] || 'Barista';
const plural = (n, one, many) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** Metros entre dos puntos (equirectangular: sobra para una ciudad). */
export function meters(a, b) {
  const k = Math.PI / 180;
  const x = (b.lng - a.lng) * k * Math.cos(((a.lat + b.lat) / 2) * k);
  const y = (b.lat - a.lat) * k;
  return Math.sqrt(x * x + y * y) * 6371000;
}

const pt = (p) => ({ lat: Number(p.lat), lng: Number(p.lng) });
const hasPt = (p) => p?.lat != null && p?.lng != null;

/** El nombre de una zona: el punto conocido más cercano (a 1,5 km o menos), o null. */
export function placeName(cell, places = [], max = 1500) {
  let best = null;
  let d = max;
  for (const p of places) {
    if (!hasPt(p)) continue;
    const m = meters(pt(cell), pt(p));
    if (m <= d) { d = m; best = p; }
  }
  return best ? (best.referencia || best.localidad || null) : null;
}

const covered = (cell, baristas) => baristas.some((b) => hasPt(b) && meters(pt(cell), pt(b)) <= COVER_M);
const cellKey = (c) => `${Number(c.lat).toFixed(4)},${Number(c.lng).toFixed(4)}`;

/**
 * Mejoras y tendencias de ahora.
 * - state: panelState() del dueño. - live: micra_live_map o null.
 * - ratings: micra_hold_ratings o null. - places: puntos con nombre (micra_baristas).
 * Devuelve [{ key, kind: 'mejora' | 'tendencia', level: 'alta' | 'media' | 'info', title, text }].
 */
export function insights({ state = null, live = null, ratings = null, places = [] } = {}) {
  const out = [];
  const add = (key, kind, level, title, text) => out.push({ key, kind, level, title, text });
  const min = Number(live?.min_count) || 2;
  const onStreet = live?.baristas ?? [];
  const demand = (live?.demand ?? []).filter((c) => Number(c.n) >= min && hasPt(c));
  const named = [...onStreet, ...places];

  // Mejora: zonas donde quieren café y nadie las cubre
  for (const c of demand.filter((x) => !covered(x, onStreet)).slice(0, 3)) {
    const where = placeName(c, named);
    const top = Object.entries(c.drinks ?? {}).filter(([k, v]) => DRINK[k] && v > 0).sort((a, b) => b[1] - a[1])[0];
    add(`gap:${cellKey(c)}`, 'mejora', 'alta', `Quieren café${where ? ` cerca de ${where}` : ''} y no hay barista`,
      `${plural(Number(c.n), 'persona', 'personas')} en la zona y nadie en línea a menos de ${COVER_M} m.${top ? ` Lo más pedido: ${DRINK[top[0]]}.` : ''}`);
  }

  // Mejora: pocos salieron
  const linked = (state?.rows ?? []).filter((r) => r.linked);
  const liveN = linked.filter((r) => r.live).length;
  if (linked.length >= MIN_N && liveN / linked.length < 0.34) {
    add('coverage', 'mejora', 'media', `Solo ${liveN} de ${linked.length} baristas con cuenta está en la calle`, 'Un mensaje al grupo a esta hora suele sacar a más de uno.');
  }

  // Mejora: zonas del estudio sin nadie de Micra
  const study = (live?.study ?? []).filter(hasPt);
  const empty = study.filter((c) => !covered(c, onStreet)).length;
  if (study.length >= MIN_N && empty > 0) {
    add('study', 'mejora', 'info', `${plural(empty, 'zona', 'zonas')} del estudio sin barista de Micra en línea`, `De ${study.length} zonas donde suelen vender. Ahí están los próximos baristas por invitar.`);
  }

  // Mejora: calificaciones y precio pagado (solo con 3 notas o más)
  for (const r of ratings ?? []) {
    if (Number(r.n) >= MIN_N && Number(r.avg) < 3.5) {
      add(`rating:${r.id}`, 'mejora', 'alta', `${first(r.name)} tiene ${String(r.avg).replace('.', ',')} granos de 5`, `En ${r.n} entregas calificadas. Vale una visita o una llamada.`);
    }
    const paid = Number(r.paid_cup);
    const listed = Number(r.listed_cup);
    if (Number(r.paid_n) >= MIN_N && paid > 0 && listed > 0 && Math.abs(paid - listed) / listed >= PRICE_GAP) {
      add(`price:${r.id}`, 'tendencia', 'media', paid > listed ? `A ${first(r.name)} le pagan más de lo que pide` : `A ${first(r.name)} le pagan menos de lo que pide`,
        `Mediana pagada ${money(paid)} por taza; pide ${money(listed)} (${r.paid_n} respuestas).${paid > listed ? ' Puede subir el precio.' : ''}`);
    }
  }

  // Tendencia: hoy frente a la semana
  const week = state?.week ?? [];
  if (week.length >= 2) {
    const today = Number(week[week.length - 1].cups) || 0;
    const before = week.slice(0, -1).map((d) => Number(d.cups) || 0).filter((n) => n > 0);
    if (before.length >= MIN_N) {
      const avg = before.reduce((a, n) => a + n, 0) / before.length;
      const pct = Math.round((today / avg) * 100);
      add('week', 'tendencia', pct >= 100 ? 'info' : 'media', pct >= 100 ? `Hoy ya pasó el promedio de la semana` : `Hoy va en ${pct} % de un día promedio`,
        `${plural(today, 'taza', 'tazas')} hoy; el promedio de los ${before.length} días con ventas es ${Math.round(avg)}.`);
      const best = week.slice(0, -1).reduce((a, d) => (Number(d.cups) > Number(a.cups) ? d : a));
      const dayName = new Date(`${best.day}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'UTC' });
      add('best', 'tendencia', 'info', `El mejor día de la semana fue el ${dayName}`, `${plural(Number(best.cups), 'taza', 'tazas')}. Conviene tener a todos en la calle ese día.`);
    }
  }

  // Tendencia: qué se busca ahora
  const drinks = { tinto: 0, perico: 0, aromatica: 0 };
  let signals = 0;
  for (const c of demand) for (const k of Object.keys(drinks)) { drinks[k] += Number(c.drinks?.[k]) || 0; signals += Number(c.drinks?.[k]) || 0; }
  const top = Object.entries(drinks).sort((a, b) => b[1] - a[1])[0];
  if (signals >= MIN_N && top[1] > 0) {
    add('drink', 'tendencia', 'info', `Lo más buscado ahora: ${DRINK[top[0]]}`, `${top[1]} de ${signals} señales con bebida en los últimos ${live?.minutes ?? 45} min.`);
  }

  // Tendencia: apartados que sí se entregan
  const k = state?.kpis;
  if (k && (k.served ?? 0) + (k.waiting ?? 0) >= MIN_N) {
    add('holds', 'tendencia', 'info', `${k.served} de ${k.served + k.waiting} apartados de hoy ya se entregaron`, k.waiting > 0 ? `${plural(k.waiting, 'apartado espera', 'apartados esperan')} todavía.` : 'Ninguno espera.');
  }

  const order = { alta: 0, media: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** Lo que se guarda de una lectura para comparar con la siguiente. */
export function snapshot({ state = null, live = null } = {}) {
  const min = Number(live?.min_count) || 2;
  return {
    rows: Object.fromEntries((state?.rows ?? []).map((r) => [r.id, { name: r.name, where: r.where, live: r.live, waiting: r.waiting, cups: r.cups ?? 0 }])),
    demand: Object.fromEntries((live?.demand ?? []).filter((c) => Number(c.n) >= min && hasPt(c)).map((c) => [cellKey(c), { n: Number(c.n), lat: Number(c.lat), lng: Number(c.lng) }])),
  };
}

/**
 * Lo que pasó entre dos lecturas: quién salió o volvió, apartados nuevos, ventas y zonas de
 * demanda que aparecen o crecen. Sin lectura anterior no hay nada que avisar.
 * Devuelve [{ key, kind: 'evento', level, title, text, at }].
 */
export function diffEvents(prev, next, { now = Date.now(), places = [] } = {}) {
  if (!prev || !next) return [];
  const out = [];
  const add = (key, level, title, text = '') => out.push({ key: `${key}:${now}`, kind: 'evento', level, title, text, at: now });
  for (const [id, r] of Object.entries(next.rows)) {
    const p = prev.rows[id];
    if (!p) continue;
    if (r.live && !p.live) add(`out:${id}`, 'info', `${r.name} salió a vender`, r.where);
    if (!r.live && p.live) add(`in:${id}`, r.waiting > 0 ? 'alta' : 'info', `${r.name} salió de la calle`, r.waiting > 0 ? `Le quedan ${plural(r.waiting, 'apartado', 'apartados')} esperando.` : '');
    if (r.waiting > p.waiting) add(`hold:${id}`, 'media', `Le apartaron a ${r.name}`, `${plural(r.waiting, 'apartado espera', 'apartados esperan')}${r.live ? '' : ' y no está en la calle'}.`);
    if (r.cups > p.cups) add(`sale:${id}`, 'info', `${r.name} vendió ${plural(r.cups - p.cups, 'taza', 'tazas')}`, `Lleva ${r.cups} hoy.`);
  }
  for (const [key, c] of Object.entries(next.demand)) {
    const p = prev.demand[key];
    if (p && c.n <= p.n) continue;
    const where = placeName(c, places);
    add(`zone:${key}`, 'media', p ? `Sube la demanda${where ? ` cerca de ${where}` : ''}` : `Nueva zona que quiere café${where ? ` cerca de ${where}` : ''}`, p ? `De ${p.n} a ${plural(c.n, 'persona', 'personas')}.` : `${plural(c.n, 'persona', 'personas')} en la zona.`);
  }
  return out;
}

/**
 * El parte: dos o tres frases con lo de ahora y la primera prioridad, para leerlo o escucharlo
 * (vista HUD). Sin dueño, solo lo público.
 */
export function briefing({ state = null, notes = [] } = {}) {
  const k = state?.kpis;
  if (!k) return 'Leyendo la calle…';
  const parts = [k.live === 0 ? 'Nadie en la calle' : `${k.live} de ${plural(k.baristas, 'barista', 'baristas')} en la calle`];
  if (k.waiting > 0) parts.push(plural(k.waiting, 'taza apartada', 'tazas apartadas'));
  if (state.owner) parts.push(`${plural(k.cups ?? 0, 'taza', 'tazas')} hoy, ${money(k.total ?? 0)}`);
  const top = notes.find((n) => n.level === 'alta') ?? notes.find((n) => n.level === 'media');
  const tail = !state.owner ? '' : top ? ` Prioridad: ${top.title[0].toLowerCase()}${top.title.slice(1)}.` : ' Sin alertas.';
  return `${parts.join('. ')}.${tail}`;
}

/** La bitácora: lo nuevo arriba, sin pasar de `max`. */
export const pushLog = (log, events, max = 20) => [...[...events].reverse(), ...log].slice(0, max);

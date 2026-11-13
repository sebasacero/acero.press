// Turnos de los baristas en el panel de control (13 nov 2026, pedido del usuario: «debemos
// analizar quién entra y sale, la disponibilidad y demás»). Lee micra_shifts_board
// (20261113210000_micra_shifts.sql). Puro: sin React ni red. Las horas son de Bogotá (UTC−5, sin
// horario de verano).

const H = 3600000;
const BOGOTA = -5;

/** Hora de Bogotá (0–23) y día (AAAA-MM-DD) de un instante en ms. */
export function bogotaParts(ms) {
  const d = new Date(ms + BOGOTA * H);
  return { hour: d.getUTCHours(), day: d.toISOString().slice(0, 10) };
}

/**
 * Los turnos con fin y duración en ms. Abierto = en la calle ahora. Lo abierto que ya pasó su
 * hora se cierra a esa hora ('auto'), aunque la base no lo haya cerrado todavía.
 */
export function normalizeShifts(rows, now = Date.now()) {
  return (rows ?? []).map((r) => {
    const start = Date.parse(r.started_at);
    const planned = Date.parse(r.planned_until);
    let end = r.ended_at ? Date.parse(r.ended_at) : null;
    let kind = r.end_kind ?? null;
    if (end == null && Number.isFinite(planned) && planned <= now) { end = planned; kind = 'auto'; }
    const open = end == null;
    return {
      id: r.id, barista: r.tintero_id, name: r.name || 'Barista', mode: r.mode ?? null,
      start, end, planned, open, kind, cups: Number(r.cups) || 0,
      ms: Math.max(0, (open ? now : end) - start),
    };
  }).filter((s) => Number.isFinite(s.start)).sort((a, b) => b.start - a.start);
}

/** «2 h 10 min», «45 min», «menos de 1 min». */
export function dur(ms) {
  if (ms < 60000) return 'menos de 1 min';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

const KIND = { turno: 'terminó su turno', volver: 'volvió (sin cerrar turno)', auto: 'se apagó a su hora' };
export const kindLabel = (k) => KIND[k] ?? 'salió de la calle';

/** Los turnos de hoy (Bogotá): los abiertos primero y luego los cerrados, del más reciente. */
export function todayShifts(shifts, now = Date.now()) {
  const today = bogotaParts(now).day;
  const list = shifts.filter((s) => bogotaParts(s.start).day === today || s.open);
  return [...list.filter((s) => s.open), ...list.filter((s) => !s.open)];
}

/** Horas en la calle por barista en el periodo, de más a menos. */
export function hoursByBarista(shifts) {
  const by = new Map();
  for (const s of shifts) {
    const x = by.get(s.barista) ?? { id: s.barista, name: s.name, ms: 0, shifts: 0, cups: 0, days: new Set(), ended: 0 };
    x.ms += s.ms; x.shifts += 1; x.cups += s.cups; x.days.add(bogotaParts(s.start).day);
    if (s.kind === 'turno') x.ended += 1;
    by.set(s.barista, x);
  }
  return [...by.values()].map(({ days, ...x }) => ({ ...x, days: days.size, perHour: x.ms > 0 ? x.cups / (x.ms / H) : 0 }))
    .sort((a, b) => b.ms - a.ms);
}

/**
 * Disponibilidad por franja: para cada hora de Bogotá entre `from` y `to`, en cuántos de los
 * `days` días hubo al menos un barista en la calle y cuántos baristas distintos, en promedio.
 * Sirve para ver los huecos (horas sin nadie) y las horas llenas.
 */
export function availability(shifts, { now = Date.now(), days = 7, from = 5, to = 21 } = {}) {
  const hours = [];
  for (let h = from; h <= to; h += 1) hours.push({ hour: h, daysCovered: 0, baristas: 0 });
  const seen = new Map(); // `${día}|${hora}` → Set de baristas
  const since = now - days * 24 * H;
  for (const s of shifts) {
    const a = Math.max(s.start, since);
    const b = s.open ? now : s.end;
    if (!(b > a)) continue;
    // Recorre de hora en hora (marca la hora si el turno la toca)
    for (let t = a - (a % H); t < b; t += H) {
      const { hour, day } = bogotaParts(Math.max(t, a));
      if (hour < from || hour > to) continue;
      const k = `${day}|${hour}`;
      if (!seen.has(k)) seen.set(k, new Set());
      seen.get(k).add(s.barista);
    }
  }
  for (const [k, set] of seen) {
    const hour = Number(k.split('|')[1]);
    const row = hours.find((x) => x.hour === hour);
    row.daysCovered += 1;
    row.baristas += set.size;
  }
  return hours.map((x) => ({ ...x, avg: x.baristas / days, share: x.daysCovered / days }));
}

/** Las horas sin nadie en ningún día del periodo, como franjas «6–8 a. m.». */
export function gaps(avail) {
  const label = (h) => (h === 0 ? '12 a. m.' : h < 12 ? `${h} a. m.` : h === 12 ? '12 m.' : `${h - 12} p. m.`);
  const out = [];
  let run = null;
  for (const x of avail) {
    if (x.daysCovered === 0) run = run ? { ...run, to: x.hour } : { from: x.hour, to: x.hour };
    else if (run) { out.push(run); run = null; }
  }
  if (run) out.push(run);
  return out.map((r) => ({ ...r, label: r.from === r.to ? label(r.from) : `${label(r.from)} a ${label(r.to + 1)}` }));
}

/**
 * «Ahora mismo» dice «X salió de la calle» al ver que alguien dejó de estar en vivo; con los
 * turnos se sabe si terminó su turno o solo volvió. Cambia el título de esos eventos.
 */
export function labelEnds(events, shifts) {
  if (!shifts?.length) return events;
  return events.map((e) => {
    if (!e.key?.startsWith('in:')) return e;
    const id = e.key.slice(3).replace(/:\d+$/, ''); // la clave lleva «:<instante>» al final
    const last = shifts.find((s) => s.barista === id && !s.open);
    if (!last || last.kind !== 'turno') return e;
    return { ...e, title: e.title.replace('salió de la calle', 'terminó su turno'), text: [e.text, `${dur(last.ms)} en la calle · ${last.cups} ${last.cups === 1 ? 'taza' : 'tazas'}`].filter(Boolean).join(' ') };
  });
}

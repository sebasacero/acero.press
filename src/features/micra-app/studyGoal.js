// Las métricas del trabajo de campo del equipo (pedido del usuario, 11 nov 2026: «cuántos vendedores
// nuevos debo mapear y demás información que necesitamos»; luego: «más que el reto, una métrica de
// cómo medir mi trabajo… para llegar a tener una propuesta de valor con este estudio de mercado»).
// Sale de las mismas fichas y encuestas de Estudio (`studyRows`); la meta es la del informe
// (`GOALS` y `MIN_GROUP` de pilotReport.js): 20 encuestas en 3 localidades, 5 o más por localidad,
// que es lo mínimo para mostrar un grupo. Puro.

import { GOALS, MIN_GROUP } from '../admin/piloto/pilotReport.js';

export const STUDY_GOAL = {
  until: '2026-11-30', // fin del plan de noviembre: con la muestra, las propuestas salen en diciembre
  surveys: GOALS.surveyed,
  zones: GOALS.zones,
  perZone: MIN_GROUP,
  // Más o menos uno de cada dos puestos acepta la encuesta: por cada encuesta, dos puestos
  yield: 0.5,
};

const DAY_MS = 86400000;
/** El día en Bogotá (AAAA-MM-DD) de una fecha. */
export const bogotaDay = (d) => new Date(new Date(d).getTime() - 5 * 3600000).toISOString().slice(0, 10);

/** Días de calle (lunes a sábado) desde hoy hasta la fecha meta, contando hoy. Al menos 1. */
export function streetDaysLeft(now = new Date(), until = STUDY_GOAL.until) {
  let n = 0;
  for (let t = Date.parse(`${bogotaDay(now)}T12:00:00Z`); t <= Date.parse(`${until}T12:00:00Z`); t += DAY_MS) {
    if (new Date(t).getUTCDay() !== 0) n += 1;
  }
  return Math.max(1, n);
}

/** La localidad de una ficha (la del formulario o la zona escrita). */
export const zoneOf = (r) => (typeof r?.localidad === 'string' && r.localidad.trim()) || (typeof r?.zone === 'string' && r.zone.trim()) || null;

/** Lo que la ficha tiene que traer para el informe y para invitarlo a Micra. */
export const DATA_NEEDS = [
  { key: 'encuesta', label: 'Encuesta', why: 'precio, tazas al día y gastos: sin ella no hay medianas', has: (r) => !!r.survey },
  { key: 'localidad', label: 'Localidad', why: 'sin ella no cuenta para las 3 localidades', has: (r) => !!zoneOf(r) },
  { key: 'precio', label: 'Precio del tinto', why: 'es la cifra que más se pregunta', has: (r) => r.tinto_price != null },
  { key: 'celular', label: 'Celular', why: 'sin él no se le puede invitar a Micra', has: (r) => !!r.phone },
  { key: 'foto', label: 'Foto con permiso', why: 'para la tarjeta y para reconocer el puesto', has: (r) => !!r.photo_url && r.photo_consent !== false },
  { key: 'gps', label: 'Punto de GPS', why: 'para el mapa y volver al puesto', has: (r) => r.lat != null && r.lng != null },
];

/**
 * El reto: cuántas encuestas faltan, en qué localidades, cuántos puestos nuevos hay que mapear
 * y cuánto toca por día de calle; lo de hoy; y qué dato falta más.
 * `rows`: las de `studyRows` (cada ficha con `survey` o null).
 */
export function studyGoal(rows = [], now = new Date(), goal = STUDY_GOAL) {
  const list = rows ?? [];
  const surveyed = list.filter((r) => r.survey).length;
  const surveysLeft = Math.max(0, goal.surveys - surveyed);
  const perFicha = 1 / goal.yield;

  // Por localidad: fichas y encuestas
  const zones = new Map();
  for (const r of list) {
    const z = zoneOf(r);
    if (!z) continue;
    const e = zones.get(z) ?? { zone: z, fichas: 0, surveyed: 0 };
    e.fichas += 1;
    if (r.survey) e.surveyed += 1;
    zones.set(z, e);
  }
  const byZone = [...zones.values()].sort((a, b) => b.surveyed - a.surveyed || b.fichas - a.fichas || a.zone.localeCompare(b.zone, 'es'));
  const zonesDone = byZone.filter((z) => z.surveyed >= goal.perZone);

  // El plan: completar las localidades más avanzadas y abrir las que falten
  const plan = [];
  for (const z of byZone.filter((x) => x.surveyed < goal.perZone)) {
    if (zonesDone.length + plan.length >= goal.zones) break;
    const need = goal.perZone - z.surveyed;
    const open = z.fichas - z.surveyed; // fichas a las que se puede volver
    plan.push({ zone: z.zone, surveys: need, map: Math.max(0, Math.ceil(need * perFicha) - open), fresh: false });
  }
  while (zonesDone.length + plan.length < goal.zones) {
    plan.push({ zone: null, surveys: goal.perZone, map: Math.ceil(goal.perZone * perFicha), fresh: true });
  }
  // Lo que falta para el total, fuera del plan: primero volviendo a fichas sin encuesta
  const planSurveys = plan.reduce((a, p) => a + p.surveys, 0);
  const extra = Math.max(0, surveysLeft - planSurveys);
  const planZones = new Set(plan.map((p) => p.zone).filter(Boolean));
  const openElsewhere = list.filter((r) => !r.survey && !planZones.has(zoneOf(r))).length;
  const extraMap = Math.max(0, Math.ceil(extra * perFicha) - openElsewhere);
  const toMap = plan.reduce((a, p) => a + p.map, 0) + extraMap;
  const surveysTotalLeft = Math.max(surveysLeft, planSurveys);

  // Por día de calle
  const days = streetDaysLeft(now, goal.until);
  const perDay = { surveys: Math.ceil(surveysTotalLeft / days), fichas: Math.ceil(toMap / days) };

  // Hoy
  const today = bogotaDay(now);
  const isToday = (iso) => !!iso && bogotaDay(iso) === today;
  const todayHave = {
    fichas: list.filter((r) => isToday(r.created_at)).length,
    surveys: list.filter((r) => isToday(r.survey?.surveyed_at ?? r.survey?.created_at)).length,
  };
  const challenge = {
    surveys: { have: todayHave.surveys, goal: perDay.surveys },
    fichas: { have: todayHave.fichas, goal: perDay.fichas },
  };
  challenge.done = todayHave.surveys >= perDay.surveys && todayHave.fichas >= perDay.fichas;

  // El ritmo: los últimos 7 días frente a los 7 anteriores y a lo que pide la fecha meta
  const t0 = now.getTime();
  const inWeek = (iso, back) => { const t = iso ? Date.parse(iso) : NaN; return t <= t0 - back * 7 * DAY_MS && t > t0 - (back + 1) * 7 * DAY_MS; };
  const surveyAt = (r) => r.survey?.surveyed_at ?? r.survey?.created_at;
  const week = {
    surveys: list.filter((r) => inWeek(surveyAt(r), 0)).length,
    fichas: list.filter((r) => inWeek(r.created_at, 0)).length,
    prevSurveys: list.filter((r) => inWeek(surveyAt(r), 1)).length,
    prevFichas: list.filter((r) => inWeek(r.created_at, 1)).length,
  };
  const weeks = days / 6;
  const pace = { surveys: Math.ceil(surveysTotalLeft / weeks), fichas: Math.ceil(toMap / weeks) };
  // A tiempo si al ritmo de esta semana se llega a la fecha
  const onTrack = week.surveys * weeks >= surveysTotalLeft && week.fichas * weeks >= toMap;

  // Fichas que ya sirven enteras para el informe: encuesta y localidad
  const usable = list.filter((r) => r.survey && zoneOf(r)).length;

  // Lo que más falta, de mayor a menor
  const needs = DATA_NEEDS.map((d) => {
    const have = list.filter(d.has).length;
    return { key: d.key, label: d.label, why: d.why, have, total: list.length, missing: list.length - have };
  }).sort((a, b) => b.missing - a.missing);

  return {
    goal, surveyed, surveysLeft: surveysTotalLeft, zonesDone: zonesDone.map((z) => z.zone), byZone,
    plan, extra, toMap, days, perDay, challenge, needs, week, pace, onTrack, usable,
    done: surveysLeft === 0 && zonesDone.length >= goal.zones,
  };
}

/** Qué hacer para subir los números, en orden, dicho como para la calle. A lo más tres. */
export function studyTips(g) {
  const out = [];
  const need = Object.fromEntries(g.needs.map((n) => [n.key, n]));
  const total = need.encuesta?.total ?? 0;
  if (!total) return [{ key: 'start', text: 'Empieza por una localidad: mapea 10 puestos y encuesta a 5 el mismo día.' }];
  const open = total - g.surveyed;
  if (g.surveysLeft > 0 && open > 0) {
    out.push({ key: 'volver', text: `Antes de buscar puestos nuevos, vuelve a los ${open} que ya están en el mapa sin encuesta: abre Estudio, «Cerca de mí» y «Sin encuesta».` });
  }
  if (need.localidad?.missing > total / 2) {
    out.push({ key: 'localidad', text: `${need.localidad.missing} de ${total} fichas no tienen localidad y no cuentan para las ${g.goal.zones} localidades: márcala al hacer la encuesta.` });
  }
  const fresh = g.plan.filter((p) => p.fresh).length;
  if (fresh > 0) {
    out.push({ key: 'zona', text: `Todo está en ${g.byZone.length ? g.byZone.map((z) => z.zone).join(' y ') : 'una sola zona'}: ${fresh === 1 ? 'falta una localidad' : `faltan ${fresh} localidades`}. Un recorrido de una mañana en Chapinero o Teusaquillo, de 7 a 10, da ${g.goal.perZone * 2} puestos.` });
  }
  if (need.celular?.missing > total / 2 && out.length < 3) {
    out.push({ key: 'celular', text: `Solo ${need.celular.have} de ${total} tienen celular: pídelo al cerrar la encuesta («¿le aviso cuando la app esté lista?»).` });
  }
  if (need.precio?.missing > total / 2 && out.length < 3) {
    out.push({ key: 'precio', text: `Pregunta el precio del tinto aunque no haya encuesta: hoy lo tienen ${need.precio.have} de ${total}.` });
  }
  return out.slice(0, 3);
}

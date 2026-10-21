// Informe del piloto: lo que se lleva a la reunión con un distribuidor.
// Toma lo que devuelve /api/v1/bi/piloto (ventas con lugar, fichas de
// tinteros, encuestas, lista de espera) y los supuestos del escenario, y
// arma cada cifra con cuántas respuestas la sostienen (n). Solo datos, sin
// React ni Supabase: corre en node --test.
//
// Reglas de honestidad:
//   - Mediana y rango, no promedios: con 20 o 30 tinteros un valor raro mueve
//     el promedio y la mediana no.
//   - Lo OBSERVADO (ficha: precio del tinto, tazas por hora) y lo DECLARADO
//     (encuesta: tazas al día, café que compran) se nombran distinto.
//   - Lo que es supuesto (escenario) se dice de dónde sale.
//   - Género, edad e ingreso principal solo en grupos de MIN_GROUP o más.
import { OPTIONS, latestByTintero, parseDecimal, parseMoney } from '../survey/survey.js';

export { latestByTintero };

export const MIN_GROUP = 5;
export const WEEKS_PER_MONTH = 52 / 12;
export const DEFAULT_DAYS_PER_WEEK = 6;
export const GOALS = { surveyed: 20, zones: 3, cups: 100 };

export const DEFAULT_SCENARIO = {
  partner: '',
  specialtyPrice: null, // vacío: la mediana de lo que dijeron los tinteros
  gramsPerCup: 18, // receta de la barra
  specialtyCupsPerDay: 10,
  pilotTinteros: 10,
  pilotWeeks: 8,
  kitCost: null,
  startCoffeeKg: 1,
  distributorPriceKg: null, // lo que se negocia
};

// [mínimo, máximo, entero]: los mismos límites que ScenarioIn en la API
const LIMITS = {
  specialtyPrice: [0, 50000],
  gramsPerCup: [5, 40],
  specialtyCupsPerDay: [0, 500],
  pilotTinteros: [1, 500, true],
  pilotWeeks: [1, 52, true],
  kitCost: [0, 10_000_000],
  startCoffeeKg: [0, 100],
  distributorPriceKg: [0, 1_000_000],
};

const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

/** Supuestos limpios: lo que no es número válido vuelve a su valor por defecto. */
export function parseScenario(raw) {
  const s = { ...DEFAULT_SCENARIO };
  if (!raw || typeof raw !== 'object') return s;
  s.partner = typeof raw.partner === 'string' ? raw.partner.trim().slice(0, 80) : '';
  for (const [key, [min, max, int]] of Object.entries(LIMITS)) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (v === null || v === '') { s[key] = DEFAULT_SCENARIO[key]; continue; } // borrar un campo vuelve al supuesto de base
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) continue;
    s[key] = int ? Math.round(n) : n;
  }
  return s;
}

// Campos del formulario de supuestos: los de plata se escriben «300.000»
const MONEY_FIELDS = ['specialtyPrice', 'kitCost', 'distributorPriceKg'];

/** Del formulario (textos como se escriben) a supuestos limpios. */
export function scenarioFromForm(form) {
  const raw = { partner: form?.partner ?? '' };
  for (const key of Object.keys(LIMITS)) {
    const v = form?.[key];
    if (v === undefined) continue;
    if (v === null || String(v).trim() === '') { raw[key] = null; continue; }
    const n = MONEY_FIELDS.includes(key) ? parseMoney(v) : parseDecimal(v);
    raw[key] = Number.isFinite(n) ? n : 'x'; // basura: parseScenario la descarta y deja el de base
  }
  return parseScenario(raw);
}

/** Supuestos a textos para el formulario, escritos como en Colombia (300.000; 16,5). */
export function scenarioToForm(scenario) {
  const s = parseScenario(scenario);
  const out = { partner: s.partner };
  const es = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
  for (const key of Object.keys(LIMITS)) out[key] = s[key] === null ? '' : es.format(s[key]);
  return out;
}

/** Lo que se guarda (PUT /api/v1/bi/piloto/escenario): sin vacíos. */
export function scenarioPayload(scenario) {
  const s = parseScenario(scenario);
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null && v !== ''));
}

export function median(values) {
  const xs = values.filter(isNum).map(Number).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** { n, median, min, max }: n es cuántos valores hay de verdad (sin vacíos). */
export function stat(values) {
  const xs = (values ?? []).filter(isNum).map(Number);
  if (!xs.length) return { n: 0, median: null, min: null, max: null };
  return { n: xs.length, median: median(xs), min: Math.min(...xs), max: Math.max(...xs) };
}

const sum = (xs) => xs.filter(isNum).reduce((a, b) => a + Number(b), 0);

/**
 * Conteo de respuestas de una pregunta de opciones. `protect`: solo se
 * muestran grupos de MIN_GROUP o más; si responden menos de MIN_GROUP no se
 * muestra nada. `order`: 'count' (de más a menos) u 'options' (para rangos).
 */
export function tally(values, options, { protect = false, order = 'count' } = {}) {
  const answers = (values ?? []).filter((v) => v !== null && v !== undefined);
  const n = answers.length;
  let rows = options
    .map(([value, label]) => ({ value, label, count: answers.filter((a) => a === value).length }))
    .filter((r) => r.count > 0);
  if (order === 'count') rows = rows.sort((a, b) => b.count - a.count);
  if (!protect) return { n, rows, hidden: 0, suppressed: false };
  if (n < MIN_GROUP) return { n, rows: [], hidden: n, suppressed: true };
  const shown = rows.filter((r) => r.count >= MIN_GROUP);
  return { n, rows: shown, hidden: n - sum(shown.map((r) => r.count)), suppressed: false };
}

/** Preguntas de varias respuestas (medios de pago): n = quienes respondieron. */
export function multiTally(lists, options) {
  const answered = (lists ?? []).filter((l) => Array.isArray(l) && l.length);
  const rows = options
    .map(([value, label]) => ({ value, label, count: answered.filter((l) => l.includes(value)).length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  return { n: answered.length, rows, hidden: 0, suppressed: false };
}

/** Marcas escritas a mano: se juntan sin importar mayúsculas ni espacios; las 5 primeras y «Otras». */
export function brandTally(names, top = 5) {
  const groups = new Map();
  for (const raw of names ?? []) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const label = raw.trim().replace(/\s+/g, ' ');
    const key = label.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');
    const g = groups.get(key) ?? { value: key, label, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  const all = [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
  const n = sum(all.map((g) => g.count));
  if (all.length <= top + 1) return { n, rows: all, hidden: 0, suppressed: false };
  const rest = all.slice(top);
  return { n, rows: [...all.slice(0, top), { value: 'otras', label: `Otras (${rest.length})`, count: sum(rest.map((g) => g.count)) }], hidden: 0, suppressed: false };
}

const placed = (t) => isNum(t?.carrera) && isNum(t?.calle);
const zoneOf = (t) => (typeof t?.zone === 'string' && t.zone.trim() ? t.zone.trim() : null);

/** Cuentas de un tintero con su ficha y su última encuesta (null donde falta un dato). */
export function tinteroNumbers(t, s) {
  const price = isNum(t?.tinto_price) ? Number(t.tinto_price) : null;
  const cupsDay = isNum(s?.cups_per_day) ? Number(s.cups_per_day) : null;
  const days = isNum(s?.days_per_week) ? Number(s.days_per_week) : null;
  const kgWeek = isNum(s?.coffee_g_week) ? Number(s.coffee_g_week) / 1000 : null;
  const priceKg = isNum(s?.coffee_price_kg) ? Number(s.coffee_price_kg) : null;
  const cupsWeek = cupsDay !== null && days !== null ? cupsDay * days : null;
  const cupsPerKg = cupsWeek && kgWeek ? cupsWeek / kgWeek : null;
  const costPerCup = cupsPerKg && priceKg !== null ? priceKg / cupsPerKg : null;
  const kgMonth = kgWeek !== null ? kgWeek * WEEKS_PER_MONTH : null;
  return {
    price, cupsDay, days, kgWeek, priceKg, cupsPerKg, costPerCup, kgMonth,
    spendMonth: kgMonth !== null && priceKg !== null ? kgMonth * priceKg : null,
    incomeDay: price !== null && cupsDay !== null ? price * cupsDay : null,
    incomeMonth: price !== null && cupsWeek !== null ? price * cupsWeek * WEEKS_PER_MONTH : null,
    marginCup: price !== null && costPerCup !== null ? price - costPerCup : null,
  };
}

/**
 * El informe completo. `data`: la respuesta de /api/v1/bi/piloto.
 * Cada bloque trae sus n; nada se inventa: sin datos, null.
 */
export function buildReport(data, scenarioRaw, { now = new Date() } = {}) {
  const scenario = parseScenario(scenarioRaw);
  const tinteros = data?.tinteros ?? [];
  const sales = data?.sales ?? [];
  const latest = latestByTintero(data?.surveys);
  const rows = tinteros.map((t) => ({ t, s: latest.get(t.id) ?? null }));
  const withSurvey = rows.filter((r) => r.s);
  const nums = rows.map((r) => ({ ...r, x: tinteroNumbers(r.t, r.s) }));
  const surveyedNums = nums.filter((r) => r.s);
  const answers = (key) => withSurvey.map((r) => r.s[key]);

  // ── Muestra ──
  const surveyDates = (data?.surveys ?? []).map((s) => s.surveyed_at).filter(Boolean).sort();
  const sample = {
    total: tinteros.length,
    mapped: tinteros.filter(placed).length,
    surveyed: withSurvey.length,
    visits: (data?.surveys ?? []).length,
    zones: [...new Set(withSurvey.map((r) => zoneOf(r.t)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    first: surveyDates[0] ?? null,
    last: surveyDates[surveyDates.length - 1] ?? null,
    ready: data?.surveysReady !== false,
  };

  // ── Precio del tinto (observado) ──
  const priced = nums.filter((r) => r.x.price !== null);
  const byZone = new Map();
  for (const r of priced) {
    const z = zoneOf(r.t) ?? 'Sin zona';
    byZone.set(z, [...(byZone.get(z) ?? []), r.x.price]);
  }
  const price = {
    ...stat(priced.map((r) => r.x.price)),
    dots: priced.map((r) => ({ price: r.x.price, zone: zoneOf(r.t), cupsDay: r.x.cupsDay })),
    byZone: [...byZone.entries()].map(([zone, xs]) => ({ zone, n: xs.length, median: median(xs) })).sort((a, b) => b.n - a.n || a.zone.localeCompare(b.zone, 'es')),
  };

  // ── Su negocio (declarado; tazas por hora es observado) ──
  const volume = {
    cupsDay: stat(surveyedNums.map((r) => r.x.cupsDay)),
    daysWeek: stat(answers('days_per_week')),
    hoursDay: stat(answers('hours_per_day')),
    cupsHourObserved: stat(tinteros.map((t) => t.cups_per_hour)),
    years: tally(answers('years_selling'), OPTIONS.years_selling, { order: 'options' }),
  };

  // ── Su café hoy (declarado) ──
  const kgMonths = surveyedNums.map((r) => r.x.kgMonth).filter(isNum);
  const spends = surveyedNums.map((r) => r.x.spendMonth).filter(isNum);
  const coffee = {
    kgMonth: stat(kgMonths),
    kgMonthTotal: kgMonths.length ? sum(kgMonths) : null,
    priceKg: stat(answers('coffee_price_kg')),
    spendMonth: stat(spends),
    spendMonthTotal: spends.length ? sum(spends) : null,
    spendN: spends.length,
    cupsPerKg: stat(surveyedNums.map((r) => r.x.cupsPerKg)),
    costPerCup: stat(surveyedNums.map((r) => r.x.costPerCup)),
    brands: brandTally(answers('coffee_brand')),
    where: tally(answers('buys_where'), OPTIONS.buys_where),
  };

  // ── La cuenta del tintero ──
  const specialtyStat = stat(answers('specialty_price'));
  const specialtyPrice = scenario.specialtyPrice ?? specialtyStat.median;
  const specialtySource = scenario.specialtyPrice !== null ? 'escenario' : specialtyStat.n ? 'encuesta' : null;
  const g = scenario.gramsPerCup;
  const P = scenario.distributorPriceKg;
  const daysPerWeek = volume.daysWeek.median ?? DEFAULT_DAYS_PER_WEEK;
  const daysSource = volume.daysWeek.n ? 'encuesta' : 'supuesto';
  // Precio techo por kilo: el que deja a cada taza de especialidad el mismo margen que un tinto
  const ceilings = specialtyPrice === null ? [] : surveyedNums
    .filter((r) => r.x.marginCup !== null)
    .map((r) => Math.max(0, ((specialtyPrice - r.x.marginCup) * 1000) / g));
  const specCostCup = P !== null ? (g * P) / 1000 : null;
  const specMarginCup = specialtyPrice !== null && specCostCup !== null ? specialtyPrice - specCostCup : null;
  const tintero = {
    incomeDay: stat(surveyedNums.map((r) => r.x.incomeDay)),
    incomeMonth: stat(surveyedNums.map((r) => r.x.incomeMonth)),
    marginCup: stat(surveyedNums.map((r) => r.x.marginCup)),
    costPerCup: coffee.costPerCup,
    ceilingKg: stat(ceilings),
    notViable: ceilings.filter((c) => c === 0).length,
    specialty: {
      price: specialtyPrice,
      source: specialtySource,
      surveyStat: specialtyStat,
      grams: g,
      costCup: specCostCup,
      marginCup: specMarginCup,
      cupsPerDay: scenario.specialtyCupsPerDay,
      daysPerWeek,
      daysSource,
      extraMonth: specMarginCup !== null ? scenario.specialtyCupsPerDay * daysPerWeek * WEEKS_PER_MONTH * specMarginCup : null,
    },
  };

  // ── La cuenta del distribuidor ──
  const kgMonthPerTintero = (scenario.specialtyCupsPerDay * g * daysPerWeek * WEEKS_PER_MONTH) / 1000;
  const pilotKgMonth = kgMonthPerTintero * scenario.pilotTinteros;
  const pilotKg = pilotKgMonth * (scenario.pilotWeeks / WEEKS_PER_MONTH);
  const kits = scenario.kitCost !== null ? scenario.pilotTinteros * scenario.kitCost : null;
  const startCoffee = P !== null ? scenario.pilotTinteros * scenario.startCoffeeKg * P : null;
  const distributor = {
    kgMonthPerTintero,
    pilotKgMonth,
    pilotKg,
    pilotSalesMonth: P !== null ? pilotKgMonth * P : null,
    measured: { kgMonth: coffee.kgMonthTotal, n: kgMonths.length, spendMonth: coffee.spendMonthTotal, spendN: spends.length },
    investment: {
      kits,
      coffee: startCoffee,
      total: kits !== null || startCoffee !== null ? (kits ?? 0) + (startCoffee ?? 0) : null,
      missing: [kits === null && 'costo del kit', startCoffee === null && 'precio de distribuidor'].filter(Boolean),
    },
  };

  // ── Disposición y tecnología ──
  const attitude = {
    wouldSell: tally(answers('would_sell_specialty'), OPTIONS.would_sell_specialty, { order: 'options' }),
    kitInterest: tally(answers('kit_interest'), OPTIONS.kit_interest, { order: 'options' }),
    kitPayment: tally(answers('kit_payment'), OPTIONS.kit_payment),
    specialtyPrice: specialtyStat,
  };
  const tech = {
    smartphone: tally(answers('has_smartphone'), OPTIONS.has_smartphone, { order: 'options' }),
    payments: multiTally(answers('payments'), OPTIONS.payments),
  };

  // ── Quiénes son (protegido) ──
  const people = {
    gender: tally(answers('gender'), OPTIONS.gender, { protect: true }),
    age: tally(answers('age_range'), OPTIONS.age_range, { protect: true, order: 'options' }),
    mainIncome: tally(answers('main_income'), OPTIONS.main_income, { protect: true, order: 'options' }),
  };

  // ── Nuestro piloto en la calle ──
  const cups = sum(sales.map((s) => s.cups));
  const income = sum(sales.map((s) => s.total));
  const cur = data?.week?.cur ?? null;
  const prev = data?.week?.prev ?? null;
  const pilot = {
    days: data?.days ?? null,
    cups,
    sales: sales.length,
    income,
    avgTicket: sales.length ? income / sales.length : null,
    blocks: new Set(sales.filter(placed).map((s) => `${Math.round(s.carrera)}|${Math.round(s.calle)}`)).size,
    zones: [...new Set(sales.map(zoneOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    week: cur ? { cur, prev, growth: prev?.cups ? (cur.cups - prev.cups) / prev.cups : null } : null,
    waitlist: data?.waitlist ?? null,
  };

  // ── Listo para la reunión ──
  const count = (id, label, have, goal) => ({ id, label, have, goal, done: have >= goal });
  const check = (id, label, done, hint) => ({ id, label, done, hint });
  const readiness = [
    count('surveyed', 'Tinteros encuestados', sample.surveyed, GOALS.surveyed),
    count('zones', 'Zonas con encuestas', sample.zones.length, GOALS.zones),
    count('cups', 'Tazas vendidas en la calle con lugar', pilot.cups, GOALS.cups),
    check('specialty', 'Precio de la taza de especialidad', specialtyPrice !== null, specialtySource === 'encuesta' ? 'sale de la encuesta' : null),
    check('kit', 'Costo del kit por tintero', scenario.kitCost !== null),
    // El techo es un argumento, no la oferta: sin precio objetivo la propuesta dice «por acordar»
    check('price', 'Tu precio objetivo por kilo, por debajo del techo', P !== null && (tintero.ceilingKg.median === null || P <= tintero.ceilingKg.median),
      P !== null && tintero.ceilingKg.median !== null && P > tintero.ceilingKg.median ? 'está por encima del techo' : null),
    check('partner', 'Para quién es la propuesta', !!scenario.partner),
  ];

  return {
    generatedAt: data?.generatedAt ?? now.toISOString(),
    scenario, sample, price, volume, coffee, tintero, distributor, attitude, tech, people, pilot, readiness,
    ready: readiness.every((r) => r.done),
  };
}

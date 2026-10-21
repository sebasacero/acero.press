import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCENARIO, MIN_GROUP, WEEKS_PER_MONTH, brandTally, buildReport, latestByTintero, median, multiTally, parseScenario, scenarioFromForm, scenarioPayload, scenarioToForm, stat, tally, tinteroNumbers } from './pilotReport.js';
import { OPTIONS } from '../survey/survey.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('mediana y rango con su n; vacíos y basura no cuentan', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
  assert.deepEqual(stat([1500, null, '', 'x', 2000, 1000]), { n: 3, median: 1500, min: 1000, max: 2000 });
  assert.deepEqual(stat(undefined), { n: 0, median: null, min: null, max: null });
});

test('de cada tintero cuenta su encuesta más reciente', () => {
  const m = latestByTintero([
    { id: 'a', tintero_id: 't1', surveyed_at: '2026-10-20T10:00:00Z' },
    { id: 'b', tintero_id: 't1', surveyed_at: '2026-10-22T10:00:00Z' },
    { id: 'c', tintero_id: 't2', surveyed_at: '2026-10-21T10:00:00Z' },
  ]);
  assert.equal(m.get('t1').id, 'b');
  assert.equal(m.size, 2);
});

test('género, edad e ingreso: solo grupos de 5 o más; con menos de 5 respuestas, nada', () => {
  assert.equal(MIN_GROUP, 5);
  const few = tally(['mujer', 'hombre', 'mujer'], OPTIONS.gender, { protect: true });
  assert.deepEqual(few, { n: 3, rows: [], hidden: 3, suppressed: true });
  const six = tally(['mujer', 'mujer', 'mujer', 'mujer', 'mujer', 'hombre'], OPTIONS.gender, { protect: true });
  assert.deepEqual(six.rows.map((r) => [r.label, r.count]), [['Mujer', 5]]);
  assert.equal(six.hidden, 1);
  // Sin proteger (marcas, dónde compran) se ve todo; los rangos quedan en su orden
  const ages = tally(['55_64', '18_24', '18_24'], OPTIONS.age_range, { order: 'options' });
  assert.deepEqual(ages.rows.map((r) => r.value), ['18_24', '55_64']);
});

test('medios de pago cuentan a quien respondió; las marcas escritas a mano se juntan', () => {
  const p = multiTally([['efectivo', 'nequi'], ['efectivo'], [], null], OPTIONS.payments);
  assert.equal(p.n, 2);
  assert.deepEqual(p.rows.map((r) => [r.value, r.count]), [['efectivo', 2], ['nequi', 1]]);
  const b = brandTally(['Águila Roja', 'aguila roja ', 'Sello Rojo', '', null, 'A', 'B', 'C', 'D', 'E']);
  assert.equal(b.n, 8);
  assert.deepEqual(b.rows[0], { value: 'aguila roja', label: 'Águila Roja', count: 2 });
  assert.equal(b.rows.length, 6);
  assert.match(b.rows[5].label, /^Otras \(\d\)$/);
});

test('las cuentas de un tintero salen de su ficha y su encuesta', () => {
  // Tinto a $1.500; 80 tazas al día, 6 días; 3 libras (1,5 kg) a la semana a $40.000 el kilo
  const x = tinteroNumbers({ tinto_price: 1500 }, { cups_per_day: 80, days_per_week: 6, coffee_g_week: 1500, coffee_price_kg: 40000 });
  assert.equal(x.cupsPerKg, 320);
  assert.equal(x.costPerCup, 125);
  assert.equal(x.marginCup, 1375);
  assert.equal(x.incomeDay, 120000);
  close(x.kgMonth, 1.5 * WEEKS_PER_MONTH);
  close(x.spendMonth, 1.5 * WEEKS_PER_MONTH * 40000);
  close(x.incomeMonth, 1500 * 480 * WEEKS_PER_MONTH);
  // Sin días o sin café no se inventa el costo por taza
  const y = tinteroNumbers({ tinto_price: 1500 }, { cups_per_day: 80 });
  assert.equal(y.costPerCup, null);
  assert.equal(y.marginCup, null);
});

test('los supuestos se limpian: lo inválido vuelve al de base, lo borrado también', () => {
  const s = parseScenario({ partner: '  Distribuidora  ', gramsPerCup: '15', pilotTinteros: '12.6', kitCost: 'mucho', specialtyPrice: 99999999, distributorPriceKg: '' });
  assert.equal(s.partner, 'Distribuidora');
  assert.equal(s.gramsPerCup, 15);
  assert.equal(s.pilotTinteros, 13);
  assert.equal(s.kitCost, null);
  assert.equal(s.specialtyPrice, null);
  assert.equal(s.distributorPriceKg, null);
  assert.deepEqual(parseScenario(null), DEFAULT_SCENARIO);
  assert.deepEqual(scenarioPayload({ kitCost: 300000 }), { gramsPerCup: 18, specialtyCupsPerDay: 10, pilotTinteros: 10, pilotWeeks: 8, kitCost: 300000, startCoffeeKg: 1 });
});

// Cinco tinteros encuestados en dos zonas, uno sin encuesta, y dos ventas de Acero
const DATA = {
  generatedAt: '2026-10-22T15:00:00-05:00',
  days: 90,
  surveysReady: true,
  week: { cur: { cups: 12 }, prev: { cups: 8 } },
  waitlist: { cliente: 3, barista: 1 },
  sales: [
    { id: 's1', cups: 2, total: 7000, carrera: 13, calle: 85, zone: 'Zona T' },
    { id: 's2', cups: 1, total: 3500, carrera: 13, calle: 72, zone: 'Chapinero' },
  ],
  tinteros: [
    { id: 't1', zone: 'Chapinero', carrera: 13, calle: 60, tinto_price: 1500, cups_per_hour: 20 },
    { id: 't2', zone: 'Chapinero', carrera: 13, calle: 63, tinto_price: 1500, cups_per_hour: 30 },
    { id: 't3', zone: 'Zona T', carrera: 13, calle: 83, tinto_price: 2000, cups_per_hour: 25 },
    { id: 't4', zone: 'Zona T', carrera: 12, calle: 85, tinto_price: 1800 },
    { id: 't5', zone: 'Chapinero', carrera: 11, calle: 66, tinto_price: 1200 },
    { id: 't6', zone: 'Usaquén', carrera: 6, calle: 119, tinto_price: 1000 }, // sin encuesta
  ],
  surveys: ['t1', 't2', 't3', 't4', 't5'].map((id, i) => ({
    id: `e${i}`, tintero_id: id, surveyed_at: `2026-10-2${i}T10:00:00Z`, consent: true,
    cups_per_day: 80, days_per_week: 6, hours_per_day: 6, coffee_g_week: 1500, coffee_price_kg: 40000,
    coffee_brand: i < 3 ? 'Águila Roja' : 'Sello Rojo', buys_where: 'tienda',
    would_sell_specialty: i < 2 ? 'si' : 'tal_vez', specialty_price: 4000, kit_interest: 'si', kit_payment: 'cuotas',
    has_smartphone: i !== 4, payments: ['efectivo', 'nequi'],
    gender: i < 4 ? 'mujer' : 'hombre', age_range: '45_54', main_income: 'si',
  })),
};

test('el informe: muestra, precio observado por zona y café declarado con su n', () => {
  const r = buildReport(DATA, {});
  assert.deepEqual([r.sample.total, r.sample.mapped, r.sample.surveyed, r.sample.visits], [6, 6, 5, 5]);
  assert.deepEqual(r.sample.zones, ['Chapinero', 'Zona T']);
  assert.deepEqual([r.price.n, r.price.median, r.price.min, r.price.max], [6, 1500, 1000, 2000]);
  assert.deepEqual(r.price.byZone[0], { zone: 'Chapinero', n: 3, median: 1500 });
  assert.equal(r.price.dots.length, 6);
  assert.equal(r.coffee.kgMonth.n, 5);
  close(r.coffee.kgMonthTotal, 5 * 1.5 * WEEKS_PER_MONTH);
  close(r.coffee.spendMonthTotal, 5 * 1.5 * WEEKS_PER_MONTH * 40000);
  assert.deepEqual(r.coffee.brands.rows.map((b) => [b.label, b.count]), [['Águila Roja', 3], ['Sello Rojo', 2]]);
  assert.equal(r.volume.cupsHourObserved.n, 3);
});

test('la cuenta del tintero da el precio techo por kilo del distribuidor', () => {
  const r = buildReport(DATA, {});
  // Taza de especialidad a $4.000 (mediana de la encuesta), 18 g. Margen del tinto: precio − $125 de café
  assert.equal(r.tintero.specialty.price, 4000);
  assert.equal(r.tintero.specialty.source, 'encuesta');
  // Techos: (4000 − (1500−125)) × 1000/18 para t1 y t2; con 2000, 1800 y 1200 para los demás → mediana es la de 1500
  close(r.tintero.ceilingKg.median, ((4000 - 1375) * 1000) / 18);
  assert.equal(r.tintero.ceilingKg.n, 5);
  assert.equal(r.tintero.marginCup.median, 1375);
  // Sin precio de distribuidor no hay margen de la taza ni ingreso extra
  assert.equal(r.tintero.specialty.marginCup, null);
  assert.equal(r.tintero.specialty.extraMonth, null);
});

test('la cuenta del distribuidor y la inversión del piloto salen del escenario', () => {
  const r = buildReport(DATA, { distributorPriceKg: 100000, kitCost: 300000, partner: 'X' });
  // 10 tazas × 18 g × 6 días × 52/12 semanas = 4,68 kg al mes por tintero
  close(r.distributor.kgMonthPerTintero, (10 * 18 * 6 * WEEKS_PER_MONTH) / 1000);
  close(r.distributor.pilotKgMonth, 10 * r.distributor.kgMonthPerTintero);
  close(r.distributor.pilotSalesMonth, r.distributor.pilotKgMonth * 100000);
  close(r.distributor.pilotKg, r.distributor.pilotKgMonth * (8 / WEEKS_PER_MONTH));
  assert.deepEqual(r.distributor.investment, { kits: 3000000, coffee: 1000000, total: 4000000, missing: [] });
  // Taza: $4.000 − 18 g × $100/g = $2.200 de margen; extra al mes con 10 tazas diarias, 6 días
  assert.equal(r.tintero.specialty.costCup, 1800);
  assert.equal(r.tintero.specialty.marginCup, 2200);
  close(r.tintero.specialty.extraMonth, 10 * 6 * WEEKS_PER_MONTH * 2200);
  assert.equal(buildReport(DATA, {}).distributor.investment.total, null);
  assert.deepEqual(buildReport(DATA, {}).distributor.investment.missing, ['costo del kit', 'precio de distribuidor']);
});

test('quiénes son respeta los grupos de 5 y el piloto cuenta las ventas de Acero', () => {
  const r = buildReport(DATA, {});
  assert.deepEqual(r.people.gender.rows, []); // 4 mujeres y 1 hombre: ningún grupo llega a 5
  assert.equal(r.people.gender.hidden, 5);
  assert.deepEqual(r.people.age.rows.map((x) => [x.label, x.count]), [['45 a 54', 5]]);
  assert.equal(r.tech.smartphone.rows.find((x) => x.value === true).count, 4);
  assert.deepEqual([r.pilot.cups, r.pilot.sales, r.pilot.income, r.pilot.blocks], [3, 2, 10500, 2]);
  assert.equal(r.pilot.avgTicket, 5250);
  close(r.pilot.week.growth, 0.5);
  assert.deepEqual(r.pilot.waitlist, { cliente: 3, barista: 1 });
});

test('la lista de preparación dice qué falta para la reunión', () => {
  const r = buildReport(DATA, {});
  const by = Object.fromEntries(r.readiness.map((x) => [x.id, x]));
  assert.deepEqual([by.surveyed.have, by.surveyed.goal, by.surveyed.done], [5, 20, false]);
  assert.equal(by.zones.have, 2);
  assert.equal(by.specialty.done, true);
  assert.equal(by.kit.done, false);
  assert.equal(by.price.done, false); // sin precio objetivo
  assert.equal(r.ready, false);
  const high = Object.fromEntries(buildReport(DATA, { distributorPriceKg: 200000 }).readiness.map((x) => [x.id, x]));
  assert.equal(high.price.done, false);
  assert.equal(high.price.hint, 'está por encima del techo');
  const ok = Object.fromEntries(buildReport(DATA, { distributorPriceKg: 100000 }).readiness.map((x) => [x.id, x]));
  assert.equal(ok.price.done, true);
});

test('sin datos no se rompe ni inventa nada', () => {
  const r = buildReport({}, {});
  assert.equal(r.sample.surveyed, 0);
  assert.equal(r.price.median, null);
  assert.equal(r.coffee.kgMonthTotal, null);
  assert.equal(r.tintero.ceilingKg.n, 0);
  assert.equal(r.tintero.specialty.price, null);
  assert.equal(r.pilot.avgTicket, null);
  assert.equal(r.pilot.week, null);
  assert.equal(r.sample.ready, true);
  assert.equal(buildReport({ surveysReady: false }, {}).sample.ready, false);
});

test('el formulario de supuestos lee la plata como se escribe y vuelve a textos', () => {
  const s = scenarioFromForm({ partner: 'Distribuidora', kitCost: '300.000', distributorPriceKg: '$ 95.000', gramsPerCup: '16,5', pilotTinteros: '12', specialtyPrice: '', startCoffeeKg: 'mucho' });
  assert.equal(s.kitCost, 300000);
  assert.equal(s.distributorPriceKg, 95000);
  assert.equal(s.gramsPerCup, 16.5);
  assert.equal(s.pilotTinteros, 12);
  assert.equal(s.specialtyPrice, null);
  assert.equal(s.startCoffeeKg, 1); // basura: el supuesto de base
  const f = scenarioToForm(s);
  assert.equal(f.kitCost, '300.000');
  assert.equal(f.gramsPerCup, '16,5');
  assert.equal(f.specialtyPrice, '');
  assert.deepEqual(scenarioFromForm(f), s);
});

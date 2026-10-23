import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_SURVEY, LIBRA_G, buildSurvey, optionLabel, parseDecimal, parseMoney, surveyProgress } from './survey.js';

const AT = new Date('2026-10-21T15:00:00Z');
const full = {
  ...EMPTY_SURVEY, consent: true,
  cups_per_day: '80', hours_per_day: '6,5', days_per_week: 6, years_selling: '3_10',
  coffee_brand: ' Águila Roja ', libras_week: '3', price_libra: '$ 20.000', buys_where: 'tienda',
  would_sell_specialty: 'tal_vez', specialty_price: '4.000', kit_interest: 'si', kit_payment: 'cuotas',
  has_smartphone: true, payments: ['efectivo', 'nequi', 'nequi'],
  gender: 'mujer', age_range: '45_54', main_income: 'si', notes: '  Termo de 10 L ',
};

test('sin permiso no se arma nada', () => {
  assert.match(buildSurvey({ ...full, consent: false }).error, /permiso/);
});

test('la libra es de 500 g: el café se guarda en gramos y el precio por kilo', () => {
  const { body } = buildSurvey(full, { surveyedAt: AT });
  assert.equal(LIBRA_G, 500);
  assert.equal(body.coffee_g_week, 1500); // 3 libras
  assert.equal(body.coffee_price_kg, 40000); // $20.000 la libra
  assert.deepEqual(body, {
    consent: true, surveyed_at: '2026-10-21T15:00:00.000Z',
    cups_per_day: 80, hours_per_day: 6.5, days_per_week: 6, coffee_g_week: 1500, coffee_price_kg: 40000, specialty_price: 4000,
    coffee_brand: 'Águila Roja', years_selling: '3_10', buys_where: 'tienda', would_sell_specialty: 'tal_vez', kit_interest: 'si', kit_payment: 'cuotas',
    gender: 'mujer', age_range: '45_54', main_income: 'si', has_smartphone: true, payments: ['efectivo', 'nequi'], notes: 'Termo de 10 L',
  });
});

test('solo con el permiso basta: lo no respondido no viaja', () => {
  const { body } = buildSurvey({ ...EMPTY_SURVEY, consent: true }, { surveyedAt: AT });
  assert.deepEqual(body, { consent: true, surveyed_at: '2026-10-21T15:00:00.000Z' });
  assert.equal(buildSurvey({ ...EMPTY_SURVEY, consent: true, libras_week: '0,5' }).body.coffee_g_week, 250);
});

test('fuera de rango dice qué pregunta corregir', () => {
  assert.match(buildSurvey({ ...full, cups_per_day: '5000' }).error, /Tazas al día/);
  assert.match(buildSurvey({ ...full, hours_per_day: '0' }).error, /Horas/);
  assert.match(buildSurvey({ ...full, days_per_week: 9 }).error, /Días/);
  assert.match(buildSurvey({ ...full, libras_week: 'mucho' }).error, /libras/);
  assert.match(buildSurvey({ ...full, gender: 'x' }).error, /gender/);
  assert.match(buildSurvey({ ...full, payments: ['bitcoin'] }).error, /pago/);
});

test('los números se leen como se escriben en Colombia', () => {
  assert.equal(parseMoney('$ 1.500'), 1500);
  assert.equal(parseMoney(''), null);
  assert.equal(parseDecimal('0,5'), 0.5);
  assert.equal(parseDecimal(''), null);
  assert.ok(Number.isNaN(parseDecimal('dos')));
});

test('el avance cuenta preguntas respondidas y las etiquetas salen de las opciones', () => {
  assert.deepEqual(surveyProgress(EMPTY_SURVEY), { answered: 0, total: 18 });
  assert.equal(surveyProgress(full).answered, 17); // falta qué preferiría
  assert.equal(optionLabel('age_range', '45_54'), '45 a 54');
  assert.equal(optionLabel('has_smartphone', false), 'No');
  assert.equal(optionLabel('gender', 'nada'), null);
});

test('preparación o termo: las tazas del termo solo viajan si eligió el termo', () => {
  const termo = buildSurvey({ ...full, offer_choice: 'termo', thermo_cups_day: '30' }).body;
  assert.equal(termo.offer_choice, 'termo');
  assert.equal(termo.thermo_cups_day, 30);
  const prep = buildSurvey({ ...full, offer_choice: 'preparacion', thermo_cups_day: '30' }).body;
  assert.equal(prep.offer_choice, 'preparacion');
  assert.equal('thermo_cups_day' in prep, false);
  assert.match(buildSurvey({ ...full, offer_choice: 'termo', thermo_cups_day: '900' }).error, /termo/);
  assert.match(buildSurvey({ ...full, offer_choice: 'otra' }).error, /offer_choice/);
  assert.equal(optionLabel('offer_choice', 'termo'), 'Termo con café listo');
});

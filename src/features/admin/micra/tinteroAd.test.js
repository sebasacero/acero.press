import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adCaption, adHours, adPayments, adPlace, adProducts, adStory, adTexts, canAdvertise } from './tinteroAd.js';

const T = {
  name: 'Don Jairo', localidad: 'Chapinero', zone: 'Chapinero', carrera: 13, calle: 72,
  formato: 'termos_a_pie', recorrido: 'ruta', hora_inicio: 6, hora_fin: 12,
  products: ['tinto', 'perico', 'aromatica', 'galletas'], tinto_price: 1500, perico_price: 2000, ad_consent: true,
};

test('sin permiso de publicidad no sale en una tarjeta', () => {
  assert.equal(canAdvertise(T), true);
  assert.equal(canAdvertise({ ...T, ad_consent: false }), false);
  assert.equal(canAdvertise({ ...T, ad_consent: undefined, photo_consent: true }), false);
});

test('la tarjeta lleva su nombre, dónde está y lo que vende con precio', () => {
  assert.deepEqual(adTexts(T), {
    title: 'Don Jairo',
    subtitle: 'TINTERO ALIADO · CHAPINERO',
    place: 'Cl. 72 # 13 · Chapinero',
    announce: 'Vende: Tinto $1.500 · Perico $2.000 · Aromática · Galletas\nTermos a pie · Hace ruta · De 6 a. m. a 12 m.',
  });
});

test('sin cuadra (el sur no tiene cuadrícula) queda la localidad; sin productos, los precios anotados', () => {
  assert.equal(adPlace({ localidad: 'Bosa' }), 'Bosa, Bogotá');
  assert.equal(adPlace({}), 'Bogotá');
  assert.equal(adProducts({ tinto_price: 1200 }), 'Tinto $1.200');
  assert.equal(adTexts({ name: 'Doña Rosa' }).announce, 'Tinto en la calle');
});

test('horario con una o las dos horas', () => {
  assert.equal(adHours({ hora_inicio: 5 }), 'Desde las 5 a. m.');
  assert.equal(adHours({ hora_fin: 16 }), 'Hasta las 4 p. m.');
  assert.equal(adHours({}), '');
});

test('los textos caben en los huecos del editor y el pie de foto los usa', () => {
  const long = adTexts({ ...T, name: 'X'.repeat(90), products: ['tinto', 'perico', 'aromatica', 'chocolate', 'agua_panela', 'ponque', 'galletas', 'empanadas', 'cigarrillos', 'dulces'] });
  assert.ok(long.title.length <= 40 && long.announce.length <= 140 && long.place.length <= 30 && long.subtitle.length <= 48);
  assert.match(adCaption(T), /Don Jairo, tintero aliado de ACERO\.press[\s\S]*📍 Cl\. 72 # 13 · Chapinero/);
});

test('la encuesta completa la tarjeta: cómo le pagan, hace cuánto vende y qué días', () => {
  const survey = { years_selling: 'mas_10', days_per_week: 6, payments: ['efectivo', 'nequi'], notes: 'privado', gender: 'mujer' };
  const x = adTexts({ name: 'Doña Rosa', localidad: 'Bosa', products: ['tinto'], tinto_price: 1200, hora_inicio: 5 }, survey);
  assert.equal(x.announce, 'Vende: Tinto $1.200\nDesde las 5 a. m.\n+10 años vendiendo · 6 días a la semana\nRecibe Efectivo · Nequi');
  assert.doesNotMatch(JSON.stringify(x), /privado|mujer/);
  // La que viene con la ficha desde la API, y sin encuesta queda lo que se vio
  assert.equal(adTexts({ name: 'R', survey }).announce.includes('6 días a la semana'), true);
  assert.equal(adPayments({ payments_seen: ['nequi', 'fiado'] }), 'Recibe Nequi');
  assert.equal(adStory({ days_per_week: 7 }), 'Todos los días');
  assert.equal(adStory(null), '');
});

test('si no cabe todo, se quedan los primeros renglones enteros', () => {
  const survey = { years_selling: 'mas_10', days_per_week: 6, payments: ['efectivo', 'nequi', 'daviplata', 'bre_b', 'tarjeta'] };
  const a = adTexts({ ...T, products: ['tinto', 'perico', 'aromatica', 'chocolate', 'agua_panela', 'galletas'] }, survey).announce;
  assert.ok(a.length <= 140, a);
  assert.match(a, /^Vende: /);
  assert.ok(!a.endsWith('·'));
});

test('con referencia, la ubicación de la tarjeta es la referencia', () => {
  assert.equal(adPlace({ referencia: 'Frente al Éxito', localidad: 'Kennedy' }), 'Frente al Éxito · Kennedy');
  assert.equal(adPlace({ referencia: 'Puerta principal de Plaza de las Américas', localidad: 'Kennedy', carrera: 30, calle: 30 }), 'Puerta principal de Plaza de…');
});

test('si lleva años en el mismo lugar, la tarjeta lo dice', () => {
  assert.equal(adStory({ years_selling: 'mas_10', years_here: 'mas_3' }), '+10 años vendiendo · +3 años aquí');
  assert.equal(adStory({ years_here: '1_6m' }), '');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OUT_MODES, isMode, recordsTrip, consentNeeds, cleanMethods, methodsLabel, toggleMethod, newProduct, menuWith } from './flow.js';

test('tres formas de salir; solo caminando graba el recorrido', () => {
  assert.deepEqual(OUT_MODES.map((m) => m.id), ['fijo', 'sombrilla', 'caminando']);
  assert.equal(isMode('sombrilla'), true);
  assert.equal(isMode('bici'), false);
  assert.equal(recordsTrip('caminando'), true);
  assert.equal(recordsTrip('fijo'), false);
});

test('salir siempre se puede: lo que falta se pide en la misma hoja', () => {
  assert.deepEqual(consentNeeds({ isPublic: false, consented: false }), { ask: true, public: true, location: true });
  assert.deepEqual(consentNeeds({ isPublic: true, consented: false }), { ask: true, public: false, location: true });
  assert.deepEqual(consentNeeds({ isPublic: true, consented: true }), { ask: false, public: false, location: false });
  // El equipo actuando como otro no acepta por él
  assert.equal(consentNeeds({ isPublic: false, consented: false, own: false }).ask, false);
});

test('cómo le pagan: solo medios conocidos, en orden', () => {
  assert.deepEqual(cleanMethods(['nequi', 'efectivo', 'tarjeta', 'nequi']), ['efectivo', 'nequi']);
  assert.equal(methodsLabel(['bre_b', 'efectivo']), 'Efectivo, Bre-B');
  assert.deepEqual(toggleMethod(['efectivo'], 'daviplata'), ['efectivo', 'daviplata']);
  assert.deepEqual(toggleMethod(['efectivo', 'daviplata'], 'efectivo'), ['daviplata']);
});

test('un producto propio necesita nombre y precio razonables', () => {
  assert.deepEqual(newProduct('  Pan   de bono ', '2.500'), { label: 'Pan de bono', price: 2500 });
  assert.ok(newProduct('x', '1000').error);
  assert.ok(newProduct('Empanada', '').error);
  assert.ok(newProduct('Empanada', '60000').error);
  assert.deepEqual(newProduct('Agua', '0'), { label: 'Agua', price: 0 });
});

test('el menú de Vender suma lo propio después de lo de siempre', () => {
  const day = { prices: { tinto: 1500, perico: null, aromatica: 1200 } };
  const m = menuWith(day, [{ id: 'xabc1234567', label: 'Empanada', price: 2500 }, { id: 'malo' }]);
  assert.deepEqual(m.map((x) => x.id), ['tinto', 'aromatica', 'xabc1234567']);
  assert.equal(m[2].one, 'empanada');
  assert.equal(m[2].custom, true);
});

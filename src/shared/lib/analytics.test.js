import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commerce, gaItems, gaValue, isTrackedPath } from './analytics.js';

test('el panel y Mi ruta no se miden; el sitio sí', () => {
  assert.equal(isTrackedPath('/'), true);
  assert.equal(isTrackedPath('/escuela'), true);
  assert.equal(isTrackedPath('/admin'), false);
  assert.equal(isTrackedPath('/admin/pedidos'), false);
  assert.equal(isTrackedPath('/ruta'), false);
  assert.equal(isTrackedPath('/rutas-del-cafe'), true);
});

test('el carrito viaja a GA4 en pesos, con su variante y cantidad', () => {
  const cart = [{ id: 'geisha-250g', variantId: 'v1', name: 'Geisha', variant: '250 g', price: 45000, qty: 2 }, { id: 'sachet', name: 'Sachet', price: 8000, qty: 1 }];
  assert.equal(gaValue(cart), 98000);
  assert.deepEqual(gaItems(cart)[0], { item_id: 'v1', item_name: 'Geisha', item_variant: '250 g', price: 45000, quantity: 2 });
  assert.deepEqual(gaItems(cart)[1], { item_id: 'sachet', item_name: 'Sachet', price: 8000, quantity: 1 });
  assert.deepEqual(commerce(cart, { payment_type: 'whatsapp' }).currency, 'COP');
  assert.equal(commerce([]).value, 0);
});

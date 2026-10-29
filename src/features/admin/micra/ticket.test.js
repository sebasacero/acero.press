import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketLines, ticketText, ticketNumber, ticketFileName } from './ticket.js';

const rec = {
  orderId: '3f2b9c1e-0000-4000-8000-00aa11bb22cc',
  total: 64000,
  payMethod: 'nequi',
  at: Date.UTC(2026, 9, 29, 15, 5), // 10:05 en Bogotá
  lines: [
    { variantId: 1, qty: 2, label: 'Castillo · 250 g', subtotal: 64000 },
  ],
};

test('ticketNumber: las últimas 6 del pedido, en mayúscula; sin pedido, rayas', () => {
  assert.equal(ticketNumber(rec.orderId), '1BB22CC'.slice(-6));
  assert.equal(ticketNumber(null), '——');
});

test('ticketLines: encabezado, número, fecha en Bogotá, cliente, líneas, total y pie', () => {
  const lines = ticketLines({ rec, tintero: { name: 'Don Jairo' } });
  const texts = lines.filter((l) => !l.rule).map((l) => l.text);
  assert.equal(texts[0], 'ACERO.press');
  assert.ok(texts.includes('Ticket BB22CC'));
  assert.ok(texts.some((t) => /29\/10\/2026.*10:05/.test(t)), `fecha: ${texts[5]}`);
  assert.ok(texts.includes('Cliente: Don Jairo'));
  assert.ok(texts.includes('2 × Castillo · 250 g'));
  assert.ok(texts.includes('$64.000'));
  assert.ok(texts.includes('TOTAL $64.000'));
  assert.ok(texts.some((t) => /^Pago: /.test(t)));
  assert.equal(texts.at(-1), 'aceropress.com');
  assert.equal(lines.filter((l) => l.rule).length, 4);
});

test('ticketLines: sin tintero no hay línea de cliente; un pago desconocido no se imprime', () => {
  const texts = ticketLines({ rec: { ...rec, payMethod: 'x' } }).filter((l) => !l.rule).map((l) => l.text);
  assert.ok(!texts.some((t) => /^Cliente/.test(t)));
  assert.ok(!texts.some((t) => /^Pago/.test(t)));
});

test('ticketText: el mismo contenido en texto con separadores', () => {
  const t = ticketText({ rec, tintero: { name: 'Don Jairo' } });
  assert.ok(t.startsWith('ACERO.press\n'));
  assert.ok(t.includes('\n––––'));
  assert.ok(t.includes('TOTAL $64.000'));
});

test('ticketFileName lleva el número del ticket', () => {
  assert.equal(ticketFileName(rec), 'ticket-bb22cc.png');
});

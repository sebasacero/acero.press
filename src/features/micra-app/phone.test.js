import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coMobile, normalizeCoPhone, formatCoPhone, storedPhone, cleanOtp, resendIn, smsError } from './phone.js';

test('un celular colombiano se reconoce como lo escriban', () => {
  for (const v of ['3001234567', '300 123 4567', '300-123-4567', '(300) 123 4567', '+57 300 123 4567', '573001234567', '0057 300 123 4567']) {
    assert.equal(coMobile(v), '3001234567', v);
    assert.equal(normalizeCoPhone(v), '+573001234567', v);
  }
});

test('lo que no es un celular colombiano no pasa', () => {
  for (const v of ['', null, undefined, '300123456', '30012345678', '6011234567', '+1 415 555 0100', '57 601 123 4567', 'hola']) {
    assert.equal(normalizeCoPhone(v), null, String(v));
  }
});

test('se muestra como se dicta, también a medio escribir', () => {
  assert.equal(formatCoPhone('3001234567'), '300 123 4567');
  assert.equal(formatCoPhone('+573001234567'), '300 123 4567');
  assert.equal(formatCoPhone('3001'), '300 1');
  assert.equal(formatCoPhone('300'), '300');
  assert.equal(formatCoPhone(''), '');
  assert.equal(formatCoPhone('300123456789'), '300 123 4567');
});

test('se guarda siempre igual: el celular con su 57; otro país con su indicativo', () => {
  assert.equal(storedPhone('300 123 4567'), '573001234567');
  assert.equal(storedPhone('+57 300 123 4567'), '573001234567');
  assert.equal(storedPhone('573001234567'), '573001234567');
  assert.equal(storedPhone('+1 415 555 0100'), '14155550100');
  assert.equal(storedPhone('  '), '');
  assert.equal(storedPhone('12'), null);
});

test('el código del SMS son seis números', () => {
  assert.equal(cleanOtp(' 12-34 56 7'), '123456');
  assert.equal(cleanOtp('ab'), '');
});

test('otro SMS se puede pedir al minuto', () => {
  assert.equal(resendIn(null), 0);
  assert.equal(resendIn(1000, 1000), 60);
  assert.equal(resendIn(1000, 31000), 30);
  assert.equal(resendIn(1000, 61000), 0);
  assert.equal(resendIn(1000, 99000), 0);
});

test('los errores del SMS se dicen en español', () => {
  assert.match(smsError({ message: 'Token has expired or is invalid' }), /no sirve o ya venció/);
  assert.match(smsError({ code: 'over_sms_send_rate_limit', message: 'x' }), /Espera un minuto/);
  assert.match(smsError({ message: 'Unsupported phone provider' }), /todavía no está activa/);
  assert.match(smsError(new Error('Failed to fetch')), /Sin señal/);
  // Lo de la base ya viene dicho
  assert.equal(smsError({ message: 'Tu número no está registrado.' }), 'Tu número no está registrado.');
});

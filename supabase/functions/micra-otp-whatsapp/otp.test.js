import { test } from 'node:test';
import assert from 'node:assert/strict';
import { otpPhone, otpCode, otpPayload, hookError, hookSecret } from './otp.js';

test('solo se escribe a celulares de Colombia', () => {
  assert.equal(otpPhone('+573001234567'), '573001234567');
  assert.equal(otpPhone('573001234567'), '573001234567');
  assert.equal(otpPhone('+12025550123'), null);
  assert.equal(otpPhone('576012345678'), null); // fijo, no celular
  assert.equal(otpPhone(null), null);
});

test('el código son solo números', () => {
  assert.equal(otpCode('123456'), '123456');
  assert.equal(otpCode('12a456'), null);
  assert.equal(otpCode(''), null);
});

test('la plantilla lleva el código en el cuerpo y en el botón de copiar', () => {
  const p = otpPayload({ to: '573001234567', code: '123456' });
  assert.equal(p.to, '573001234567');
  assert.equal(p.template.name, 'micra_codigo');
  assert.equal(p.template.language.code, 'es');
  assert.equal(p.template.components[0].parameters[0].text, '123456');
  assert.equal(p.template.components[1].sub_type, 'url');
  assert.equal(p.template.components[1].parameters[0].text, '123456');
});

test('errores y secreto en el formato de Supabase', () => {
  assert.deepEqual(hookError('x', 422), { error: { http_code: 422, message: 'x' } });
  assert.equal(hookSecret('v1,whsec_abc123'), 'abc123');
});

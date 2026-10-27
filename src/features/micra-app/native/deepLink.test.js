import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authFromUrl, micraPathFromUrl, startPath, AUTH_REDIRECT } from './deepLink.js';

test('authFromUrl: tokens del flujo implícito en el #', () => {
  assert.deepEqual(authFromUrl(`${AUTH_REDIRECT}#access_token=a1&refresh_token=r1&expires_in=3600&token_type=bearer`), { access_token: 'a1', refresh_token: 'r1' });
});

test('authFromUrl: código PKCE en la consulta', () => {
  assert.deepEqual(authFromUrl(`${AUTH_REDIRECT}?code=abc`), { code: 'abc' });
});

test('authFromUrl: el error de Google o Supabase se dice tal cual', () => {
  assert.deepEqual(authFromUrl(`${AUTH_REDIRECT}?error=access_denied&error_description=Cancelado`), { error: 'Cancelado' });
  assert.deepEqual(authFromUrl(`${AUTH_REDIRECT}#error=server_error`), { error: 'server_error' });
});

test('authFromUrl: un enlace que no es de auth no se toca', () => {
  assert.equal(authFromUrl('https://www.aceropress.com/micra'), null);
  assert.equal(authFromUrl('com.aceropress.micra://micra/b/1234abcd'), null);
  assert.equal(authFromUrl('no es url'), null);
  assert.deepEqual(authFromUrl(AUTH_REDIRECT), { error: 'El inicio de sesión no devolvió una sesión.' });
});

test('micraPathFromUrl: enlaces del sitio y del esquema propio a rutas de Micra', () => {
  assert.equal(micraPathFromUrl('https://www.aceropress.com/micra/b/1234abcd-ef'), '/micra/b/1234abcd-ef');
  assert.equal(micraPathFromUrl('https://aceropress.com/micra/barista?codigo=K7P2'), '/micra/barista?codigo=K7P2');
  assert.equal(micraPathFromUrl('com.aceropress.micra://micra/apartados/'), '/micra/apartados');
  assert.equal(micraPathFromUrl('https://www.aceropress.com/escuela'), null);
  assert.equal(micraPathFromUrl('https://otro.com/micra'), null);
});

test('startPath: la app arranca en /micra', () => {
  assert.equal(startPath('/'), '/micra');
  assert.equal(startPath('/index.html'), '/micra');
  assert.equal(startPath('/micra/barista'), '/micra/barista');
  assert.equal(startPath('/micrafono'), '/micra');
});

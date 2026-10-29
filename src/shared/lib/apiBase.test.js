import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl, setApiBase } from './apiBase.js';

test('relativa en el sitio; con base, la del sitio público', () => {
  assert.equal(apiUrl('/api/v1/bi/piloto'), '/api/v1/bi/piloto');
  setApiBase('https://www.aceropress.com/');
  assert.equal(apiUrl('/api/v1/bi/piloto'), 'https://www.aceropress.com/api/v1/bi/piloto');
  setApiBase('');
  assert.equal(apiUrl('/api/v1/pulse'), '/api/v1/pulse');
});

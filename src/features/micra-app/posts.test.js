import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postKind, mediaError, postPath, cleanCaption, postsToFeed, STATUS_LABEL, MAX_VIDEO_MB } from './posts.js';

const ID = '60000000-0000-0000-0000-00000000000a';

test('solo fotos y videos, con su peso máximo', () => {
  assert.equal(postKind({ type: 'image/jpeg' }), 'foto');
  assert.equal(postKind({ type: 'video/quicktime' }), 'video');
  assert.equal(postKind({ type: 'application/pdf' }), null);
  assert.equal(mediaError({ type: 'image/png', size: 3 * 1048576 }), null);
  assert.match(mediaError({ type: 'video/mp4', size: (MAX_VIDEO_MB + 5) * 1048576 }), /máximo es 25 MB/);
  assert.match(mediaError({ type: 'text/plain', size: 10 }), /Escoge una foto/);
  assert.match(mediaError(null), /Escoge una foto/);
});

test('se guarda en la carpeta del barista con un nombre que la base acepta', () => {
  const p = postPath(ID, 'video/mp4', 1700000000000, () => 0.5);
  assert.match(p, new RegExp(`^${ID}/[A-Za-z0-9_-]{6,64}\\.(mp4)$`));
  assert.equal(postPath(ID, 'image/gif'), null);
  assert.equal(postPath(null, 'image/jpeg'), null);
});

test('el texto: sin espacios de más y hasta 280 letras', () => {
  assert.equal(cleanCaption('  Mi  tinto\n de la mañana '), 'Mi tinto de la mañana');
  assert.equal(cleanCaption('a'.repeat(400)).length, 280);
  assert.equal(cleanCaption(null), '');
});

test('en el muro: con su URL firmada, el nombre de pila y el día en Bogotá', () => {
  const rows = [
    { id: 'p1', tintero_id: ID, name: 'Marlene', referencia: 'Cl. 85 con Cra. 15', kind: 'foto', media_path: `${ID}/a.jpg`, caption: ' Primer tinto ', created_at: '2026-10-31T03:30:00Z' },
    { id: 'p2', tintero_id: ID, name: 'Marlene', kind: 'video', media_path: `${ID}/b.mp4`, created_at: '2026-10-31T15:00:00Z' },
    { id: 'p3', tintero_id: ID, name: 'X', kind: 'gif', media_path: `${ID}/c.gif` },
    null,
  ];
  const f = postsToFeed(rows, { [`${ID}/a.jpg`]: 'https://x/a', [`${ID}/c.gif`]: 'https://x/c' });
  assert.equal(f.length, 1); // sin URL (p2) o raro (p3), no sale
  assert.deepEqual(f[0], {
    id: 'post-p1', kind: 'publicaciones', postId: 'p1', baristaId: ID, by: 'Marlene', where: 'Cl. 85 con Cra. 15',
    media: { kind: 'foto', url: 'https://x/a' }, text: 'Primer tinto', date: '2026-10-30',
  });
  assert.deepEqual(postsToFeed('roto'), []);
  assert.equal(STATUS_LABEL.pending, 'En revisión');
});

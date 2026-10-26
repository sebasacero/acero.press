import test from 'node:test';
import assert from 'node:assert/strict';
import { shapePosts, shortCaption } from './posts.js';

test('el texto de la tarjeta es la primera línea, sin hashtags al final y corto', () => {
  assert.equal(shortCaption('\nCold brew en lata\n#cafe #aeropress'), 'Cold brew en lata');
  assert.equal(shortCaption('Receta nueva #aeropress #bogota'), 'Receta nueva');
  assert.equal(shortCaption(null), '');
  const long = 'palabra '.repeat(20).trim();
  const c = shortCaption(long);
  assert.ok(c.length <= 91 && c.endsWith('…'));
  assert.ok(!c.includes('palabr…'));
});

test('solo quedan publicaciones con imagen y enlace; el video usa su portada', () => {
  const posts = shapePosts([
    { id: '1', media_type: 'IMAGE', media_url: 'https://cdn/x.jpg', permalink: 'https://instagram.com/p/1', caption: 'Hola' },
    { id: '2', media_type: 'VIDEO', media_url: 'https://cdn/v.mp4', thumbnail_url: 'https://cdn/v.jpg', permalink: 'https://instagram.com/p/2' },
    { id: '3', media_type: 'IMAGE', media_url: 'https://cdn/y.jpg' }, // sin enlace
    { id: '4', media_type: 'VIDEO', media_url: 'https://cdn/v.mp4', permalink: 'https://instagram.com/p/4' }, // video sin portada
    { id: '5', media_type: 'IMAGE', media_url: 'javascript:alert(1)', permalink: 'https://instagram.com/p/5' },
  ]);
  assert.deepEqual(posts.map((p) => p.id), ['1', '2']);
  assert.equal(posts[1].image, 'https://cdn/v.jpg');
  assert.equal(posts[1].isVideo, true);
});

test('respeta el máximo y aguanta respuestas raras', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: String(i), media_url: 'https://a/b.jpg', permalink: 'https://c/d' }));
  assert.equal(shapePosts(many, 6).length, 6);
  assert.deepEqual(shapePosts(null), []);
  assert.deepEqual(shapePosts([null]), []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  departamentoDe, igHandle, webUrl, nivelDe, toggleCanal, presenciaMissing, presenciaPayload, presenciaLines, emptyPresencia,
  refCode, readRefParams, rememberRef, readRef, inviteUrl, inviteText, wilson, sampleSize, summarize, aPais, pct,
  parseLista, sortear, readOferta, OFERTA, BASE_FAMILIAS,
} from './presencia.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('el departamento sale del municipio escrito a mano, con o sin tildes', () => {
  assert.equal(departamentoDe('Pitalito, Huila'), 'Huila');
  assert.equal(departamentoDe('planadas - tolima'), 'Tolima');
  assert.equal(departamentoDe('Buesaco, Narino'), 'Nariño');
  assert.equal(departamentoDe('Trujillo, Valle'), 'Valle del Cauca');
  assert.equal(departamentoDe('Quindio'), 'Quindío');
  assert.equal(departamentoDe('Pitalito'), null);
  assert.equal(departamentoDe(''), null);
});

test('Instagram y web se guardan limpios o no se guardan', () => {
  assert.equal(igHandle('@Finca.LaEsperanza'), 'finca.laesperanza');
  assert.equal(igHandle('https://www.instagram.com/cafe_juanambu/?hl=es'), 'cafe_juanambu');
  assert.equal(igHandle('no vale!'), null);
  assert.equal(igHandle('.punto'), null);
  assert.equal(webUrl('fincalaesperanza.co'), 'https://fincalaesperanza.co');
  assert.equal(webUrl('http://finca.com/tienda'), 'https://finca.com/tienda');
  assert.equal(webUrl('mi finca'), null);
  assert.equal(webUrl(''), null);
});

test('el nivel es lo más alto que marcó; «Nada de esto» va sola', () => {
  assert.equal(nivelDe([]), 0);
  assert.equal(nivelDe(['ninguna']), 0);
  assert.equal(nivelDe(['whatsapp']), 1);
  assert.equal(nivelDe(['whatsapp', 'instagram']), 2);
  assert.equal(nivelDe(['facebook', 'web']), 3);
  assert.deepEqual(toggleCanal(['whatsapp', 'instagram'], 'ninguna'), ['ninguna']);
  assert.deepEqual(toggleCanal(['ninguna'], 'whatsapp'), ['whatsapp']);
  assert.deepEqual(toggleCanal(['whatsapp', 'instagram'], 'whatsapp'), ['instagram']);
  assert.deepEqual(toggleCanal(['ninguna'], 'ninguna'), []);
});

test('el paso pide lo mínimo; el permiso del estudio es opcional', () => {
  assert.equal(presenciaMissing(emptyPresencia()).length, 3);
  const ok = { ...emptyPresencia(), canales: ['whatsapp'], venta: 'cooperativa', interes: 'si' };
  assert.deepEqual(presenciaMissing(ok), []);
  assert.deepEqual(presenciaMissing({ ...ok, ig: 'mal usuario' }), ['un usuario de Instagram válido']);
});

test('a la base no va el nombre de la finca ni del caficultor', () => {
  const finca = { owner: 'Rosalba Quintero', name: 'La Esperanza', city: 'Pitalito, Huila', hectares: '3,5' };
  const p = { canales: ['instagram', 'whatsapp'], venta: 'intermediario', interes: 'si', ig: '@laesperanza', web: '', consent: true };
  const out = presenciaPayload(finca, p, { ref: 'Coop Pitalito', muestra: true });
  assert.deepEqual(out, {
    consent: true, finca_key: 'la esperanza|pitalito, huila', departamento: 'Huila', hectareas: 3.5,
    canales: ['whatsapp', 'instagram'], nivel: 2, venta: 'intermediario', interes: 'si', ig: 'laesperanza', web: null, ref: 'coop-pitalito', muestra: true,
  });
  assert.ok(!JSON.stringify(out).includes('Rosalba'));
  assert.equal(presenciaPayload(finca, { ...p, consent: false }).consent, false);
  assert.equal(presenciaPayload(finca, p).ref, null);
  assert.deepEqual(presenciaLines(p), ['En internet: whatsapp en mi celular, instagram de la finca (@laesperanza)', 'Hoy vendo: a un comprador del pueblo']);
});

test('el enlace de invitación lleva su código y la marca de la muestra', () => {
  assert.equal(refCode('Comité del Huila!'), 'comite-del-huila');
  assert.equal(refCode('  '), null);
  assert.deepEqual(readRefParams('?ref=coop-pitalito&m=1'), { ref: 'coop-pitalito', muestra: true });
  assert.deepEqual(readRefParams('?ref=feria'), { ref: 'feria', muestra: false });
  assert.equal(readRefParams('?x=1'), null);
  const s = mem();
  assert.equal(readRef(s), null);
  rememberRef({ ref: 'feria', muestra: false }, s);
  assert.deepEqual(readRef(s), { ref: 'feria', muestra: false });
  assert.equal(inviteUrl('https://www.aceropress.com/', 'Coop Pitalito', true), 'https://www.aceropress.com/micra/fincas?ref=coop-pitalito&m=1');
  assert.equal(inviteUrl('https://www.aceropress.com', ''), 'https://www.aceropress.com/micra/fincas');
  const msg = inviteText({ url: 'https://x/micra/fincas', nombre: 'Don Abdías' });
  assert.match(msg, /^Hola, Don Abdías\./);
  assert.match(msg, /No cuesta nada/);
  assert.match(msg, /https:\/\/x\/micra\/fincas$/);
});

test('Wilson da el mismo margen que el informe: 1 de 26 va de 0,7 % a 19 %', () => {
  const w = wilson(1, 26);
  assert.equal(Math.round(w.lo * 1000) / 10, 0.7);
  assert.equal(Math.round(w.hi * 1000) / 10, 18.9);
  assert.deepEqual(wilson(0, 0), { p: null, lo: null, hi: null });
  assert.equal(wilson(0, 10).lo, 0);
  assert.equal(sampleSize(0.05, 0.03), 203);
  assert.equal(sampleSize(0.5, 0.05), 385);
});

test('el resumen cuenta por nivel, departamento y venta; la muestra se puede ver aparte', () => {
  const rows = [
    { nivel: 0, departamento: 'Huila', venta: 'cooperativa', interes: 'si', canales: ['ninguna'], muestra: true },
    { nivel: 1, departamento: 'Huila', venta: 'intermediario', interes: 'si', canales: ['whatsapp'], muestra: true },
    { nivel: 2, departamento: 'Tolima', venta: 'exportador', interes: 'tal_vez', canales: ['whatsapp', 'instagram'], muestra: true },
    { nivel: 3, departamento: null, venta: 'marca', interes: 'no', canales: ['instagram', 'web'], muestra: false },
    { nivel: 9 },
  ];
  const all = summarize(rows);
  assert.equal(all.n, 4);
  assert.equal(all.cuenta.k, 2);
  assert.equal(all.web.k, 1);
  assert.equal(all.niveles.find((l) => l.key === 'personal').k, 1);
  assert.deepEqual(all.porDepto.map((d) => [d.departamento, d.n, d.cuenta]), [['Huila', 2, 0], ['Sin departamento', 1, 1], ['Tolima', 1, 1]]);
  assert.deepEqual(all.canales.slice(0, 2).map((c) => [c.id, c.k]), [['whatsapp', 2], ['instagram', 2]]);
  assert.equal(all.venta.find((v) => v.id === 'marca').k, 1);
  assert.equal(all.faltan, 199);
  const m = summarize(rows, { soloMuestra: true });
  assert.equal(m.n, 3);
  assert.equal(m.cuenta.k, 1);
  assert.equal(summarize([]).cuenta.p, null);
});

test('la proporción se lleva a las 540.227 familias con su margen', () => {
  assert.equal(aPais({ p: null }), null);
  assert.deepEqual(aPais({ p: 0.02, lo: 0.01, hi: 0.03 }), { mid: 10805, lo: 5402, hi: 16207 });
  assert.equal(BASE_FAMILIAS, 540227);
  assert.equal(pct(0.0215), '2,2 %');
  assert.equal(pct(null), '—');
});

test('la lista pegada se limpia y el sorteo con semilla se puede repetir', () => {
  const lista = parseLista('Finca La Cruz, 300 123 4567\nfinca la cruz;3001234567\nEl Mirador\n\nLa Piragua\t+57 310 555 0000\nSin cel, 123');
  assert.equal(lista.length, 4);
  assert.deepEqual(lista[0], { nombre: 'Finca La Cruz', celular: '573001234567' });
  assert.equal(lista[2].celular, '573105550000');
  assert.equal(lista[3].celular, null);
  const big = Array.from({ length: 50 }, (_, i) => ({ nombre: `F${i}` }));
  const a = sortear(big, 10, 'comite-huila-2026-11');
  const b = sortear(big, 10, 'comite-huila-2026-11');
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((x) => x.nombre)).size, 10);
  assert.notDeepEqual(sortear(big, 10, 'otra'), a);
  assert.equal(sortear(big, 80, 's').length, 50);
  assert.equal(big[0].nombre, 'F0');
});

test('la oferta toma lo del equipo encima de lo de siempre; nada roto pasa', () => {
  assert.equal(readOferta('no es json'), OFERTA);
  assert.equal(readOferta(null), OFERTA);
  const o = readOferta({ precio: 'Gratis hasta junio', beneficios: [{ title: 'Uno', text: 'Dos' }, { title: '' }], pasos: 'no' });
  assert.equal(o.precio, 'Gratis hasta junio');
  assert.equal(o.titulo, OFERTA.titulo);
  assert.deepEqual(o.beneficios, [{ icon: '•', title: 'Uno', text: 'Dos' }]);
  assert.equal(o.pasos, OFERTA.pasos);
});

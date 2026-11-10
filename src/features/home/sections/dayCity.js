// Bogotá a trazo sobre el lomo de la tierra, para el banner de 24 horas: al
// fondo los cerros con Monserrate y las torres; cerca, la cuadra (casas,
// edificios, tiendas con toldo, árboles y faroles), el andén y la calle.
// Se dibuja un sector y se repite: solo los que se ven (g.span a cada lado).
import { rng } from '../lib/dayBanner.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (t, a = {}) => { const x = document.createElementNS(NS, t); for (const k in a) x.setAttribute(k, a[k]); return x; };
const KINDS = ['edificio', 'casa', 'arbol', 'tienda', 'edificio', 'farol', 'torre', 'casa', 'arbol', 'edificio', 'tienda', 'farol'];

export function buildCity(far, near, g) {
  const { R, z, th, span } = g, rad = Math.PI / 180;
  far.replaceChildren(); near.replaceChildren();
  const P = (deg, r) => `${(r * Math.sin(deg * rad)).toFixed(1)} ${(-r * Math.cos(deg * rad)).toFixed(1)}`;
  // cerros: una línea suave, periódica en el sector
  const hill = (t) => (74 + 34 * Math.sin(2 * Math.PI * t - 0.6) + 15 * Math.sin(6 * Math.PI * t + 1.3) + 6 * Math.sin(14 * Math.PI * t)) * z;
  let d = `M${P(0, R - 6)}`;
  for (let i = 0; i <= 80; i += 1) d += ` L${P((i / 80) * th, R + hill(i / 80))}`;
  d += ` L${P(th, R - 6)} A${R - 6} ${R - 6} 0 0 0 ${P(0, R - 6)} Z`;
  const r1 = rng(7), towers = Array.from({ length: 7 }, (_, i) => ({ t: (i + 0.2 + r1() * 0.6) / 7, w: (20 + r1() * 16) * z, h: (96 + r1() * 76) * z, step: r1() < 0.4 }));
  const tm = 0.37, hm = hill(tm);   // Monserrate: la iglesia en lo alto del cerro
  for (let s = -span; s <= span; s += 1) {
    const gs = el('g', { transform: `rotate(${s * th})` });
    gs.appendChild(el('path', { class: 'db-far', d }));
    const c = el('g', { transform: `rotate(${tm * th})` }), y = -R - hm + 2 * z;
    c.appendChild(el('path', { class: 'db-far2', d: `M${-9 * z} ${y} v${-9 * z} h${5 * z} v${-9 * z} l${2.5 * z} ${-6 * z} l${2.5 * z} ${6 * z} v${9 * z} h${8 * z} v${9 * z} Z` }));
    gs.appendChild(c);
    towers.forEach((t) => {
      const k = el('g', { transform: `rotate(${t.t * th})` });
      k.appendChild(el('path', { class: 'db-far2', d: t.step
        ? `M${-t.w / 2} ${-R + 6} V${-R - t.h * 0.82} h${t.w * 0.22} V${-R - t.h} h${t.w * 0.56} V${-R - t.h * 0.82} h${t.w * 0.22} V${-R + 6} Z`
        : `M${-t.w / 2} ${-R + 6} V${-R - t.h} H${t.w / 2} V${-R + 6} Z` }));
      gs.appendChild(k);
    });
    far.appendChild(gs);
  }
  // la cuadra
  const r2 = rng(23), sector = R * th * rad, items = [];
  let x = 0;
  for (let i = 0; x < sector - 70 * z; i += 1) {
    const kind = KINDS[i % KINDS.length];
    const w = ({ edificio: 50 + r2() * 22, casa: 46 + r2() * 12, tienda: 58 + r2() * 10, torre: 40 + r2() * 8, arbol: 30, farol: 16 })[kind] * z;
    const h = ({ edificio: 64 + r2() * 44, casa: 36 + r2() * 10, tienda: 40 + r2() * 6, torre: 108 + r2() * 34, arbol: 50 + r2() * 14, farol: 84 })[kind] * z;
    items.push({ kind, x: x + w / 2, w, h, win: Array.from({ length: 24 }, () => r2() < 0.5), roof: r2() });
    x += w + (8 + r2() * 18) * z;
  }
  const pad = (sector - x) / items.length;   // reparte lo que sobra para que el sector cierre parejo
  const draw = (it, gi) => {
    const { w, h } = it, y0 = -R, L = -w / 2, T = y0 - h, add = (t, a) => gi.appendChild(el(t, a));
    const windows = (top, bottom, cols) => {
      let k = 0;
      const cw = 7 * z, ch = 10 * z, gap = (w - cols * cw) / (cols + 1);
      for (let yy = top; yy < bottom - ch; yy += 18 * z) for (let c = 0; c < cols; c += 1) { add('rect', { class: it.win[k % 24] ? 'db-w' : 'db-w is-off', x: L + gap + c * (cw + gap), y: yy, width: cw, height: ch, rx: 1 }); k += 1; }
    };
    if (it.kind === 'edificio') {
      add('rect', { class: 'db-b', x: L, y: T, width: w, height: h + 5 }); add('path', { class: 'db-d', d: `M${L - 3 * z} ${T} H${-L + 3 * z}` }); windows(T + 9 * z, y0 - 14 * z, w > 60 * z ? 4 : 3);
      if (it.roof < 0.45) add('path', { class: 'db-d', d: `M${L + w * 0.3} ${T} v${-16 * z} m${-5 * z} ${5 * z} h${10 * z}` });
      else if (it.roof < 0.75) add('rect', { class: 'db-b', x: L + w * 0.55, y: T - 11 * z, width: 13 * z, height: 11 * z });
    } else if (it.kind === 'torre') {
      add('rect', { class: 'db-b', x: L, y: T, width: w, height: h + 5 }); add('rect', { class: 'db-b', x: L + w * 0.2, y: T - 12 * z, width: w * 0.6, height: 12 * z });
      add('path', { class: 'db-d', d: `M0 ${T - 12 * z} v${-18 * z}` }); windows(T + 9 * z, y0 - 12 * z, 3);
    } else if (it.kind === 'casa') {
      add('path', { class: 'db-b', d: `M${L} ${y0 + 5} V${T + 14 * z} L0 ${T - 4 * z} L${-L} ${T + 14 * z} V${y0 + 5} Z` }); add('path', { class: 'db-d', d: `M${L - 4 * z} ${T + 17 * z} L0 ${T - 4 * z} L${-L + 4 * z} ${T + 17 * z}` });
      add('rect', { class: 'db-b', x: L + w * 0.16, y: y0 - 20 * z, width: 10 * z, height: 20 * z }); add('rect', { class: it.win[0] ? 'db-w' : 'db-w is-off', x: L + w * 0.58, y: y0 - 22 * z, width: 10 * z, height: 10 * z, rx: 1 });
    } else if (it.kind === 'tienda') {
      add('rect', { class: 'db-b', x: L, y: T, width: w, height: h + 5 }); add('rect', { class: 'db-w', x: L + 7 * z, y: y0 - 23 * z, width: w * 0.42, height: 15 * z, rx: 1 }); add('rect', { class: 'db-b', x: -L - 19 * z, y: y0 - 24 * z, width: 11 * z, height: 24 * z });
      add('path', { class: 'db-aw', d: `M${L - 4 * z} ${T + 13 * z} L${L + 2 * z} ${T + 3 * z} H${-L - 2 * z} L${-L + 4 * z} ${T + 13 * z} Z` });
    } else if (it.kind === 'arbol') {
      add('path', { class: 'db-p', d: `M0 ${y0} V${T + 20 * z}` });
      add('path', { class: 'db-b', d: `M0 ${T + 30 * z} c${-20 * z} ${2 * z} ${-22 * z} ${-22 * z} ${-9 * z} ${-25 * z} c${-2 * z} ${-13 * z} ${18 * z} ${-14 * z} ${19 * z} ${-2 * z} c${14 * z} ${2 * z} ${12 * z} ${25 * z} ${-10 * z} ${27 * z} Z` });
    } else {
      add('circle', { class: 'db-halo', cx: 13 * z, cy: T + 6 * z, r: 30 * z }); add('path', { class: 'db-p', d: `M0 ${y0} V${T + 8 * z} q0 ${-8 * z} ${8 * z} ${-8 * z} h${5 * z}` }); add('circle', { class: 'db-l', cx: 13 * z, cy: T + 4 * z, r: 4.5 * z });
    }
  };
  // la calle, el andén y la línea giran con la cuadra (la línea tiene 12 tramos por sector: cierra con el giro)
  near.appendChild(el('circle', { class: 'db-street', r: R - 66 * z, 'stroke-width': 132 * z }));
  near.appendChild(el('circle', { class: 'db-walk', r: R - 7 * z, 'stroke-width': 14 * z }));
  const dash = (2 * Math.PI * (R - 78 * z)) / (g.N * 12);
  near.appendChild(el('circle', { class: 'db-road', r: R - 78 * z, 'stroke-width': 3 * z, 'stroke-dasharray': `${dash * 0.5} ${dash * 0.5}`, transform: 'rotate(-90)' }));
  for (let s = -span; s <= span; s += 1) items.forEach((it, i) => { const gi = el('g', { transform: `rotate(${s * th + ((it.x + pad * (i + 0.5)) / R) / rad})` }); draw(it, gi); near.appendChild(gi); });
}

// Motor de las transiciones de Micra: cada personaje es una función de la fase p (0..1)
// que devuelve un árbol de elementos; los atributos que son funciones se
// muestrean y salen como animación SMIL en bucle (sin JS en la app).

export const N = 48; // muestras por bucle
export const r1 = (n) => Math.round(n * 10) / 10;

export const rad = (d) => (d * Math.PI) / 180;
export const P = (x, y) => ({ x, y });
// ángulo 0 = hacia abajo, positivo = hacia adelante (derecha)
export const polar = (o, len, a) => P(o.x + len * Math.sin(rad(a)), o.y + len * Math.cos(rad(a)));
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
// tramo: 0 antes de a, 1 después de b, suave en medio
export const seg = (p, a, b) => ease((p - a) / (b - a));

// dos huesos: hombro S, objetivo T, largos a y b; dir=1 codo abajo/atrás
export function ik(S, T, a, b, dir = 1) {
  const dx = T.x - S.x; const dy = T.y - S.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.01, a + b - 0.01);
  const base = Math.atan2(dy, dx);
  const al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const ang = base + dir * al;
  const E = P(S.x + a * Math.cos(ang), S.y + a * Math.sin(ang));
  const k = Math.min(1, (a + b - 0.01) / Math.hypot(dx, dy));
  return { E, T: Math.hypot(dx, dy) > a + b ? P(S.x + dx * k, S.y + dy * k) : T };
}

export const pts = (...ps) => ps.map((q, i) => `${i ? 'L' : 'M'}${r1(q.x)} ${r1(q.y)}`).join(' ');

// pierna: cadera, ángulo del muslo, flexión de rodilla, largos
export function leg(H, thigh, bend, L1 = 62, L2 = 60, foot = 18) {
  const K = polar(H, L1, thigh);
  const s = thigh - bend;
  const A = polar(K, L2, s);
  const phi = clamp(-s * 0.55, -25, 45); // punta abajo al despegar
  const T = P(A.x + foot * Math.cos(rad(phi)), A.y + foot * Math.sin(rad(phi)));
  const Hh = P(A.x - 5 * Math.cos(rad(phi)), A.y - 5 * Math.sin(rad(phi)));
  return { H, K, A, T, Hh };
}

// ciclo de marcha: q en vueltas (0..1 una zancada completa)
export function walk(q, amp = 22, knee = 48) {
  const w = 2 * Math.PI * q;
  return {
    thigh: amp * Math.sin(w),
    bend: 4 + knee * Math.max(0, Math.cos(w)) ** 2,
  };
}

// árbol → texto SVG
export function el(tag, attrs = {}, ...children) { return { tag, attrs, children: children.flat().filter(Boolean) }; }

export function sample(fn) { return Array.from({ length: N + 1 }, (_, i) => fn(i / N)); }

export function render(node, dur) {
  if (typeof node === 'string') return node;
  const stat = []; const anim = [];
  for (const [k, v] of Object.entries(node.attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'tx' || k === 'rot' || k === 'sc') {
      const type = { tx: 'translate', rot: 'rotate', sc: 'scale' }[k];
      const vals = sample(v).map((a) => (Array.isArray(a) ? a.map(r1).join(' ') : r1(a)));
      anim.push(`<animateTransform attributeName="transform" type="${type}" values="${vals.join(';')}" dur="${dur}s" repeatCount="indefinite"${anim.some((x) => x.includes('animateTransform')) ? ' additive="sum"' : ''}/>`);
      continue;
    }
    if (typeof v === 'function') {
      const vals = sample(v).map((a) => (typeof a === 'number' ? r1(a) : a));
      const first = vals[0];
      if (vals.every((x) => x === first)) { stat.push(`${k}="${first}"`); continue; }
      stat.push(`${k}="${first}"`);
      anim.push(`<animate attributeName="${k}" values="${vals.join(';')}" dur="${dur}s" repeatCount="indefinite"/>`);
    } else stat.push(`${k}="${k === 'class' && !String(v).startsWith('ma-') ? `ma-${v}` : v}"`);
  }
  const kids = node.children.map((c) => render(c, dur)).join('');
  const inner = anim.join('') + kids;
  return `<${node.tag}${stat.length ? ' ' + stat.join(' ') : ''}${inner ? `>${inner}</${node.tag}>` : '/>'}`;
}

// Colores por clase, teñibles desde la app (--m-ink, --m-beige, --m-bg)
const STYLE = `<style>
.ma-l{fill:none;stroke:var(--m-ink,#1F2452);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.ma-s{fill:var(--m-beige,#C9BFAE);stroke:var(--m-ink,#1F2452);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}
.ma-k{fill:var(--m-bg,#FFFFFF);stroke:var(--m-ink,#1F2452);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}
.ma-n{fill:var(--m-ink,#1F2452);stroke:var(--m-ink,#1F2452);stroke-width:2.6;stroke-linejoin:round}
.ma-r{fill:var(--m-cta,#DE1B1B);stroke:var(--m-ink,#1F2452);stroke-width:2.2;stroke-linejoin:round}
.ma-rl{fill:none;stroke:var(--m-cta,#DE1B1B);stroke-width:2.6;stroke-linecap:round}
.ma-c{fill:var(--m-coffee,#5A3A26)}
.ma-t{fill:none;stroke:var(--m-ink,#1F2452);stroke-width:1.6;stroke-linecap:round;opacity:.55}
.ma-lo{fill:none;stroke:var(--m-ink,#1F2452);stroke-linecap:round;stroke-linejoin:round}
.ma-lb{fill:none;stroke:var(--m-beige,#C9BFAE);stroke-linecap:round;stroke-linejoin:round}
.ma-lk{fill:none;stroke:var(--m-bg,#FFFFFF);stroke-linecap:round;stroke-linejoin:round}
</style>`;

// miembro con contorno: trazo tinta grueso + relleno encima
export function limb(d, w = 18, fill = 'lb') {
  return [el('path', { class: 'ma-lo', d, 'stroke-width': w + 5.2 }), el('path', { class: `ma-${fill}`, d, 'stroke-width': w })];
}

export function svg({ name, title, dur, w = 360, h = 400, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}" data-name="${name}" data-dur="${dur}">${STYLE}${render(body, dur)}</svg>\n`;
}



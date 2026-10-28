// Los personajes animados de Micra (transiciones y esperas). Cada uno da su
// nombre, la duración del bucle y el cuerpo; motor.js lo vuelve SVG con SMIL.
// Se regeneran con `node src/features/micra-app/animado/generar.js`.
import { P, polar, lerp, clamp, ease, seg, ik, pts, leg, walk, el, limb, rad, r1 } from './motor.js';

const GROUND = 376;
const memo = (fn) => { const c = new Map(); return (p) => { const k = r1(p * 1000); if (!c.has(k)) c.set(k, fn(p)); return c.get(k); }; };
const g = (attrs, ...kids) => el('g', attrs, ...kids);
const path = (cls, d, extra = {}) => el('path', { class: cls, d, ...extra });

// piso: línea y juntas que corren hacia atrás (sensación de avance)
function ground(p, travel, gap, x0 = 24, x1 = 336) {
  const ticks = [];
  const n = Math.ceil((x1 - x0) / gap) + 2;
  for (let i = 0; i < n; i++) {
    ticks.push(path('t', (q) => {
      const x = x0 + ((((i * gap - q * travel) % (n * gap)) + n * gap) % (n * gap));
      return x > x1 || x < x0 ? 'M0 0' : `M${r1(x)} ${GROUND + 4} l-9 14`;
    }));
  }
  return g({}, path('l', `M${x0} ${GROUND} H${x1}`), ...ticks);
}

// cabeza de perfil mirando a la derecha
function head(cx, cy, r = 16, extra = []) {
  return g({},
    path('k', `M${cx - r} ${cy} C${cx - r} ${cy - r * 1.25} ${cx + r} ${cy - r * 1.25} ${cx + r * 0.95} ${cy - 2} L${cx + r + 4} ${cy + 5} L${cx + r * 0.9} ${cy + 7} C${cx + r * 0.8} ${cy + r} ${cx + 2} ${cy + r * 1.15} ${cx - 4} ${cy + r * 0.95} C${cx - r} ${cy + r * 0.7} ${cx - r} ${cy + 4} ${cx - r} ${cy} Z`),
    el('circle', { class: 'n', cx: cx + r * 0.55, cy: cy - 2, r: 1.3 }),
    ...extra,
  );
}

function shoe(L, red = false) {
  return [
    path('lo', (p) => { const q = L(p); return pts(q.Hh, q.T); }, { 'stroke-width': 9 }),
    red && path('rl', (p) => { const q = L(p); const m = P(lerp(q.Hh.x, q.T.x, 0.55), lerp(q.Hh.y, q.T.y, 0.55)); return `M${r1(m.x - 3)} ${r1(m.y - 6)} l6 1`; }),
  ];
}

// ---------------------------------------------------------------- carrito
function carrito() {
  const dur = 2.4; const cycles = 2; const amp = 18;
  const L1 = 62; const L2 = 60; const FOOT = 6;
  const hip0 = P(112, 0);
  const pose = memo((p) => {
    const q = p * cycles;
    const a = walk(q, amp); const b = walk(q + 0.5, amp);
    const la = leg(P(0, 0), a.thigh, a.bend, L1, L2); const lb = leg(P(0, 0), b.thigh, b.bend, L1, L2);
    const low = Math.max(la.A.y, lb.A.y);
    const hy = GROUND - FOOT - low;
    return { hy, a, b };
  });
  const hip = (p) => P(hip0.x, pose(p).hy);
  const legOf = (k) => (p) => { const s = pose(p); return leg(hip(p), s[k].thigh, s[k].bend, L1, L2); };
  const LA = legOf('a'); const LB = legOf('b');
  const bob = (p) => [0, pose(p).hy - pose(0).hy];
  const hy0 = pose(0).hy;
  const stride = 2 * (L1 + L2) * Math.sin(rad(amp)) * 0.92;
  const travel = stride * 2 * cycles;
  const handle = P(212, 214);
  const sh = (p) => P(138, hy0 - 92 + bob(p)[1]);
  const arm = (dx, dy) => (p) => { const S = sh(p); const s2 = P(S.x + dx, S.y + dy); const { E, T } = ik(s2, P(handle.x + dx * 0.4, handle.y + dy * 0.3), 44, 44, -1); return pts(s2, E, T); };
  const legD = (L) => (p) => { const q = L(p); return pts(q.H, q.K, q.A); };
  const wheel = (cx) => g({ rot: (p) => [p * 1200, cx, 356] },
    el('circle', { class: 'k', cx, cy: 356, r: 19 }),
    el('circle', { class: 'l', cx, cy: 356, r: 13 }),
    path('l', `M${cx} 343 V369 M${cx - 11.3} 349.5 L${cx + 11.3} 362.5 M${cx - 11.3} 362.5 L${cx + 11.3} 349.5`),
    el('circle', { class: 'n', cx, cy: 356, r: 2.4 }),
  );
  const steam = (x, off) => path('t', (p) => { const t = (p * 2 + off) % 1; const y = 214 - t * 30; return `M${x} ${r1(y)} c-5 -6 5 -10 0 -16`; }, { opacity: (p) => { const t = (p * 2 + off) % 1; return r1(Math.sin(t * Math.PI) * 0.9); }, 'stroke-width': 2.2 });

  const body = g({},
    // carro
    g({},
      path('l', 'M212 206 L226 300 M224 300 L226 340 M304 300 L306 340'),
      el('rect', { class: 'k', x: 224, y: 300, width: 94, height: 40, rx: 3 }),
      el('circle', { class: 'r', cx: 300, cy: 320, r: 4.5 }),
      path('l', 'M232 312 h44 M232 324 h30'),
      el('rect', { class: 's', x: 220, y: 246, width: 100, height: 9, rx: 2 }),
      path('l', 'M226 255 L226 300 M314 255 L314 300'),
      // termo
      el('rect', { class: 's', x: 232, y: 198, width: 20, height: 48, rx: 4 }),
      el('rect', { class: 'n', x: 234, y: 190, width: 16, height: 9, rx: 2 }),
      path('l', 'M252 206 c8 0 8 14 0 14'),
      // vasos
      path('k', 'M262 222 h18 l-2 24 h-14 Z'), path('l', 'M263 230 h16'),
      path('k', 'M284 228 h14 l-1.5 18 h-11 Z'),
      // aeropress
      el('rect', { class: 'k', x: 302, y: 212, width: 12, height: 34, rx: 1 }),
      el('rect', { class: 'r', x: 300, y: 205, width: 16, height: 7, rx: 1.5 }),
      steam(268, 0), steam(274, 0.5),
      wheel(240), wheel(304),
    ),
    // pierna de atrás y brazo de atrás
    g({}, ...limb(legD(LB), 19), ...shoe(LB, true)),
    g({}, ...limb(arm(-6, 4), 12)),
    g({}, ...limb(legD(LA), 19), ...shoe(LA, true)),
    // torso (sudadera) y cabeza, con el rebote
    g({ tx: bob },
      path('s', `M94 ${hy0 + 10} C88 ${hy0 - 30} 98 ${hy0 - 74} 122 ${hy0 - 98} C134 ${hy0 - 108} 150 ${hy0 - 104} 154 ${hy0 - 90} C158 ${hy0 - 66} 148 ${hy0 - 30} 136 ${hy0 + 10} Z`),
      path('l', `M100 ${hy0} C112 ${hy0 + 4} 124 ${hy0 + 4} 134 ${hy0 - 2}`),
      path('l', `M120 ${hy0 - 60} C 124 ${hy0 - 44} 124 ${hy0 - 30} 120 ${hy0 - 18}`),
      path('s', `M126 ${hy0 - 104} C116 ${hy0 - 128} 128 ${hy0 - 150} 148 ${hy0 - 148} C140 ${hy0 - 134} 140 ${hy0 - 116} 146 ${hy0 - 104} Z`),
      head(158, hy0 - 128, 15, [
        path('n', `M144 ${hy0 - 136} C146 ${hy0 - 150} 166 ${hy0 - 152} 172 ${hy0 - 138} C164 ${hy0 - 142} 154 ${hy0 - 140} 148 ${hy0 - 130} Z`),
      ]),
    ),
    g({}, ...limb(arm(4, 0), 12),
      el('circle', { class: 'k', r: 5.5, cx: handle.x + 1.6, cy: handle.y }),
    ),
  );
  return { name: 'carrito', title: 'Barista empujando el carrito', dur, body: g({}, ground(0, travel, stride), body) };
}


// ---------------------------------------------------------------- comunes
const rotPt = (q, c, deg) => { const a = rad(deg); const dx = q.x - c.x; const dy = q.y - c.y; return P(c.x + dx * Math.cos(a) - dy * Math.sin(a), c.y + dx * Math.sin(a) + dy * Math.cos(a)); };

// caminante en el sitio: piernas, rebote y cuánto corre el piso
function walker({ x, cycles, amp = 18, knee = 44, L1 = 62, L2 = 60 }) {
  const pose = memo((p) => {
    const q = p * cycles;
    const a = walk(q, amp, knee); const b = walk(q + 0.5, amp, knee);
    const la = leg(P(0, 0), a.thigh, a.bend, L1, L2); const lb = leg(P(0, 0), b.thigh, b.bend, L1, L2);
    return { hy: GROUND - 6 - Math.max(la.A.y, lb.A.y), a, b };
  });
  const hy0 = pose(0).hy;
  const legOf = (k) => (p) => { const s = pose(p); return leg(P(x, s.hy), s[k].thigh, s[k].bend, L1, L2); };
  const stride = 2 * (L1 + L2) * Math.sin(rad(amp)) * 0.92;
  return { LA: legOf('a'), LB: legOf('b'), hy0, bob: (p) => [0, pose(p).hy - hy0], dy: (p) => pose(p).hy - hy0, stride, travel: stride * 2 * cycles };
}
const legD = (L) => (p) => { const q = L(p); return pts(q.H, q.K, q.A); };

// piernas quietas de alguien parado
function standLegs(x, hy, w = 19, fill = 'lb') {
  const L = (dx, th) => () => leg(P(x + dx, hy), th, 6);
  const a = L(-5, -3); const b = L(6, 4);
  return [g({}, ...limb(legD(a), w, fill), ...shoe(a)), g({}, ...limb(legD(b), w, fill), ...shoe(b))];
}
const HY = GROUND - 6 - 121;

function brazo(S, T, a = 44, b = 42, dir = 1, w = 12, fill = 'lb') {
  const d = (p) => { const s = S(p); const t = T(p); const r = ik(s, t, a, b, dir); return pts(s, r.E, r.T); };
  return [...limb(d, w, fill), el('circle', { class: 'k', r: 5.5, cx: (p) => ik(S(p), T(p), a, b, dir).T.x, cy: (p) => ik(S(p), T(p), a, b, dir).T.y })];
}

// ---------------------------------------------------------------- ruana
function ruana() {
  const dur = 2.8; const cycles = 2;
  const W = walker({ x: 150, cycles, amp: 17, knee: 40 });
  const h = W.hy0;
  const S = P(160, h - 90);
  const swing = (p) => -13 * Math.sin(2 * Math.PI * p * cycles);
  return {
    name: 'ruana', title: 'Señor de ruana caminando con su termo', dur,
    body: g({},
      ground(0, W.travel, W.stride),
      g({}, ...limb(legD(W.LB), 19), ...shoe(W.LB)),
      g({}, ...limb(legD(W.LA), 19), ...shoe(W.LA)),
      g({ tx: W.bob },
        // brazo con el termo, colgando bajo la ruana
        g({ rot: (p) => [swing(p), S.x, S.y] },
          ...limb(`M${S.x} ${S.y} L${S.x + 2} ${S.y + 48} L${S.x + 6} ${S.y + 92}`, 12, 'lk'),
          el('rect', { class: 's', x: S.x - 2, y: S.y + 92, width: 17, height: 50, rx: 4 }),
          el('rect', { class: 'n', x: S.x + 1, y: S.y + 140, width: 11, height: 6, rx: 1.5 }),
          path('l', `M${S.x - 2} ${S.y + 104} h17 M${S.x - 2} ${S.y + 130} h17`),
          el('circle', { class: 'k', cx: S.x + 6, cy: S.y + 96, r: 6 }),
        ),
        // ruana, con un vaivén leve
        g({ rot: (p) => [1.8 * Math.sin(2 * Math.PI * (p * cycles * 2 + 0.2)), 162, h - 100] },
          path('s', `M148 ${h - 104} C122 ${h - 98} 104 ${h - 60} 94 ${h + 14} L208 ${h + 20} C204 ${h - 40} 192 ${h - 88} 178 ${h - 104} C170 ${h - 108} 156 ${h - 108} 148 ${h - 104} Z`),
          path('rl', `M186 ${h - 96} C194 ${h - 60} 198 ${h - 20} 199 ${h + 18}`, { 'stroke-width': 5 }),
          path('l', `M128 ${h - 70} C122 ${h - 40} 118 ${h - 10} 116 ${h + 14} M160 ${h - 60} C162 ${h - 30} 160 ${h} 158 ${h + 16}`),
          path('t', `M98 ${h + 16} l-2 7 M106 ${h + 17} l-2 7 M114 ${h + 17} l-2 7 M122 ${h + 18} l-2 7 M130 ${h + 18} l-2 7 M138 ${h + 18} l-2 7 M146 ${h + 19} l-2 7 M154 ${h + 19} l-2 7 M162 ${h + 19} l-2 7 M170 ${h + 20} l-2 7 M178 ${h + 20} l-2 7 M186 ${h + 20} l-2 7 M194 ${h + 21} l-2 7 M202 ${h + 21} l-2 7`, { 'stroke-width': 2 }),
          path('k', `M152 ${h - 104} L164 ${h - 92} L176 ${h - 104} Z`),
        ),
        // mano de adelante con la AeroPress
        ...limb(`M188 ${h - 52} L210 ${h - 60}`, 11, 'lk'),
        el('rect', { class: 'k', x: 207, y: h - 104, width: 14, height: 40, rx: 1.5 }),
        el('rect', { class: 'n', x: 205, y: h - 110, width: 18, height: 6, rx: 1.5 }),
        path('c', `M209 ${h - 86} h10 v18 h-10 Z`),
        el('circle', { class: 'k', cx: 213, cy: h - 62, r: 6 }),
        // cabeza: gorra, bigote, oreja
        head(168, h - 122, 16, [
          path('l', `M175 ${h - 116} c4 3 9 3 12 0`, { 'stroke-width': 4.2 }),
          path('l', `M158 ${h - 124} c-4 0 -4 8 0 8`),
          path('s', `M150 ${h - 128} C150 ${h - 146} 182 ${h - 150} 186 ${h - 134} L194 ${h - 131} C190 ${h - 128} 172 ${h - 128} 150 ${h - 128} Z`),
        ]),
      ),
    ),
  };
}

// ---------------------------------------------------------------- caminando
function caminando() {
  const dur = 2.4; const cycles = 2;
  const W = walker({ x: 150, cycles, amp: 18, knee: 46, L1: 64, L2: 62 });
  const h = W.hy0;
  const S = P(156, h - 92);
  const swing = (p) => 16 * Math.sin(2 * Math.PI * p * cycles);
  return {
    name: 'caminando', title: 'Barista caminando con su AeroPress y su termo', dur,
    body: g({},
      ground(0, W.travel, W.stride),
      g({}, ...limb(legD(W.LB), 14, 'lk'), ...shoe(W.LB, true)),
      // brazo de atrás con el termo
      g({ tx: W.bob }, g({ rot: (p) => [swing(p), S.x - 4, S.y] },
        ...limb(`M${S.x - 4} ${S.y} L${S.x - 6} ${S.y + 44} L${S.x - 2} ${S.y + 84}`, 10, 'lk'),
        el('rect', { class: 's', x: S.x - 9, y: S.y + 84, width: 14, height: 42, rx: 4 }),
        el('rect', { class: 'n', x: S.x - 7, y: S.y + 124, width: 10, height: 5, rx: 1.5 }),
        el('circle', { class: 'k', cx: S.x - 2, cy: S.y + 88, r: 5.5 }),
      )),
      g({}, ...limb(legD(W.LA), 14, 'lk'), ...shoe(W.LA, true)),
      g({ tx: W.bob },
        // pelo largo detrás
        path('k', `M146 ${h - 140} C136 ${h - 124} 138 ${h - 100} 134 ${h - 84} L156 ${h - 92} L158 ${h - 132} Z`),
        path('l', `M142 ${h - 120} c-2 10 -3 20 -5 28`),
        // shorts y camiseta
        path('s', `M132 ${h - 10} L172 ${h - 10} L176 ${h + 34} L154 ${h + 36} L150 ${h + 14} L146 ${h + 36} L126 ${h + 34} Z`),
        path('s', `M136 ${h - 6} C134 ${h - 40} 136 ${h - 76} 144 ${h - 98} C152 ${h - 104} 166 ${h - 104} 172 ${h - 96} C178 ${h - 70} 176 ${h - 36} 172 ${h - 6} Z`),
        // bolso cruzado
        path('l', `M168 ${h - 98} L134 ${h - 12}`),
        el('rect', { class: 's', x: 122, y: h - 16, width: 24, height: 18, rx: 3 }),
        // pañoleta roja
        path('r', `M150 ${h - 102} L172 ${h - 100} L162 ${h - 84} Z`),
        // brazo de adelante, palma arriba con la AeroPress
        ...limb(`M164 ${h - 88} L174 ${h - 50} L204 ${h - 56}`, 10, 'lk'),
        el('ellipse', { class: 'k', cx: 208, cy: h - 57, rx: 9, ry: 4 }),
        el('rect', { class: 'k', x: 201, y: h - 98, width: 14, height: 38, rx: 1.5 }),
        el('rect', { class: 'r', x: 199, y: h - 104, width: 18, height: 6, rx: 1.5 }),
        path('c', `M203 ${h - 80} h10 v16 h-10 Z`),
        head(162, h - 122, 15, [
          path('n', `M146 ${h - 124} C142 ${h - 146} 170 ${h - 152} 178 ${h - 134} C168 ${h - 140} 156 ${h - 136} 150 ${h - 118} Z`),
        ]),
      ),
    ),
  };
}

// mostrador de frente (barra del carrito)
function counter(x0 = 198, x1 = 340, top = 296) {
  return g({},
    el('rect', { class: 's', x: x0, y: top, width: x1 - x0, height: 8, rx: 2 }),
    el('rect', { class: 'k', x: x0 + 6, y: top + 8, width: x1 - x0 - 12, height: GROUND - top - 8 }),
    path('l', `M${x0 + 18} ${top + 30} h40 M${x0 + 18} ${top + 42} h26`),
    el('circle', { class: 'r', cx: x1 - 24, cy: top + 36, r: 4.5 }),
  );
}

// ---------------------------------------------------------------- aeropress
function aeropress() {
  const dur = 3.2;
  const hip = P(146, HY);
  const press = (p) => (p < 0.8 ? seg(p, 0.1, 0.7) : 1 - seg(p, 0.82, 0.98));
  const seal = (p) => lerp(204, 250, press(p));
  const lean = (p) => 7 * press(p) + 1;
  const DX = 22;
  const sh = (dx) => (p) => { const q = rotPt(P(162 + dx, HY - 90), hip, lean(p)); return P(q.x + DX, q.y); };
  const flange = (p) => seal(p) - 60;
  const hand = (dx) => (p) => P(250 + dx, flange(p) - 5);
  const jar = (p) => (p < 0.8 ? 22 * seg(p, 0.12, 0.74) : 22 * (1 - seg(p, 0.82, 0.98)));
  const steam = (x, off) => path('t', (p) => { const t = (p * 2 + off) % 1; return `M${x} ${r1(254 - t * 26)} c-5 -6 5 -10 0 -16`; }, { opacity: (p) => r1(Math.sin(((p * 2 + off) % 1) * Math.PI) * 0.8 * seg(p, 0.5, 0.7) * (1 - seg(p, 0.86, 0.98))), 'stroke-width': 2.2 });
  return {
    name: 'aeropress', title: 'Barista preparando café en AeroPress', dur,
    body: g({},
      path('l', `M24 ${GROUND} H336`),
      ...brazo(sh(-6), hand(-6), 46, 44),
      g({ transform: `translate(${DX} 0)` }, ...standLegs(hip.x, hip.y)),
      g({ transform: `translate(${DX} 0)` }, g({ rot: (p) => [lean(p), hip.x, hip.y] },
        // moño
        el('circle', { class: 'k', cx: 146, cy: HY - 140, r: 8 }),
        path('s', `M134 ${HY + 6} C132 ${HY - 30} 134 ${HY - 70} 142 ${HY - 94} C150 ${HY - 102} 170 ${HY - 102} 176 ${HY - 92} C182 ${HY - 66} 180 ${HY - 30} 174 ${HY + 6} Z`),
        // delantal
        path('k', `M158 ${HY - 70} L180 ${HY - 72} C182 ${HY - 40} 182 ${HY} 178 ${HY + 40} L156 ${HY + 40} Z`),
        el('circle', { class: 'r', cx: 170, cy: HY - 58, r: 3.2 }),
        path('l', `M158 ${HY - 70} L160 ${HY - 96}`),
        head(166, HY - 120, 15, [
          path('n', `M150 ${HY - 122} C146 ${HY - 144} 172 ${HY - 150} 180 ${HY - 132} C170 ${HY - 138} 158 ${HY - 134} 154 ${HY - 116} Z`),
        ]),
      )),
      counter(),
      // jarra de vidrio
      path('c', (p) => `M232 ${r1(294 - jar(p))} H268 V294 H232 Z`),
      path('l', 'M230 260 V294 H270 V260 M270 268 c8 0 8 16 0 16'),
      // chorrito durante el prensado
      path('c', (p) => `M248 258 H252 V${r1(294 - jar(p))} H248 Z`, { opacity: (p) => r1(seg(p, 0.12, 0.18) * (1 - seg(p, 0.68, 0.74))) }),
      // cámara con el café que baja
      path('c', (p) => `M240 ${r1(seal(p))} H260 V254 H240 Z`),
      el('rect', { class: 'l', x: 238, y: 196, width: 24, height: 60, rx: 1 }),
      el('rect', { class: 'n', x: 236, y: 254, width: 28, height: 6, rx: 1.5 }),
      path('l', 'M234 196 h32'),
      // émbolo
      g({ tx: (p) => [0, seal(p) - 204] },
        el('rect', { class: 'k', x: 242, y: 148, width: 16, height: 56, rx: 1 }),
        el('rect', { class: 'n', x: 241, y: 200, width: 18, height: 5, rx: 1 }),
        el('rect', { class: 'r', x: 234, y: 142, width: 32, height: 7, rx: 2 }),
      ),
      steam(246, 0), steam(254, 0.5),
      ...brazo(sh(4), hand(4), 46, 44),
    ),
  };
}

// ---------------------------------------------------------------- molino
function molino() {
  const dur = 2.4; const turns = 3;
  const hip = P(146, HY);
  const C = P(249, 206);
  const phi = (p) => 2 * Math.PI * turns * p;
  const knob = (p) => P(C.x + 30 * Math.cos(phi(p)), C.y + 7 * Math.sin(phi(p)));
  const sway = (p) => 2 + 1.5 * Math.cos(phi(p));
  const DX = 16;
  const sh = (dx) => (p) => { const q = rotPt(P(160 + dx, HY - 90), hip, sway(p)); return P(q.x + DX, q.y); };
  const grains = [0, 0.33, 0.66].map((o, i) => el('circle', { class: 'c', r: 1.6, cx: 244 + i * 5, cy: (p) => r1(276 + ((p * 4 + o) % 1) * 12), opacity: (p) => r1(Math.sin(((p * 4 + o) % 1) * Math.PI)) }));
  const beans = [[292, 292], [300, 293], [308, 291], [316, 293]].map(([x, y]) => g({}, el('ellipse', { class: 'c', cx: x, cy: y, rx: 3.6, ry: 2.6 }), path('t', `M${x - 2} ${y} h4`, { opacity: 0.9, style: 'stroke:#fff' })));
  const knobBack = (p) => Math.sin(phi(p)) < -1e-6;
  const crank = (cls) => path('l', (p) => { const k = knob(p); return `M${C.x} ${C.y} L${r1(k.x)} ${r1(k.y)} V${r1(k.y - 12)}`; }, { 'stroke-width': 3.4, opacity: cls === 'back' ? (p) => (knobBack(p) ? 1 : 0) : (p) => (knobBack(p) ? 0 : 1) });
  return {
    name: 'molino', title: 'Barista moliendo café a mano', dur,
    body: g({},
      path('l', `M24 ${GROUND} H336`),
      g({ transform: `translate(${DX} 0)` }, ...standLegs(hip.x, hip.y)),
      ...brazo(sh(-6), () => P(234, 246), 46, 44),
      g({ transform: `translate(${DX} 0)` }, g({ rot: (p) => [sway(p), hip.x, hip.y] },
        path('s', `M132 ${HY + 6} C128 ${HY - 30} 132 ${HY - 70} 140 ${HY - 94} C148 ${HY - 104} 170 ${HY - 104} 178 ${HY - 92} C184 ${HY - 66} 182 ${HY - 30} 176 ${HY + 6} Z`),
        path('k', `M160 ${HY - 70} L182 ${HY - 72} C184 ${HY - 40} 184 ${HY} 180 ${HY + 40} L158 ${HY + 40} Z`),
        el('circle', { class: 'r', cx: 172, cy: HY - 58, r: 3.2 }),
        path('l', `M160 ${HY - 70} L162 ${HY - 98}`),
        head(166, HY - 120, 15, [
          path('s', `M150 ${HY - 124} C150 ${HY - 144} 180 ${HY - 146} 182 ${HY - 128} L194 ${HY - 126} C190 ${HY - 122} 170 ${HY - 122} 150 ${HY - 124} Z`),
          path('l', `M158 ${HY - 118} c-4 0 -4 8 0 8`),
        ]),
      )),
      counter(),
      // bolsa de café y granos
      path('s', 'M286 250 L314 250 L318 288 L282 288 Z'), path('l', 'M286 250 l3 -8 h22 l3 8'),
      el('circle', { class: 'r', cx: 300, cy: 268, r: 4 }),
      ...beans,
      crank('back'),
      // molino
      el('rect', { class: 'k', x: 236, y: 220, width: 26, height: 76, rx: 3 }),
      path('l', 'M236 234 h26 M236 266 h26 M242 240 v20 M249 240 v20 M256 240 v20'),
      el('rect', { class: 'l', x: 240, y: 272, width: 18, height: 20, rx: 2 }),
      path('c', 'M241 286 h16 v5 h-16 Z'),
      ...grains,
      el('rect', { class: 'n', x: 238, y: 212, width: 22, height: 8, rx: 2 }),
      path('l', `M${C.x} 212 V${C.y}`),
      crank('front'),
      ...brazo(sh(4), (p) => { const k = knob(p); return P(k.x, k.y - 14); }, 46, 44),
    ),
  };
}

// ---------------------------------------------------------------- servir
function servir() {
  const dur = 3.4;
  const hip = P(140, HY);
  const tilt = (p) => (p < 0.66 ? 112 * seg(p, 0.06, 0.24) : 112 * (1 - seg(p, 0.6, 0.74)));
  const hand = (p) => P(lerp(214, 228, seg(p, 0.04, 0.2) * (1 - seg(p, 0.62, 0.76))), lerp(250, 228, seg(p, 0.04, 0.2) * (1 - seg(p, 0.62, 0.76))));
  // termo: la mano lo agarra por el medio; la boca queda 28 px arriba
  const spout = (p) => { const H = hand(p); const a = rad(tilt(p)); return P(H.x + 30 * Math.sin(a), H.y - 30 * Math.cos(a)); };
  const pour = (p) => seg(p, 0.22, 0.27) * (1 - seg(p, 0.56, 0.62));
  // el vaso lleno se va a la derecha y cae uno vacío en su lugar
  const cupT = (p) => (p < 0.86 ? [70 * seg(p, 0.78, 0.86), 0] : [0, -8 * (1 - seg(p, 0.88, 0.99))]);
  const cupO = (p) => (p < 0.86 ? 1 - seg(p, 0.8, 0.86) : seg(p, 0.88, 0.99));
  const fill = (p) => (p < 0.86 ? seg(p, 0.26, 0.5) : 0);
  const cup = (extra) => g(extra,
    path('k', 'M244 266 h26 l-3 30 h-20 Z'),
    path('r', 'M245.9 279 h22.2 l-0.5 6 h-21.2 Z'),
  );
  return {
    name: 'servir', title: 'Barista sirviendo café del termo', dur,
    body: g({},
      path('l', `M24 ${GROUND} H336`),
      ...standLegs(hip.x, hip.y),
      g({ rot: (p) => [3 + 4 * seg(p, 0.06, 0.24) * (1 - seg(p, 0.6, 0.74)), hip.x, hip.y] },
        el('circle', { class: 'k', cx: 140, cy: HY - 140, r: 8 }),
        // saco largo
        path('s', `M120 ${HY + 40} C118 ${HY - 20} 122 ${HY - 70} 132 ${HY - 94} C140 ${HY - 104} 162 ${HY - 104} 170 ${HY - 92} C178 ${HY - 66} 178 ${HY} 176 ${HY + 40} Z`),
        path('k', `M152 ${HY - 70} L174 ${HY - 72} C176 ${HY - 40} 176 ${HY} 174 ${HY + 36} L152 ${HY + 36} Z`),
        el('circle', { class: 'r', cx: 164, cy: HY - 58, r: 3.2 }),
        head(160, HY - 120, 15, [
          path('n', `M144 ${HY - 122} C140 ${HY - 144} 166 ${HY - 150} 174 ${HY - 132} C164 ${HY - 138} 152 ${HY - 134} 148 ${HY - 116} Z`),
        ]),
      ),
      counter(),
      // vaso que se va y vaso nuevo
      g({ tx: cupT, opacity: cupO },
        cup({}),
        el('ellipse', { class: 'c', cx: 257, cy: 268, rx: 11, ry: 2.6, opacity: fill }),
        path('t', (p) => `M252 ${r1(258 - 10 * ((p * 3) % 1))} c-4 -5 4 -8 0 -13`, { opacity: (p) => r1(seg(p, 0.5, 0.6) * (p < 0.86 ? 1 : 0) * Math.sin(((p * 3) % 1) * Math.PI)) }),
      ),
      // chorro
      path('c', (p) => { const s = spout(p); const k = pour(p); return `M${r1(s.x)} ${r1(s.y)} Q${r1(s.x + 6)} ${r1(s.y + 10)} ${r1(lerp(s.x + 4, 257, k))} ${r1(lerp(s.y + 4, 266, k))} L${r1(lerp(s.x + 1, 254, k))} ${r1(lerp(s.y + 4, 266, k))} Q${r1(s.x + 2)} ${r1(s.y + 8)} ${r1(s.x - 1)} ${r1(s.y + 2)} Z`; }, { opacity: (p) => r1(Math.min(1, pour(p) * 3)) }),
      // termo en la mano
      g({ tx: (p) => { const H = hand(p); return [H.x, H.y]; } }, g({ rot: (p) => [tilt(p), 0, 0] },
        el('rect', { class: 's', x: -9, y: -26, width: 18, height: 54, rx: 4 }),
        el('rect', { class: 'n', x: -6, y: -33, width: 12, height: 8, rx: 2 }),
        path('l', 'M-9 -14 h18 M-9 16 h18'),
      )),
      ...brazo(() => rotPt(P(154, HY - 90), hip, 3), (p) => hand(p), 46, 42),
    ),
  };
}

export const FIGURAS = { carrito, ruana, caminando, aeropress, molino, servir };

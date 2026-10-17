// Mapa ilustrativo de Bogotá dibujado en canvas, sin servicio de mapas: las
// calles crecen hacia el norte y las carreras hacia el occidente, así que una
// dirección (carrera, calle) cae directo en la cuadrícula. Cerros al oriente,
// vías principales y una capa de calor (azul → rojo) con la demanda de ejemplo.
//
// Coordenadas: c = carrera, k = calle. `view` fija qué punto queda dónde:
//   { style: 'plano' | 'oscuro', c, k, ax, ay, s, heat?, labels?, pins?, route? }
//   ax/ay = posición (0–1) del punto (c, k) en el lienzo; s = píxeles por cuadra.

// [carrera, calle, peso, radio en cuadras] — demanda de ejemplo hasta tener pedidos reales.
const HEAT = [
  [13, 83, 1, 5], [12, 93, 0.9, 4.5], [5, 69, 0.65, 4], [7, 42, 0.8, 6], [11, 58, 0.55, 6],
  [15, 100, 0.75, 6], [6, 119, 0.6, 5], [9, 73, 0.8, 4.5], [14, 88, 0.45, 4], [19, 76, 0.35, 7],
  [7, 63, 0.5, 4], [22, 45, 0.3, 8], [10, 106, 0.45, 5], [24, 96, 0.3, 7], [3, 52, 0.25, 4],
  [30, 70, 0.25, 8], [40, 85, 0.2, 9], [35, 52, 0.2, 8],
];

// Baristas de ejemplo: [carrera, calle, etiqueta, es la barra de Acero.press]
export const SAMPLE_PINS = [
  [13, 85, 'AP · 9 min', true],
  [9, 72, 'LM · 12 min', false],
  [12, 93, 'JC · 18 min', false],
];
export const SAMPLE_HOME = [11, 79];

const RAMP = [
  [0, [43, 43, 209]], [0.2, [0, 179, 230]], [0.42, [38, 208, 124]],
  [0.62, [245, 225, 0]], [0.8, [255, 140, 0]], [1, [255, 31, 31]],
];

function thermal(t) {
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, a] = RAMP[i - 1];
      const [t1, b] = RAMP[i];
      const f = (t - t0) / (t1 - t0);
      return a.map((v, j) => Math.round(v + (b[j] - v) * f));
    }
  }
  return RAMP[RAMP.length - 1][1];
}

// Carrera del borde de los cerros orientales según la calle.
const ridge = (k) => (k < 40 ? 2.5 : k < 70 ? 2.8 + (k - 40) * 0.01 : k < 100 ? 3.1 + (k - 70) * 0.03 : 4 + (k - 100) * 0.02);

const STYLES = {
  plano: {
    bg: '#EDE6D3', minor: 'rgba(42,53,80,.12)', major: 'rgba(42,53,80,.6)', hw: '#2A3550',
    hillBg: '#E6DEC8', hill: 'rgba(42,53,80,.2)', park: 'rgba(46,139,87,.2)', label: 'rgba(42,53,80,.8)',
    heatA: 0.5, blend: 'multiply', pin: '#2A3550', pinFg: '#EDE6D3', route: '#2A3550',
  },
  oscuro: {
    bg: '#141518', minor: 'rgba(255,255,255,.06)', major: 'rgba(255,255,255,.2)', hw: 'rgba(255,255,255,.32)',
    hillBg: '#121a16', hill: 'rgba(80,140,100,.16)', park: 'rgba(46,139,87,.22)', label: 'rgba(255,255,255,.5)',
    heatA: 0.62, blend: 'screen', pin: '#F7F3E8', pinFg: '#1E1E1E', route: '#ffffff',
  },
};

const MONO = '"JetBrains Mono", ui-monospace, monospace';

export function drawBogotaMap(canvas, view) {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (!W || !H) return;
  const P = STYLES[view.style] || STYLES.oscuro;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const s = view.s;
  const X = (c) => W * view.ax + (view.c - c) * s;
  const Y = (k) => H * view.ay + (view.k - k) * s;
  const cMin = view.c - (W * (1 - view.ax)) / s - 1;
  const cMax = view.c + (W * view.ax) / s + 1;
  const kMin = view.k - (H * (1 - view.ay)) / s - 1;
  const kMax = view.k + (H * view.ay) / s + 1;

  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  // Manzanas: cada calle y cada carrera
  ctx.strokeStyle = P.minor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = Math.max(1, Math.ceil(cMin)); c <= cMax; c++) {
    ctx.moveTo(X(c), Y(kMin));
    ctx.lineTo(X(c), Y(kMax));
  }
  for (let k = Math.ceil(kMin); k <= kMax; k++) {
    ctx.moveTo(X(Math.max(ridge(k), cMin)), Y(k));
    ctx.lineTo(X(cMax), Y(k));
  }
  ctx.stroke();

  // Cerros orientales (sombreado diagonal)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W + 2, Y(kMin));
  for (let k = kMin; k <= kMax; k += 2) ctx.lineTo(X(ridge(k)), Y(k));
  ctx.lineTo(W + 2, Y(kMax));
  ctx.closePath();
  ctx.fillStyle = P.hillBg;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = P.hill;
  ctx.lineWidth = 1.2;
  for (let x = -H; x < W + H; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + H, 0);
    ctx.stroke();
  }
  ctx.restore();

  // Parques: El Virrey, Parque de la 93, Parque Nacional
  ctx.fillStyle = P.park;
  ctx.fillRect(X(7), Y(88.6), X(15) - X(7), Y(87.4) - Y(88.6));
  ctx.fillRect(X(13), Y(93.8), X(11) - X(13), Y(92.6) - Y(93.8));
  ctx.fillRect(X(7), Y(39.5), X(5) - X(7), Y(36) - Y(39.5));

  // Vías principales
  const road = (pts, w, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([c, k], i) => (i ? ctx.lineTo(X(c), Y(k)) : ctx.moveTo(X(c), Y(k))));
    ctx.stroke();
  };
  road([[7, 0], [7, 72], [7.3, 100], [7, 160]], 1.6, P.major); // Carrera 7
  road([[11, 60], [11, 100]], 1.2, P.major);
  road([[15, 72], [15, 125]], 1.2, P.major);
  road([[14, 0], [14, 72], [15.5, 80], [19, 100], [22, 160]], 3, P.hw); // Caracas → Autopista Norte
  road([[30, 0], [30, 80]], 2.4, P.hw); // NQS
  road([[50, 0], [50, 160]], 2.4, P.hw);
  [26, 45, 53, 63, 72, 80, 85, 92, 100, 116, 127, 140].forEach((k) => {
    const big = k === 26 || k === 72 || k === 80 || k === 100;
    road([[ridge(k), k], [cMax, k]], big ? 2 : 1, big ? P.hw : P.major);
  });

  // Calor: se calcula en una rejilla de 5 px y se escala con suavizado
  const step = 5;
  const gw = Math.ceil(W / step);
  const gh = Math.ceil(H / step);
  const off = document.createElement('canvas');
  off.width = gw;
  off.height = gh;
  const octx = off.getContext('2d');
  const img = octx.createImageData(gw, gh);
  const heat = view.heat ?? 1;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const c = view.c - (gx * step - W * view.ax) / s;
      const k = view.k - (gy * step - H * view.ay) / s;
      let v = 0;
      for (const [hc, hk, w, r] of HEAT) v += w * Math.exp(-((c - hc) ** 2 + (k - hk) ** 2) / (2 * r * r));
      v = Math.min(1, v / 1.15) * heat;
      if (c < ridge(k)) v *= 0.15;
      const i = (gy * gw + gx) * 4;
      const [r, g, b] = thermal(v);
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.round(255 * Math.min(1, v * 1.7) * P.heatA);
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = P.blend;
  ctx.drawImage(off, 0, 0, W, H);
  ctx.restore();

  // Nombres de vías y barrios
  const z = view.labels || 1;
  ctx.fillStyle = P.label;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const label = (text, c, k, size, rot = 0, weight = 500) => {
    const x = X(c);
    const y = Y(k);
    if (x < 20 || x > W - 20 || y < 8 || y > H - 8) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = `${weight} ${size * z}px ${MONO}`;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  label('CERROS ORIENTALES', ridge(view.k) - 2.4, view.k - 4, 8, -Math.PI / 2, 700);
  label('AV. CARACAS', 14.9, 50, 8, -Math.PI / 2);
  label('AUTOPISTA NORTE', 19, 112, 8, -Math.PI / 2.2);
  label('NQS', 30.9, 50, 8, -Math.PI / 2);
  label('CRA 7', 6.1, 52, 8, -Math.PI / 2);
  label('CALLE 72', 26, 72.9, 8);
  label('CALLE 80', 28, 80.9, 8);
  label('CALLE 100', 30, 100.9, 8);
  label('CALLE 26', 24, 26.9, 8);
  label('CHAPINERO', 10, 60, 9.5, 0, 700);
  label('QUINTA CAMACHO', 10.5, 68, 8.5, 0, 700);
  label('ZONA T', 17, 84, 9, 0, 700);
  label('PARQUE 93', 12, 95.4, 8.5, 0, 700);
  label('USAQUÉN', 9, 121, 9.5, 0, 700);
  label('TEUSAQUILLO', 22, 38, 9.5, 0, 700);

  if (!view.pins) return;

  if (view.route) {
    ctx.strokeStyle = P.route;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(X(9), Y(72));
    ctx.lineTo(X(9), Y(76));
    ctx.lineTo(X(11), Y(76));
    ctx.lineTo(X(11), Y(79));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [c, k, text, home] of SAMPLE_PINS) {
    const x = X(c);
    const y = Y(k);
    ctx.font = `700 ${9 * z}px ${MONO}`;
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = home ? '#fa2525' : P.pin;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - 25, w, 17, view.style === 'plano' ? 0 : 9);
    else ctx.rect(x - w / 2, y - 25, w, 17);
    ctx.fill();
    ctx.fillRect(x - 1, y - 8, 2, 8);
    ctx.fillStyle = home ? '#fff' : P.pinFg;
    ctx.fillText(text, x, y - 16);
  }
  ctx.fillStyle = '#2f7cf6';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(X(SAMPLE_HOME[0]), Y(SAMPLE_HOME[1]), 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

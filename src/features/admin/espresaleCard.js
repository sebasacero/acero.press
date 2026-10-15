// Tarjeta de Espresale dibujada en canvas con el lenguaje de los banners:
// hoja de plano técnico (papel cuadriculado, marco con zonas, cotas en
// JetBrains Mono), un dibujo acotado de la AeroPress con la receta y el
// panel oscuro del odómetro, igual al de los banners de video.

const C = {
  paper: '#EDE6D3',
  ink: '#2A3550',
  inkSoft: '#6B7290',
  red: '#fa2525',
  cream: '#F7F3E8',
  panel: '#15171C',
};
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const GROTESK = '"Space Grotesk", Archivo, sans-serif';
const MARKER = '"Permanent Marker", cursive';

export const FORMATS = {
  square: { w: 1080, h: 1080, label: 'Post 1:1' },
  story: { w: 1080, h: 1920, label: 'Historia 9:16' },
};

/** Saca dosis, agua, temperatura y tiempo del texto libre de la receta. */
export function parseRecipe(text = '') {
  const num = (re) => {
    const m = text.match(re);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  };
  const dose = num(/(\d+(?:[.,]\d+)?)\s*g(?:r|ramos)?\b/i);
  const water = num(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  const temp = num(/(\d+(?:[.,]\d+)?)\s*°/);
  const time = (text.match(/\b(\d{1,2}:\d{2})\b/) || [])[1] || null;
  const ratio = dose && water ? water / dose : null;
  return { dose, water, temp, time, ratio };
}

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

let fontsReady = null;
function ensureFonts() {
  if (!fontsReady) {
    fontsReady = document.fonts
      ? Promise.all([
          document.fonts.load(`700 80px ${GROTESK}`),
          document.fonts.load(`500 20px ${MONO}`),
          document.fonts.load(`700 20px ${MONO}`),
          document.fonts.load(`40px ${MARKER}`),
        ]).catch(() => {})
      : Promise.resolve();
  }
  return fontsReady;
}

const imageCache = new Map();
export function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      })
    );
  }
  return imageCache.get(src);
}

function wrapLines(ctx, text, maxWidth, maxLines = Infinity) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

function drawCover(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function grid(ctx, w, h, step, minor, major) {
  ctx.lineWidth = 1;
  for (let i = 0, x = 0; x <= w; i++, x += step) {
    ctx.strokeStyle = i % 5 === 0 ? major : minor;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let i = 0, y = 0; y <= h; i++, y += step) {
    ctx.strokeStyle = i % 5 === 0 ? major : minor;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
}

function arrowHead(ctx, x, y, angle, size = 12) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - 0.35), y - size * Math.sin(angle - 0.35));
  ctx.lineTo(x - size * Math.cos(angle + 0.35), y - size * Math.sin(angle + 0.35));
  ctx.closePath();
  ctx.fill();
}

/** Cota con flechas en los dos extremos y el texto en el centro. */
function dimension(ctx, x1, y1, x2, y2, label, color, bg) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  arrowHead(ctx, x2, y2, angle);
  arrowHead(ctx, x1, y1, angle + Math.PI);

  ctx.save();
  ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
  let rot = angle;
  if (rot > Math.PI / 2 || rot < -Math.PI / 2) rot += Math.PI;
  ctx.rotate(rot);
  ctx.font = `700 22px ${MONO}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = bg;
  ctx.fillRect(-tw / 2 - 8, -15, tw + 16, 30);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

/** Línea de referencia (leader) con punto en el objeto y etiqueta al final. */
function leader(ctx, fromX, fromY, toX, toY, label, sub, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(fromX, fromY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.lineTo(toX + 26, toY);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 26px ${MONO}`;
  ctx.fillText(label, toX + 34, toY + 8);
  if (sub) {
    ctx.font = `500 15px ${MONO}`;
    ctx.globalAlpha = 0.7;
    ctx.fillText(sub, toX + 34, toY + 30);
    ctx.globalAlpha = 1;
  }
}

/**
 * AeroPress en corte, dibujada como un plano (unidades locales: 300×560,
 * el centro horizontal en x=150).
 */
function drawAeropress(ctx, r, ink, bg) {
  const cx = 150;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = ink;

  // Émbolo
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 78, 0, 156, 18);
  ctx.strokeRect(cx - 60, 18, 120, 118);
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  for (let y = 34; y < 130; y += 16) {
    ctx.beginPath();
    ctx.moveTo(cx - 48, y);
    ctx.lineTo(cx + 48, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  ctx.fillRect(cx - 62, 126, 124, 12); // sello de goma

  // Cámara
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 92, 104, 184, 12); // pestaña superior
  ctx.strokeRect(cx - 70, 116, 140, 262);

  // Graduación ①–④
  ctx.lineWidth = 2;
  ctx.font = `700 15px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;
  [4, 3, 2, 1].forEach((n, i) => {
    const y = 176 + i * 46;
    ctx.beginPath();
    ctx.moveTo(cx + 70, y);
    ctx.lineTo(cx + 52, y);
    ctx.stroke();
    ctx.fillText(String(n), cx + 46, y);
  });

  // Nivel de agua
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 64, 168);
  ctx.lineTo(cx + 64, 168);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  for (let x = cx - 56; x < cx + 50; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 180);
    ctx.quadraticCurveTo(x + 5, 175, x + 10, 180);
    ctx.quadraticCurveTo(x + 15, 185, x + 20, 180);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Cama de café (sombreado diagonal)
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 68, 330, 136, 46);
  ctx.clip();
  ctx.lineWidth = 2;
  for (let x = cx - 120; x < cx + 120; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, 376);
    ctx.lineTo(x + 46, 330);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 70, 330);
  ctx.lineTo(cx + 70, 330);
  ctx.stroke();

  // Tapa + filtro
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 84, 378);
  ctx.lineTo(cx + 84, 378);
  ctx.lineTo(cx + 72, 400);
  ctx.lineTo(cx - 72, 400);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([3, 5]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 62, 389);
  ctx.lineTo(cx + 62, 389);
  ctx.stroke();
  ctx.setLineDash([]);

  // Chorro
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, 404);
  ctx.lineTo(cx, 446);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Taza
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 96, 450);
  ctx.lineTo(cx - 84, 556);
  ctx.lineTo(cx + 84, 556);
  ctx.lineTo(cx + 96, 450);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 104, 494, 26, -Math.PI / 2.4, Math.PI / 2.4);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 90, 476);
  ctx.lineTo(cx + 90, 476);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Cotas y referencias con la receta
  if (r.water) dimension(ctx, cx - 128, 168, cx - 128, 376, `${fmt(r.water)} ml`, ink, bg);
  if (r.dose) leader(ctx, cx + 30, 352, cx + 132, 330, `${fmt(r.dose)} g`, 'CAFÉ MOLIDO', ink);
  if (r.temp) leader(ctx, cx + 8, 168, cx + 132, 210, `${fmt(r.temp)} °C`, 'AGUA', ink);
  if (r.time) leader(ctx, cx + 60, 60, cx + 132, 88, r.time, 'TIEMPO', ink);
}

function sheetFrame(ctx, w, h, color, soft) {
  const M = 40;
  const inner = M + 16;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(M, M, w - M * 2, h - M * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(inner, inner, w - inner * 2, h - inner * 2);

  // Zonas del plano (1-6 / A-D) en la franja del marco
  ctx.fillStyle = soft;
  ctx.font = `500 11px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cols = 6;
  const rows = Math.round(4 * (h / w));
  for (let i = 0; i < cols; i++) {
    const x = M + ((w - M * 2) / cols) * (i + 0.5);
    ctx.fillText(String(i + 1), x, M + 8);
    ctx.fillText(String(i + 1), x, h - M - 8);
    if (i) {
      const tx = M + ((w - M * 2) / cols) * i;
      ctx.fillRect(tx, M, 1, 16);
      ctx.fillRect(tx, h - M - 16, 1, 16);
    }
  }
  for (let j = 0; j < rows; j++) {
    const y = M + ((h - M * 2) / rows) * (j + 0.5);
    const letter = String.fromCharCode(65 + j);
    ctx.fillText(letter, M + 8, y);
    ctx.fillText(letter, w - M - 8, y);
    if (j) {
      const ty = M + ((h - M * 2) / rows) * j;
      ctx.fillRect(M, ty, 16, 1);
      ctx.fillRect(w - M - 16, ty, 16, 1);
    }
  }
}

/** Panel oscuro idéntico al odómetro de los banners de video. */
const PANEL_BASE = 384;
const PANEL_LINE = 26;

function panelLines(ctx, text, w, maxLines) {
  if (maxLines <= 0) return [];
  ctx.font = `500 17px ${MONO}`;
  return wrapLines(ctx, text, w - 60, maxLines);
}

function drawPanel(ctx, x, y, w, r, textLines) {
  const pad = 30;
  const inner = w - pad * 2;
  const h = PANEL_BASE + textLines.length * PANEL_LINE;

  ctx.fillStyle = 'rgba(14,15,19,0.9)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  let cy = y + pad + 10;
  // Cota superior: FIG. + insignia roja
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `500 16px ${MONO}`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('FIG. 01 — RECETA AEROPRESS', x + pad, cy);
  const badge = r.ratio ? `RATIO 1:${fmt(Math.round(r.ratio * 10) / 10)}` : 'ESPRESALE';
  ctx.font = `700 16px ${MONO}`;
  const bw = ctx.measureText(badge).width + 18;
  ctx.fillStyle = C.red;
  ctx.fillRect(x + w - pad - bw, cy - 14, bw, 28);
  ctx.fillStyle = '#fff';
  ctx.fillText(badge, x + w - pad - bw + 9, cy + 1);
  cy += 26;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x + pad, cy);
  ctx.lineTo(x + w - pad, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Etiqueta de dosis
  cy += 34;
  ctx.font = `500 14px ${MONO}`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('DOSIS CAFÉ MOLIDO / AGUA', x + pad, cy);

  // Odómetro
  cy += 24;
  const doseStr = r.dose ? String(Math.round(r.dose)).padStart(3, '0').slice(-3) : '---';
  const digits = [...doseStr, 'g'];
  const dw = 46;
  const dh = 66;
  ctx.font = `600 38px ${MONO}`;
  ctx.textAlign = 'center';
  digits.forEach((d, i) => {
    const dx = x + pad + i * (dw + 6);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(dx, cy, dw, dh);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(dx + 0.5, cy + 0.5, dw - 1, dh - 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(d, dx + dw / 2, cy + dh / 2 + 2);
  });
  const afterDigits = x + pad + digits.length * (dw + 6) + 8;
  ctx.textAlign = 'left';
  ctx.font = `400 34px ${MONO}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('/', afterDigits, cy + dh / 2);
  ctx.font = `700 26px ${MONO}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(r.water ? `${fmt(r.water)}ml H₂O` : 'AeroPress', afterDigits + 34, cy + dh / 2 + 1);

  // Barra segmentada (concentración relativa: 1:10 lleno, 1:20 vacío)
  cy += dh + 26;
  const segs = 20;
  const gap = 5;
  const segW = (inner - gap * (segs - 1)) / segs;
  const filled = r.ratio ? Math.max(2, Math.min(segs, Math.round(((20 - r.ratio) / 10) * segs))) : 10;
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i < filled ? '#f91f1f' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + pad + i * (segW + gap), cy, segW, 12);
  }

  // Especificaciones (como las tarjetas de recetas del campeonato)
  cy += 34;
  const specs = [
    ['TEMP', r.temp ? `${fmt(r.temp)}°C` : '—'],
    ['TIEMPO', r.time || '—'],
    ['AGUA', r.water ? `${fmt(r.water)}ml` : '—'],
  ];
  const cellW = inner / specs.length;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x + pad, cy);
  ctx.lineTo(x + w - pad, cy);
  ctx.moveTo(x + pad, cy + 92);
  ctx.lineTo(x + w - pad, cy + 92);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  specs.forEach(([label, value], i) => {
    const sx = x + pad + cellW * (i + 0.5);
    ctx.font = `700 32px ${MONO}`;
    ctx.fillStyle = C.red;
    ctx.fillText(value, sx, cy + 40);
    ctx.font = `500 13px ${MONO}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(label, sx, cy + 72);
  });

  // Receta completa
  cy += 122;
  ctx.textAlign = 'left';
  ctx.font = `500 17px ${MONO}`;
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  textLines.forEach((line, i) => ctx.fillText(line, x + pad, cy + i * 26));
  return h;
}

/** Cajetín (title block) del plano: clima, hora, fecha, lugar. */
function drawTitleBlock(ctx, x, y, w, h, cells, theme) {
  ctx.fillStyle = theme.blockBg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);
  const total = cells.reduce((s, c) => s + c.span, 0);
  let cx = x;
  cells.forEach((cell, i) => {
    const cw = (w * cell.span) / total;
    if (i) {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + h);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `500 13px ${MONO}`;
    ctx.fillStyle = theme.soft;
    ctx.fillText(cell.label, cx + 16, y + 26);
    ctx.font = `700 ${cell.size || 30}px ${GROTESK}`;
    ctx.fillStyle = cell.accent ? C.red : theme.ink;
    let value = cell.value;
    while (ctx.measureText(value).width > cw - 30 && value.length > 3) value = value.slice(0, -1);
    ctx.fillText(value, cx + 16, y + h - 22);
    cx += cw;
  });
}

function fitTitle(ctx, text, maxWidth, maxLines, start, min) {
  for (let size = start; size >= min; size -= 4) {
    ctx.font = `700 ${size}px ${GROTESK}`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
  }
  ctx.font = `700 ${min}px ${GROTESK}`;
  return { size: min, lines: wrapLines(ctx, text, maxWidth, maxLines) };
}

/**
 * Dibuja la tarjeta. `photo` (Image) es opcional: si existe, la hoja se
 * monta sobre la foto (como el video de fondo de los banners).
 */
export async function drawEspresaleCard(canvas, { variety, weather, date = new Date(), format = 'square', photo = null }) {
  await ensureFonts();
  const logo = await loadImage('/image/logo.png');
  const { w, h } = FORMATS[format] || FORMATS.square;
  const story = format === 'story';
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const r = parseRecipe(variety.recipe_text || '');

  const theme = photo
    ? { ink: C.cream, soft: 'rgba(247,243,232,0.7)', line: 'rgba(247,243,232,0.75)', bg: 'rgba(14,15,19,0.85)', blockBg: 'rgba(14,15,19,0.72)' }
    : { ink: C.ink, soft: C.inkSoft, line: C.ink, bg: C.paper, blockBg: 'rgba(237,230,211,0.92)' };

  // Fondo: papel cuadriculado o foto con el mismo degradado del banner
  if (photo) {
    drawCover(ctx, photo, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(10,10,12,0.72)');
    g.addColorStop(0.45, 'rgba(10,10,12,0.25)');
    g.addColorStop(1, 'rgba(10,10,12,0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, 27, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)');
  } else {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, 27, 'rgba(42,53,80,0.08)', 'rgba(42,53,80,0.17)');
    // Viñeta suave de papel envejecido
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(120,90,40,0)');
    v.addColorStop(1, 'rgba(120,90,40,0.16)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  sheetFrame(ctx, w, h, theme.line, theme.soft);

  const X0 = 92;
  const X1 = w - 92;
  let y = 92;

  // Encabezado: logo ACERO + .press y referencia de la hoja
  if (logo) {
    const lh = 54;
    const lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, X0, y, lw, lh);
    ctx.save();
    ctx.translate(X0 + lw + 8, y + lh - 6);
    ctx.rotate(-0.1);
    ctx.font = `30px ${MARKER}`;
    ctx.fillStyle = C.red;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('.press', 0, 0);
    ctx.restore();
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 17px ${MONO}`;
  ctx.fillStyle = theme.ink;
  ctx.fillText('FIG. 01 — ESPRESALE', X1, y + 22);
  ctx.font = `500 14px ${MONO}`;
  ctx.fillStyle = theme.soft;
  ctx.fillText(`HOJA 01/01 · ESC 1:1 · ${w}×${h}`, X1, y + 46);

  y += 80;
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(X0, y);
  ctx.lineTo(X1, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Título: la variedad, como el "COLD BREW." del banner
  const name = `${String(variety.name || '').toUpperCase()}.`;
  const t = fitTitle(ctx, name, X1 - X0, 2, story ? 132 : 100, 56);
  ctx.fillStyle = theme.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  y += t.size * 0.95 + 18;
  t.lines.forEach((line, i) => ctx.fillText(line, X0, y + i * t.size * 0.98));
  y += (t.lines.length - 1) * t.size * 0.98 + 40;

  // Etiqueta esquemática con punto rojo
  ctx.fillStyle = C.red;
  ctx.beginPath();
  ctx.arc(X0 + 6, y - 7, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `500 18px ${MONO}`;
  ctx.fillStyle = theme.soft;
  ctx.fillText('BOGOTÁ, 2.600 MSNM · RECETA AEROPRESS', X0 + 22, y);
  y += 34;

  // Cajetín abajo
  const blockH = 96;
  const blockY = h - 92 - blockH;
  const time = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const day = date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
  const temp = weather?.tempC !== null && weather?.tempC !== undefined ? `${weather.tempC}°C` : '—';
  drawTitleBlock(
    ctx,
    X0,
    blockY,
    X1 - X0,
    blockH,
    [
      { label: 'CLIMA BOGOTÁ', value: `${weather?.icon || ''} ${temp}`.trim(), span: 1.1 },
      { label: 'HORA', value: time, span: 1 },
      { label: 'FECHA', value: day, span: 1.25, size: 26 },
      { label: 'PREPARÓ', value: 'ACERO.press', span: 1.35, accent: true },
    ],
    theme
  );

  // Zona central: dibujo + panel
  const recipeText = variety.recipe_text || 'Pregúntale a tu barista por la receta de hoy.';
  if (story) {
    const avail = blockY - 40 - y;
    const panelW = X1 - X0;
    const lines = panelLines(ctx, recipeText, panelW, 5);
    const panelH = PANEL_BASE + lines.length * PANEL_LINE;
    if (!photo) {
      const drawH = Math.max(320, avail - panelH - 50);
      const scale = Math.min(1.5, drawH / 560);
      ctx.save();
      ctx.translate(w / 2 - 150 * scale - 40, y + 10);
      ctx.scale(scale, scale);
      drawAeropress(ctx, r, theme.ink, theme.bg);
      ctx.restore();
    }
    drawPanel(ctx, X0, blockY - 40 - panelH, panelW, r, lines);
  } else {
    const panelW = 470;
    const panelX = X1 - panelW;
    const zoneTop = y;
    const zoneBottom = blockY - 28;
    const fit = Math.floor((zoneBottom - zoneTop - PANEL_BASE) / PANEL_LINE);
    const lines = panelLines(ctx, recipeText, panelW, Math.min(4, fit));
    const panelH = PANEL_BASE + lines.length * PANEL_LINE;
    if (!photo) {
      const scale = Math.min(0.92, (zoneBottom - zoneTop) / 560);
      ctx.save();
      ctx.translate(X0 + 18, zoneTop + 6);
      ctx.scale(scale, scale);
      drawAeropress(ctx, r, theme.ink, theme.bg);
      ctx.restore();
    }
    drawPanel(ctx, panelX, Math.max(zoneTop, zoneBottom - panelH), panelW, r, lines);
  }

  return r;
}

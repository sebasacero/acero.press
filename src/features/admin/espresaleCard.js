// Tarjeta de Micra dibujada en canvas con el lenguaje de los banners:
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

// Formatos del sistema de publicaciones (lienzo "Formato de redes"):
// `safe` es la zona que ninguna app tapa; logo, título, panel y cajetín
// viven dentro de ella. El fondo (papel, cuadrícula, marco) sí llega al borde.
//  - feed: Instagram 4:5, margen 96 (cabe en el recorte 3:4 del perfil).
//  - reel: 9:16 de Reels y TikTok: libre 270 arriba, 440 abajo (texto y
//    audio) y 180 a la derecha (botones de me gusta, comentar, compartir).
//  - story: 9:16 de Historias: solo tapan la barra del perfil arriba (250) y
//    la de responder abajo (250), así que el ancho es casi completo y el
//    panel de la receta baja y se corre a la derecha.
export const FORMATS = {
  feed: { w: 1080, h: 1350, label: 'Feed 4:5', apps: 'Instagram feed', safe: { x0: 96, y0: 96, x1: 984, y1: 1254 }, logoH: 72 },
  reel: { w: 1080, h: 1920, label: 'Reel 9:16', apps: 'Reels · TikTok', safe: { x0: 64, y0: 270, x1: 900, y1: 1480 }, logoH: 80 },
  story: { w: 1080, h: 1920, label: 'Historia 9:16', apps: 'Instagram stories', safe: { x0: 64, y0: 250, x1: 1016, y1: 1670 }, logoH: 80, lowPanel: true },
};

/** Tipo de publicación en Instagram según el formato y si es video. */
export const igKind = (format, isVideo) =>
  format === 'story' ? (isVideo ? 'story_video' : 'story') : isVideo ? 'reel' : format === 'reel' ? 'story' : 'image';

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
  // Sirve para fotos (Image) y para cuadros de video (HTMLVideoElement).
  const iw = img.videoWidth || img.naturalWidth || img.width;
  const ih = img.videoHeight || img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Rectángulo redondeado (con respaldo para navegadores sin ctx.roundRect). */
function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Vidrio esmerilado barato: la zona de atrás se reduce a 1/10 y se vuelve a
// estirar con suavizado. Sin ctx.filter (caro en cada cuadro de video y sin
// soporte en todos los navegadores) y con un solo lienzo pequeño reutilizado.
const FROST_SCALE = 10;
let frostCanvas = null;
function frost(ctx, x, y, w, h, r) {
  const fw = Math.max(1, Math.round(w / FROST_SCALE));
  const fh = Math.max(1, Math.round(h / FROST_SCALE));
  frostCanvas ||= document.createElement('canvas');
  if (frostCanvas.width !== fw || frostCanvas.height !== fh) {
    frostCanvas.width = fw;
    frostCanvas.height = fh;
  }
  const f = frostCanvas.getContext('2d');
  f.imageSmoothingEnabled = true;
  f.imageSmoothingQuality = 'high';
  f.drawImage(ctx.canvas, x, y, w, h, 0, 0, fw, fh);
  ctx.save();
  roundPath(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(frostCanvas, 0, 0, fw, fh, x, y, w, h);
  ctx.restore();
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

/** Panel de la receta en vidrio esmerilado (glassmorphism): desenfoca lo que
 *  hay detrás, tinte oscuro para que se lea, brillo arriba y bordes claros.
 *  tone: 'paper' (sobre el plano), 'photo' (sobre la foto) u 'overlay'
 *  (capa sobre video: el desenfoque lo pone composeVideoFrame). */
const PANEL_BASE = 384;
const PANEL_LINE = 26;

function panelLines(ctx, text, w, maxLines) {
  if (maxLines <= 0) return [];
  ctx.font = `500 17px ${MONO}`;
  return wrapLines(ctx, text, w - 60, maxLines);
}

function drawPanel(ctx, x, y, w, r, textLines, tone = 'paper') {
  const pad = 30;
  const inner = w - pad * 2;
  const h = PANEL_BASE + textLines.length * PANEL_LINE;
  const R = 28;

  // Vidrio: lo que ya está pintado detrás (papel o foto) se desenfoca
  if (tone !== 'overlay') frost(ctx, x, y, w, h, R);
  ctx.save();
  roundPath(ctx, x, y, w, h, R);
  ctx.fillStyle = tone === 'paper' ? 'rgba(22,28,48,0.9)' : tone === 'photo' ? 'rgba(14,15,19,0.4)' : 'rgba(14,15,19,0.46)';
  ctx.fill();
  const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
  sheen.addColorStop(0, `rgba(255,255,255,${tone === 'paper' ? 0.14 : 0.22})`);
  sheen.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.03)');
  ctx.fillStyle = sheen;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + R, y + 1.5);
  ctx.lineTo(x + w - R, y + 1.5);
  ctx.stroke();
  ctx.restore();
  // Zona de vidrio, para que el video y la cámara la desenfoquen debajo
  (ctx.canvas.__glass ||= []).push({ x, y, w, h, r: R });

  let cy = y + pad + 10;
  // Cota superior: FIG. + insignia roja
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `500 16px ${MONO}`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('FIG. 01 — RECETA AEROPRESS', x + pad, cy);
  const badge = r.ratio ? `RATIO 1:${fmt(Math.round(r.ratio * 10) / 10)}` : 'MICRA';
  ctx.font = `700 16px ${MONO}`;
  const bw = ctx.measureText(badge).width + 18;
  ctx.fillStyle = C.red;
  roundPath(ctx, x + w - pad - bw, cy - 14, bw, 28, 14);
  ctx.fill();
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
    roundPath(ctx, dx + 0.5, cy + 0.5, dw - 1, dh - 1, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
    ctx.fillStyle = i < filled ? '#f91f1f' : 'rgba(255,255,255,0.2)';
    roundPath(ctx, x + pad + i * (segW + gap), cy, segW, 12, 6);
    ctx.fill();
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
    ctx.fillStyle = cell.accent ? C.red : theme.ink;
    let size = cell.size || 30;
    ctx.font = `700 ${size}px ${GROTESK}`;
    while (ctx.measureText(cell.value).width > cw - 30 && size > 16) {
      size -= 1;
      ctx.font = `700 ${size}px ${GROTESK}`;
    }
    ctx.fillText(cell.value, cx + 16, y + h - 22);
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
 * Con `videoOverlay: true` dibuja solo la capa de encima (degradado,
 * cuadrícula, marco y contenido) sobre fondo transparente, para
 * componerla cuadro a cuadro encima de un video (ver recordCardVideo).
 */
export async function drawEspresaleCard(canvas, { variety, weather, date = new Date(), format = 'feed', photo = null, videoOverlay = false }) {
  await ensureFonts();
  const logo = await loadImage('/image/logo.png');
  const F = FORMATS[format] || FORMATS.feed;
  const { w, h, safe, logoH } = F;
  canvas.width = w;
  canvas.height = h;
  canvas.__glass = [];
  const ctx = canvas.getContext('2d');
  const r = parseRecipe(variety.recipe_text || '');

  const theme = photo || videoOverlay
    ? { ink: C.cream, soft: 'rgba(247,243,232,0.75)', line: 'rgba(247,243,232,0.75)', bg: 'rgba(14,15,19,0.85)', blockBg: 'rgba(14,15,19,0.72)' }
    : { ink: C.ink, soft: C.inkSoft, line: C.ink, bg: C.paper, blockBg: 'rgba(237,230,211,0.94)' };

  // Fondo a sangre: papel cuadriculado o foto/video con el degradado del banner
  if (photo || videoOverlay) {
    ctx.clearRect(0, 0, w, h);
    if (photo) drawCover(ctx, photo, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(10,10,12,0.72)');
    g.addColorStop(0.45, 'rgba(10,10,12,0.28)');
    g.addColorStop(1, 'rgba(10,10,12,0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, 27, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)');
  } else {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, 27, 'rgba(42,53,80,0.08)', 'rgba(42,53,80,0.17)');
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(120,90,40,0)');
    v.addColorStop(1, 'rgba(120,90,40,0.16)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  sheetFrame(ctx, w, h, theme.line, theme.soft);

  const X0 = safe.x0;
  const X1 = safe.x1;
  let y = safe.y0;

  // A · Logo arriba a la izquierda, en el ancla de la zona segura
  if (logo) {
    const lw = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, X0, y, lw, logoH);
    ctx.save();
    ctx.translate(X0 + lw + 8, y + logoH - 6);
    ctx.rotate(-0.1);
    ctx.font = `${Math.round(logoH * 0.55)}px ${MARKER}`;
    ctx.fillStyle = C.red;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('.press', 0, 0);
    ctx.restore();
  }
  // B · Cota FIG. arriba a la derecha, a la altura del logo
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 19px ${MONO}`;
  ctx.fillStyle = theme.ink;
  ctx.fillText('FIG. 03 — MICRA', X1, y + 26);
  ctx.font = `500 15px ${MONO}`;
  ctx.fillStyle = theme.soft;
  ctx.fillText(`${F.label.toUpperCase()} · ${w}×${h}`, X1, y + 52);

  y += logoH + 24;
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(X0, y);
  ctx.lineTo(X1, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // C · Título: la variedad, como el "COLD BREW." del banner
  const name = `${String(variety.name || '').toUpperCase()}.`;
  const t = fitTitle(ctx, name, X1 - X0, 2, 108, 56);
  ctx.fillStyle = theme.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  y += t.size * 0.95 + 18;
  t.lines.forEach((line, i) => ctx.fillText(line, X0, y + i * t.size * 0.98));
  y += (t.lines.length - 1) * t.size * 0.98 + 40;

  ctx.fillStyle = C.red;
  ctx.beginPath();
  ctx.arc(X0 + 6, y - 7, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `500 18px ${MONO}`;
  ctx.fillStyle = theme.soft;
  ctx.fillText('BOGOTÁ, 2.600 MSNM · RECETA AEROPRESS', X0 + 22, y);
  y += 34;

  // E · Cajetín al final de la zona segura
  const blockH = 96;
  const blockY = safe.y1 - blockH;
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

  // D · Dibujo acotado (izquierda) + panel del odómetro (derecha)
  const recipeText = variety.recipe_text || 'Pregúntale a tu barista por la receta de hoy.';
  const panelW = Math.min(490, X1 - X0);
  const panelX = X1 - panelW;
  const zoneTop = y;
  const zoneBottom = blockY - 28;
  const fit = Math.floor((zoneBottom - zoneTop - PANEL_BASE) / PANEL_LINE);
  const lines = panelLines(ctx, recipeText, panelW, Math.max(0, Math.min(4, fit)));
  const panelH = PANEL_BASE + lines.length * PANEL_LINE;
  if (photo || videoOverlay) {
    // Con foto o video: el panel abajo, para que la foto respire arriba
    drawPanel(ctx, panelX, Math.max(zoneTop, zoneBottom - panelH), panelW, r, lines, photo ? 'photo' : 'overlay');
  } else {
    const drawW = panelX - X0 - 20;
    // 430 = ancho del dibujo con sus etiquetas de cota (unidades locales)
    const scale = Math.min(0.92, (zoneBottom - zoneTop) / 560, drawW / 430);
    const drawH = 560 * scale;
    // Dibujo y panel centrados juntos en el espacio libre (en el vertical sobra alto)
    const groupH = Math.max(drawH, panelH);
    // En Historias el grupo baja hacia el cajetín; en los demás va centrado.
    const groupTop = zoneTop + Math.max(0, (zoneBottom - zoneTop - groupH) * (F.lowPanel ? 0.85 : 0.5));
    ctx.save();
    ctx.translate(X0 + 10, groupTop + (groupH - drawH) / 2);
    ctx.scale(scale, scale);
    drawAeropress(ctx, r, theme.ink, theme.bg);
    ctx.restore();
    drawPanel(ctx, panelX, groupTop + (groupH - panelH) / 2, panelW, r, lines, 'paper');
  }

  return r;
}

/** Un cuadro del video de la tarjeta: el video de fondo y la capa encima. */
export function composeVideoFrame(ctx, video, overlay) {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = '#0b0c0f';
  ctx.fillRect(0, 0, w, h);
  drawCover(ctx, video, w, h);
  // Vidrio esmerilado: el video se desenfoca detrás del panel de la receta
  const glass = overlay.__glass;
  if (glass?.length) {
    const sx = w / overlay.width;
    const sy = h / overlay.height;
    glass.forEach((g) => frost(ctx, g.x * sx, g.y * sy, g.w * sx, g.h * sy, g.r * sx));
  }
  ctx.drawImage(overlay, 0, 0, w, h);
}

// Instagram solo acepta MP4 (H.264). Safari y Chrome recientes graban MP4;
// si el navegador solo sabe WebM, el video sirve para descargar/WhatsApp.
const VIDEO_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickVideoType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

/**
 * Graba el video con la tarjeta encima, en tiempo real (dura lo mismo que el
 * clip, máximo `maxSeconds`). Incluye el audio original si el navegador lo
 * permite. Devuelve { blob, type, ext }.
 */
export async function recordCardVideo({ video, overlay, width, height, maxSeconds = 60, onProgress }) {
  const type = pickVideoType();
  if (!type || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Este navegador no puede grabar video. Prueba en Chrome o Safari actualizados.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(30);

  // Audio del clip original (si se puede); si no, el video sale sin sonido.
  // Cada grabación usa su propio <video>, así que la fuente de audio es nueva.
  let hasAudio = false;
  let audioCtx = null;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    src.connect(dest);
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    hasAudio = true;
  } catch {
    hasAudio = false;
  }

  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

  const duration = Math.min(Number.isFinite(video.duration) ? video.duration : maxSeconds, maxSeconds);
  video.pause();
  video.loop = false;
  video.muted = !hasAudio; // con WebAudio el sonido va a la grabación, no al parlante
  video.currentTime = 0;
  await new Promise((r) => { video.onseeked = r; setTimeout(r, 500); });

  // Un dibujo por cuadro nuevo del clip (requestVideoFrameCallback) en vez de
  // 60 por segundo, y el progreso se avisa solo cuando sube un 1 %.
  const perFrame = typeof video.requestVideoFrameCallback === 'function';
  let raf = 0;
  let lastPct = -1;
  const stop = () => { if (recorder.state === 'recording') recorder.stop(); };
  video.addEventListener('ended', stop, { once: true });
  const draw = () => {
    composeVideoFrame(ctx, video, overlay);
    const pct = Math.min(1, video.currentTime / duration);
    if (Math.round(pct * 100) !== lastPct) {
      lastPct = Math.round(pct * 100);
      onProgress?.(pct);
    }
    if (video.currentTime >= duration || video.ended) { stop(); return; }
    raf = perFrame ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
  };

  composeVideoFrame(ctx, video, overlay);
  recorder.start(250);
  try {
    await video.play();
  } catch {
    // iOS puede bloquear la reproducción con sonido: se graba sin audio.
    video.muted = true;
    await video.play();
  }
  draw();
  await stopped;
  if (perFrame) video.cancelVideoFrameCallback(raf);
  else cancelAnimationFrame(raf);
  video.pause();
  stream.getTracks().forEach((t) => t.stop());
  if (audioCtx) audioCtx.close().catch(() => {});

  const blob = new Blob(chunks, { type: type.split(';')[0] });
  return {
    blob,
    type: type.split(';')[0],
    ext: type.startsWith('video/mp4') ? 'mp4' : 'webm',
    // Instagram exige H.264: solo es seguro publicar si se grabó con avc1.
    igReady: type.includes('avc1'),
  };
}

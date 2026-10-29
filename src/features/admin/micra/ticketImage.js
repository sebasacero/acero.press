// Dibuja el ticket (ticket.js) en un canvas en blanco y negro, del ancho exacto
// de la impresora (384 o 576 puntos): lo mismo se imprime en la Phomemo, se
// comparte como imagen o se ve en la hoja de Ticket. Necesita DOM (canvas).

import { ticketLines } from './ticket.js';

const FONT = '"JetBrains Mono", "SF Mono", Menlo, monospace';

/**
 * El ticket como canvas de `dots` px de ancho. El alto sale del contenido.
 * `scale` solo agranda la vista previa (la impresora recibe scale = 1).
 */
export function drawTicket(canvas, { rec, tintero, now }, { dots = 384, scale = 1 } = {}) {
  const pad = Math.round(dots * 0.04);
  const base = Math.round(dots / 24); // 16 px a 384 puntos
  const sizes = { normal: base, big: Math.round(base * 1.5) };
  const lineH = (s) => Math.round(s * 1.4);
  const lines = ticketLines({ rec, tintero, now });

  // Primero se mide: cada línea sabe su alto y el texto largo se parte en palabras
  const ctx0 = canvas.getContext('2d');
  const measured = [];
  let height = pad;
  for (const l of lines) {
    if (l.rule) { measured.push({ rule: true, h: lineH(sizes.normal) }); height += lineH(sizes.normal); continue; }
    const size = sizes[l.size ?? 'normal'];
    ctx0.font = `${l.bold ? '700' : '400'} ${size}px ${FONT}`;
    const words = String(l.text).split(' ');
    const rows = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx0.measureText(next).width > dots - pad * 2 && cur) { rows.push(cur); cur = w; } else cur = next;
    }
    rows.push(cur);
    measured.push({ ...l, size, rows, h: lineH(size) * rows.length });
    height += lineH(size) * rows.length;
  }
  height += pad * 2;

  canvas.width = dots * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, dots, height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  let y = pad;
  for (const m of measured) {
    if (m.rule) {
      const yy = y + Math.round(m.h / 2);
      for (let x = pad; x < dots - pad; x += 8) ctx.fillRect(x, yy, 4, 2);
      y += m.h;
      continue;
    }
    ctx.font = `${m.bold ? '700' : '400'} ${m.size}px ${FONT}`;
    ctx.textAlign = m.align === 'center' ? 'center' : m.align === 'right' ? 'right' : 'left';
    const x = m.align === 'center' ? dots / 2 : m.align === 'right' ? dots - pad : pad;
    for (const row of m.rows) { ctx.fillText(row, x, y); y += lineH(m.size); }
  }
  return canvas;
}

/** El canvas como PNG (Blob). */
export const canvasBlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo armar la imagen del ticket.'))), 'image/png');
});

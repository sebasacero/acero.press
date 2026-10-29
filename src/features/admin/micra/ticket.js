// El ticket de una venta de Micra: lo que se imprime en la Phomemo y lo que va
// por WhatsApp. Puro: recibe la venta registrada (useSale.register) y, si la
// hubo, la ficha del tintero al que se le vendió; devuelve líneas.

import { money, PAY_METHODS } from './captions.js';

export const TICKET_SITE = 'aceropress.com';

/** Número corto del ticket, el que se lee en voz alta: las últimas 6 del pedido. */
export const ticketNumber = (orderId) => String(orderId || '').replace(/-/g, '').slice(-6).toUpperCase() || '——';

const fmtDate = (at, tz = 'America/Bogota') => new Date(at).toLocaleString('es-CO', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Las líneas del ticket, de arriba abajo. Cada una: { text, align?, bold?, size?, rule? }
 * (`rule` es una línea punteada; `size` 'big' para el título y el total).
 */
export function ticketLines({ rec, tintero = null, now = Date.now() }) {
  const pay = PAY_METHODS.find((m) => m.id === rec.payMethod)?.label ?? null;
  const lines = [
    { text: 'ACERO.press', align: 'center', bold: true, size: 'big' },
    { text: 'Café de especialidad · AeroPress', align: 'center' },
    { text: 'Bogotá', align: 'center' },
    { rule: true },
    { text: `Ticket ${ticketNumber(rec.orderId)}`, bold: true },
    { text: fmtDate(rec.at ?? now) },
  ];
  if (tintero?.name) lines.push({ text: `Cliente: ${tintero.name}` });
  lines.push({ rule: true });
  for (const l of rec.lines ?? []) {
    lines.push({ text: `${l.qty} × ${l.label}` });
    if (l.subtotal != null) lines.push({ text: money(l.subtotal), align: 'right' });
  }
  lines.push({ rule: true });
  lines.push({ text: `TOTAL ${money(rec.total)}`, align: 'right', bold: true, size: 'big' });
  if (pay) lines.push({ text: `Pago: ${pay}`, align: 'right' });
  lines.push({ rule: true });
  lines.push({ text: 'Gracias por tomar café de verdad.', align: 'center' });
  lines.push({ text: TICKET_SITE, align: 'center', bold: true });
  return lines;
}

/** El mismo ticket en texto, para WhatsApp. */
export function ticketText(args) {
  return ticketLines(args)
    .map((l) => (l.rule ? '––––––––––––––––' : l.text))
    .join('\n');
}

/** Nombre del archivo del ticket (imagen). */
export const ticketFileName = (rec) => `ticket-${ticketNumber(rec.orderId).toLowerCase()}.png`;

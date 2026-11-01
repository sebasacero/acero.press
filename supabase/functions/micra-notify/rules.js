// Las reglas del aviso por WhatsApp de un apartado nuevo (micra-notify): si se
// manda o por qué no, y el mensaje para la API de WhatsApp de Meta (plantilla
// de utilidad aprobada). JavaScript puro, sin Deno ni Node: lo usa la Edge
// Function y lo prueban las unitarias (rules.test.js).

export const SEEN_MS = 60 * 1000; // con Micra abierta en el último minuto, basta el globito
export const THROTTLE_MS = 10 * 60 * 1000; // a lo más un WhatsApp cada 10 min por barista
export const STALE_MS = 10 * 60 * 1000; // un apartado de hace más de 10 min ya no se avisa
export const DEFAULT_TEMPLATE = 'micra_nuevo_apartado';
export const DEFAULT_LANG = 'es';

const ms = (v) => (v == null ? null : (typeof v === 'number' ? v : Date.parse(v)));

/** El celular para WhatsApp: 57 + 10 números que empiezan por 3; si no, null. */
export function waPhone(phone) {
  const d = String(phone ?? '').replace(/\D/g, '').replace(/^(0057|57)(?=3\d{9}$)/, '');
  return /^3\d{9}$/.test(d) ? `57${d}` : null;
}

/**
 * ¿Se le escribe al barista? `send` o la razón para no hacerlo:
 * not_waiting, stale, no_optin, no_phone, app_open, throttled, unconfigured.
 */
export function decide({ hold, barista, lastSentAt = null, now = Date.now(), configured = true }) {
  if (!hold || hold.status !== 'waiting') return { send: false, reason: 'not_waiting' };
  const created = ms(hold.created_at);
  if (created != null && now - created > STALE_MS) return { send: false, reason: 'stale' };
  if (!barista?.wa_alerts) return { send: false, reason: 'no_optin' };
  if (!waPhone(barista.phone)) return { send: false, reason: 'no_phone' };
  const seen = ms(barista.app_seen_at);
  if (seen != null && now - seen < SEEN_MS) return { send: false, reason: 'app_open' };
  const last = ms(lastSentAt);
  if (last != null && now - last < THROTTLE_MS) return { send: false, reason: 'throttled' };
  if (!configured) return { send: false, reason: 'unconfigured' };
  return { send: true, reason: 'send' };
}

const NAMES = { tinto: ['tinto', 'tintos'], perico: ['perico', 'pericos'], aromatica: ['aromática', 'aromáticas'] };

/** «2 tintos y 1 perico». */
export function itemsText(items) {
  const parts = (items ?? []).filter((i) => Number(i?.qty) > 0).map((i) => {
    const n = NAMES[i.product];
    return `${i.qty} ${n ? n[i.qty === 1 ? 0 : 1] : 'producto'}`;
  });
  if (parts.length < 2) return parts[0] ?? 'café';
  return `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`;
}

/** El nombre de pila del cliente, sin el resto («Sebas · oficina 302» → «Sebas»). */
export const firstName = (name) => String(name ?? '').trim().split(/[ ·,]/)[0].slice(0, 30) || 'Un cliente';

/**
 * El cuerpo para POST /{phone-number-id}/messages: la plantilla con el nombre
 * del cliente ({{1}}) y lo que apartó ({{2}}).
 */
export function templatePayload({ to, hold, template = DEFAULT_TEMPLATE, lang = DEFAULT_LANG }) {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      components: [{
        type: 'body',
        parameters: [{ type: 'text', text: firstName(hold?.name) }, { type: 'text', text: itemsText(hold?.items) }],
      }],
    },
  };
}

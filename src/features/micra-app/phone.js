// El celular del barista: con él entra a Micra por SMS y con él la base lo
// reconoce (tintero_claim_phone). Una sola forma de leerlo, escribirlo y
// guardarlo, para que «300 123 4567», «+57 300…» y «573001234567» sean el
// mismo número. Puro, sin DOM ni red.

const digits = (v) => String(v ?? '').replace(/\D/g, '');

/** Los 10 dígitos de un celular colombiano (empieza por 3), venga como venga; si no lo es, null. */
export function coMobile(input) {
  let d = digits(input);
  if (d.startsWith('0057')) d = d.slice(4);
  else if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}

/** El número como lo pide Supabase para el SMS: «+573001234567». Null si no es un celular colombiano. */
export function normalizeCoPhone(input) {
  const d = coMobile(input);
  return d ? `+57${d}` : null;
}

/**
 * Lo que se va escribiendo, agrupado como se dicta: «300 123 4567». Solo los
 * 10 dígitos del celular (si pegan el +57, se le quita).
 */
export function formatCoPhone(input) {
  let d = digits(input);
  if (d.length > 10 && d.startsWith('57')) d = d.slice(2);
  d = d.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');
}

/**
 * Cómo se guarda en tinteros.phone (solo números, 7 a 15): el celular colombiano
 * siempre con su 57 («573001234567», igual que auth.users.phone y wa.me); otro
 * país, con el indicativo que escribieron. '' si está vacío; null si no se entiende.
 */
export function storedPhone(input) {
  const d = digits(input);
  if (!d) return '';
  const co = coMobile(d);
  if (co) return `57${co}`;
  return /^\d{7,15}$/.test(d) ? d : null;
}

/** El código del SMS: solo números, hasta 6. */
export const cleanOtp = (input) => digits(input).slice(0, 6);

/** Segundos que faltan para poder pedir otro SMS (0 = ya se puede). */
export function resendIn(sentAt, now = Date.now(), wait = 60) {
  if (!sentAt) return 0;
  return Math.max(0, Math.ceil(wait - (now - sentAt) / 1000));
}

/**
 * El error de Supabase Auth al pedir o revisar el SMS, dicho para el barista.
 * Lo de la base (no está registrado, etc.) ya viene en español y pasa igual.
 */
export function smsError(err) {
  const m = String(err?.message ?? err ?? '');
  const code = err?.code ?? '';
  if (/expired|invalid/i.test(m) || code === 'otp_expired') return 'Ese código no sirve o ya venció. Revisa el SMS o pide otro.';
  if (/rate limit|too many|seconds/i.test(m) || code === 'over_sms_send_rate_limit') return 'Pediste muchos códigos seguidos. Espera un minuto y vuelve a intentar.';
  if (/provider|disabled|unsupported phone/i.test(m) || code === 'phone_provider_disabled') return 'La entrada por SMS todavía no está activa. Entra con el código de seis letras que te dio el equipo.';
  if (/fetch|network/i.test(m)) return 'Sin señal. Revisa tu conexión y vuelve a intentar.';
  return m || 'No se pudo. Vuelve a intentar.';
}

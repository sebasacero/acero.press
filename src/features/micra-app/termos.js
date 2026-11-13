// Los termos del día del barista y el termo de sellos del cliente (pedido del
// usuario, 13 nov 2026: el termo como medidor). Lo puro: niveles, cuál está
// sirviendo y cuánto le queda. Los números de partida salen del estudio de calle:
// casi todos llevan 5 termos y de cada uno salen unos 11 tintos (1 L en vasos
// de ~90 ml).

export const TERMOS_DEFAULT = 5;
export const PER_TERMO_DEFAULT = 11;
export const TERMOS_MIN = 1;
export const TERMOS_MAX = 12;
export const PER_MIN = 4;
export const PER_MAX = 30;
export const TERMOS_KEY = 'micra_termos_v1';

const int = (n, d) => (Number.isFinite(Number(n)) ? Math.round(Number(n)) : d);
export const clampTermos = (n) => Math.min(TERMOS_MAX, Math.max(TERMOS_MIN, int(n, TERMOS_DEFAULT)));
export const clampPer = (n) => Math.min(PER_MAX, Math.max(PER_MIN, int(n, PER_TERMO_DEFAULT)));

/** Lo guardado en el celular ({ termos, per }) o lo de siempre si falta o está roto. */
export function readSetting(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!v || typeof v !== 'object') throw new Error('vacío');
    return { termos: clampTermos(v.termos), per: clampPer(v.per) };
  } catch {
    return { termos: TERMOS_DEFAULT, per: PER_TERMO_DEFAULT };
  }
}

/**
 * Cómo van los termos con las tazas vendidas hoy. Se sirven en orden: el
 * primero se vacía antes de abrir el segundo.
 * levels: lo que queda en cada termo (1 lleno, 0 vacío).
 * current: el que está sirviendo (0 en adelante), o null si ya no queda café.
 */
export function termosOf(cups, termos = TERMOS_DEFAULT, per = PER_TERMO_DEFAULT) {
  const n = clampTermos(termos);
  const p = clampPer(per);
  const sold = Math.max(0, int(cups, 0));
  const cap = n * p;
  const used = Math.min(sold, cap);
  const levels = Array.from({ length: n }, (_, i) => {
    const out = Math.min(p, Math.max(0, used - i * p));
    return (p - out) / p;
  });
  const emptied = Math.floor(used / p);
  const current = used >= cap ? null : emptied;
  const leftInCurrent = current === null ? 0 : p - (used - current * p);
  return { termos: n, per: p, levels, current, leftInCurrent, emptied, cap, leftTotal: cap - used, over: Math.max(0, sold - cap) };
}

/** La línea de debajo: cuánto le queda en el termo que sirve, o que ya no hay café. */
export function termosLine(t) {
  if (t.current === null) {
    return t.over > 0
      ? `Vendiste ${t.over} más de lo que cabía: ¿llevas más termos?`
      : 'Se acabó el café de hoy.';
  }
  const tintos = t.leftInCurrent === 1 ? '1 tinto' : `~${t.leftInCurrent} tintos`;
  return `Termo ${t.current + 1} de ${t.termos} · le ${t.leftInCurrent === 1 ? 'queda' : 'quedan'} ${tintos}`;
}

/** El termo de sellos: cada taza entregada lo llena un poco; lleno, el tinto gratis. */
export function stampTermo(toward, per = 10) {
  const p = Math.max(1, int(per, 10));
  const t = Math.min(p, Math.max(0, int(toward, 0)));
  return { level: t / p, marks: p, left: p - t, full: t >= p };
}

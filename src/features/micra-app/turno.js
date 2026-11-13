/**
 * «Terminar turno» (13 nov 2026, pedido del usuario: «falta un botón para
 * terminar el turno»). La flecha ← de la cabecera solo vuelve a «¿Cómo sales
 * hoy?»; terminar el turno es lo mismo en la base (sale del mapa y cierra el
 * recorrido), pero antes avisa lo que queda abierto y después muestra el
 * cierre del día. Puro: sin React ni red.
 */

const cups = (n) => `${n} ${n === 1 ? 'taza' : 'tazas'}`;

/**
 * Lo que hay que saber antes de terminar. `waiting`: tazas apartadas que
 * esperan; `pending`: ventas anotadas sin señal que aún no suben.
 */
export function shiftWarnings({ waiting = 0, pending = 0 } = {}) {
  const out = [];
  if (waiting > 0) out.push(`Te ${waiting === 1 ? 'espera' : 'esperan'} ${cups(waiting)} apartadas. Entrégalas o cancélalas antes de irte.`);
  if (pending > 0) out.push(`${pending === 1 ? '1 venta' : `${pending} ventas`} sin subir: se suben solas cuando haya señal.`);
  return out;
}

/** El cierre del turno: título y la línea de la meta. */
export function shiftClose({ cups: n = 0, goal = 0, streak = 0 } = {}) {
  const title = n === 0 ? 'Turno cerrado' : goal && n >= goal ? '¡Turno cerrado con la meta cumplida!' : 'Buen turno';
  let line;
  if (n === 0) line = 'Hoy no anotaste ventas. Mañana es otro día.';
  else if (goal && n >= goal) line = `Vendiste ${cups(n)}: ${n - goal > 0 ? `${n - goal} más que tu meta` : 'justo tu meta'}.`;
  else if (goal) line = `Vendiste ${cups(n)}. Te faltaron ${goal - n} para tu meta de ${goal}.`;
  else line = `Vendiste ${cups(n)}.`;
  const racha = streak > 1 ? `Llevas ${streak} días seguidos.` : null;
  return { title, line, racha };
}

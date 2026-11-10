// El centro de control de Micra en la portada (pedido del usuario, 10 nov 2026: «un panel de
// control desde donde vamos a tener control total de la operación en tiempo real»).
// Lógica pura: arma lo que el panel muestra con lo público (los baristas que aceptaron salir en
// el mapa) o, para el dueño, con el día completo del equipo (micra_owner_day).

const isLive = (b, now) => !!b.live_until && Date.parse(b.live_until) > now;

/** Minutos desde `iso` hasta `now`, en palabras cortas («ahora», «hace 5 min», «hace 2 h»). */
export function ago(iso, now = Date.now()) {
  if (!iso) return '';
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

/**
 * Lo que muestra el panel.
 * - `baristas`: micra_baristas (público: nombre de pila, localidad, punto, live_until, waiting).
 * - `owner`: micra_owner_day (solo el dueño) o null.
 * - `pending`: publicaciones por revisar (solo el dueño) o null.
 */
export function panelState({ baristas = [], owner = null, pending = null, now = Date.now() } = {}) {
  const team = owner?.baristas ?? null;
  const rows = (team ?? baristas).map((b) => ({
    id: b.id,
    name: (b.name ?? '').split(' ')[0] || 'Barista',
    where: [b.referencia, b.localidad].filter(Boolean).join(' · '),
    live: isLive(b, now),
    until: b.live_until ?? null,
    waiting: Number(b.waiting ?? 0),
    cups: team ? Number(b.cups ?? 0) : null,
    total: team ? Number(b.total ?? 0) : null,
    linked: team ? !!b.linked : !!b.takes_holds,
    prices: team ? !!b.has_prices : b.prices?.tinto != null,
  }));
  // En la calle primero, luego quien tiene tazas esperando, luego por nombre
  rows.sort((a, b) => (b.live - a.live) || (b.waiting - a.waiting) || a.name.localeCompare(b.name, 'es'));
  const sum = (k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const kpis = {
    live: rows.filter((r) => r.live).length,
    baristas: rows.length,
    waiting: sum('waiting'),
    cups: team ? sum('cups') : null,
    total: team ? sum('total') : null,
    served: team ? team.reduce((a, b) => a + Number(b.served ?? 0), 0) : null,
  };
  const alerts = [];
  if (team) {
    if (pending > 0) alerts.push({ key: 'posts', n: pending, href: '/micra/equipo' });
    const noPrice = rows.filter((r) => r.linked && !r.prices).length;
    if (noPrice) alerts.push({ key: 'prices', n: noPrice, href: '/micra/equipo' });
    const unlinked = rows.filter((r) => !r.linked).length;
    if (unlinked) alerts.push({ key: 'unlinked', n: unlinked, href: '/micra/equipo' });
    const waitingOff = rows.filter((r) => r.waiting > 0 && !r.live).length;
    if (waitingOff) alerts.push({ key: 'waitingOff', n: waitingOff, href: '/micra/equipo' });
  }
  return { owner: !!team, rows, kpis, alerts, week: owner?.week ?? null };
}

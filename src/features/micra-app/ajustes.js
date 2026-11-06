// «Qué ajustar» en Equipo › Hoy (6 nov 2026, pedido del usuario: «lo que debemos
// ajustar para aumentar los números y las publicaciones»). Con lo que ya trae el
// día del equipo, ordena los arreglos por cuánto mueven: primero lo que hace que
// haya baristas en la calle, luego que se entregue lo apartado, luego que haya
// publicaciones y clientes nuevos. Cada uno dice el número que lo justifica. Puro.

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/**
 * sum: teamSummary; tot: { live, waiting, served }; week: { cups, holds };
 * posts: { pending, week } (null si la base aún no los trae); challenge: el reto abierto o null;
 * clients: data.clients (o null).
 */
export function growthTips({ sum, tot, week = null, posts = null, challenge = null, clients = null } = {}) {
  const tips = [];
  const add = (key, weight, title, text, action = null) => tips.push({ key, weight, title, text, action });
  const active = sum?.active ?? 0;

  if (active > 0 && tot.live < active) {
    const off = active - tot.live;
    add('salir', 100 * (off / active), `Que salgan ${off === 1 ? 'el que falta' : `los ${off} que faltan`}`,
      `Hoy salieron ${tot.live} de ${active} baristas activos (${pct(tot.live, active)} %). Cada uno en la calle es lo que más sube tazas y apartados: escríbeles para que toquen «Salí a vender».`);
  }
  const almost = sum?.almost?.length ?? 0;
  if (almost > 0) {
    add('activar', 80, `Activa a ${almost === 1 ? '1 barista' : `${almost} baristas`} a un paso`,
      `Le${almost === 1 ? '' : 's'} falta poco: su celular, el permiso para salir en público o el precio del tinto. Completo, sale en el mapa y recibe apartados.`, { label: 'Ver quiénes', to: 'activation' });
  }
  const held = (tot.waiting ?? 0) + (tot.served ?? 0);
  if (held >= 3 && pct(tot.served, held) < 60) {
    add('entregar', 70, 'Que se entregue lo apartado',
      `De ${held} apartados de hoy se han entregado ${tot.served} (${pct(tot.served, held)} %). Un apartado que no llega cuesta un cliente: recuérdales mirar «te esperan».`);
  }
  if (posts) {
    if (posts.pending > 0) {
      add('revisar', 75, `Revisa ${posts.pending === 1 ? '1 publicación' : `${posts.pending} publicaciones`}`,
        'Están esperando tu sí para salir en Hoy. Lo que se aprueba rápido anima a publicar otra vez.', { label: 'Revisar', to: 'review' });
    }
    const goal = Math.max(3, active);
    if (posts.week < goal) {
      add('publicar', 60 + (goal - posts.week), 'Más publicaciones en Hoy',
        `Esta semana salieron ${posts.week} de los baristas; la meta es ${goal} (una por barista activo). ${challenge ? `El reto «${challenge.title}» está abierto: recuérdaselo.` : 'Un reto de la semana es lo que más trae fotos: abre uno.'}`,
        challenge ? null : { label: 'Abrir un reto', to: 'challenge' });
    }
  } else if (!challenge) {
    add('reto', 50, 'Abre el reto de la semana', 'Con un reto abierto los baristas mandan su foto y los clientes califican: es lo que más llena Hoy.', { label: 'Abrir un reto', to: 'challenge' });
  }
  if (clients && clients.new_7d === 0) {
    add('clientes', 55, 'Ningún cliente nuevo en 7 días',
      'Pide a cada barista que comparta su QR «Pídeme por Micra» con los que ya le compran: el primer apartado los activa.');
  }
  if (week && week.cups > 0 && week.holds === 0) {
    add('apartar', 45, 'Nadie aparta todavía',
      `Esta semana se vendieron ${week.cups} tazas y 0 se apartaron por Micra. Que el barista diga «apártamela por Micra» al entregar.`);
  }
  return tips.sort((a, b) => b.weight - a.weight).slice(0, 5);
}

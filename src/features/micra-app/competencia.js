// Competencia: el reto de la semana (20261101120000_micra_competencia.sql).
// Lo puro: cuánto falta, el podio, la llave de votos de este celular, el
// formulario del equipo y las ideas de retos. Sin React ni Supabase, con tests.
import { newRef } from './micraApp.js';

export const MIN_VOTES = 3; // con menos votos no se entra al podio
export const VOTE_REF_KEY = 'micra_vote_ref_v1';
export const KINDS = [['arte_latte', 'Arte latte'], ['foto', 'Foto del puesto']];

// Los retos básicos (6 nov 2026, pedido del usuario): las experiencias de base del barismo,
// por secciones, como un camino. Cada uno pide una foto (y la receta en el texto cuando
// importa); los de arte latte pasan además por el Juez Micra. El equipo los abre como reto de
// la semana (Equipo › Hoy › Competencia) y el barista los ve todos en Competencia para practicar.
// Sin cambios en la base: el nombre lleva la sección («Filtrados: …») y el tipo es arte latte o foto.
export const BASIC_SECTIONS = [
  {
    id: 'filtrados', label: 'Filtrados', icon: '⏳', why: 'La base del café de la calle: receta medida, agua a la temperatura justa y un tiempo que se repite.',
    challenges: [
      { kind: 'foto', title: 'Filtrados: tu receta de AeroPress', brief: 'La AeroPress lista con tu café. En el texto: gramos, agua, temperatura y tiempo.', how: 'Se ve el método y la receta está completa.' },
      { kind: 'foto', title: 'Filtrados: el tinto de colador', brief: 'El tinto de siempre en filtro de tela, hecho con medida. Muestra la taza y cuéntanos tu proporción.', how: 'Taza limpia, sin borra, y la proporción escrita.' },
      { kind: 'foto', title: 'Filtrados: cold brew de 12 horas', brief: 'Tu café en frío: el frasco al empezar y al terminar, con la hora.', how: 'Las dos fotos y la receta (gramos por litro).' },
    ],
  },
  {
    id: 'espresso', label: 'Espresso', icon: '🎯', why: 'Dosis, molienda y tiempo: el shot enseña a leer la extracción.',
    challenges: [
      { kind: 'foto', title: 'Espresso: la crema avellana', brief: 'Un shot recién sacado, visto desde arriba: crema pareja, color avellana, sin manchas claras.', how: 'Crema pareja y espesa; en el texto, dosis y segundos.' },
      { kind: 'foto', title: 'Espresso: 18 g en 28 segundos', brief: 'La báscula y el cronómetro en la foto: 18 g de café, unos 36 g de bebida, entre 25 y 30 s.', how: 'Se leen la báscula y el tiempo.' },
      { kind: 'foto', title: 'Espresso: ristretto y lungo', brief: 'El mismo café en corto y en largo, lado a lado. Cuenta cuál te gustó más y por qué.', how: 'Las dos tazas y una nota de sabor de cada una.' },
    ],
  },
  {
    id: 'arte_latte', label: 'Arte latte', icon: '🤍', why: 'Leche bien texturizada y el pulso del vertido. El Juez Micra califica contraste, simetría y centrado.',
    challenges: [
      { kind: 'arte_latte', title: 'Arte latte: tu mejor corazón', brief: 'Un perico con el corazón más limpio. Vale la foto desde arriba, con luz natural.', how: 'Juez Micra + granos de clientes y baristas.' },
      { kind: 'arte_latte', title: 'Arte latte: el tulipán', brief: 'Tres capas o más, bien centradas.', how: 'Juez Micra + granos.' },
      { kind: 'arte_latte', title: 'Arte latte: la rosetta', brief: 'Hojas parejas y simétricas. Sube la foto apenas la sirvas.', how: 'Juez Micra + granos.' },
    ],
  },
  {
    id: 'leche', label: 'Leche', icon: '🥛', why: 'Antes del dibujo, la textura: leche sedosa, sin burbujas grandes y sin quemarla (60 a 65 °C).',
    challenges: [
      { kind: 'foto', title: 'Leche: textura de pintura', brief: 'La jarra recién texturizada: brillante, sin burbujas grandes. Si tienes termómetro, que se vea.', how: 'Brillo, espuma fina y la temperatura.' },
      { kind: 'foto', title: 'Leche: el perico perfecto', brief: 'Mitad café, mitad leche, en el vaso de la calle. Que se vea la capa de espuma.', how: 'Proporción pareja y espuma fina.' },
    ],
  },
  {
    id: 'molienda', label: 'Molienda y receta', icon: '⚖️', why: 'Medir es lo que separa un buen café de uno de suerte: molienda, proporción y agua.',
    challenges: [
      { kind: 'foto', title: 'Molienda: tres tamaños', brief: 'Gruesa, media y fina en la palma o en una hoja, con una moneda al lado para comparar.', how: 'Se distinguen los tres tamaños.' },
      { kind: 'foto', title: 'Receta: mide tu proporción', brief: 'Pesa café y agua de tu tinto de todos los días. Foto de la báscula y tu proporción (1:15, 1:16…).', how: 'La báscula se lee y la proporción está escrita.' },
    ],
  },
  {
    id: 'cata', label: 'Cata y origen', icon: '👃', why: 'Saber qué vendes: de dónde viene el café y a qué sabe, para contárselo al cliente.',
    challenges: [
      { kind: 'foto', title: 'Cata: tu café en tres palabras', brief: 'La taza y tres notas de la rueda de sabores (dulce, frutal, chocolate…).', how: 'Tres notas que se sienten de verdad.' },
      { kind: 'foto', title: 'Origen: la finca de tu café', brief: 'La bolsa o la etiqueta de tu café: región, altura, variedad o proceso.', how: 'Se lee el origen.' },
    ],
  },
  {
    id: 'calle', label: 'Servicio en la calle', icon: '🛒', why: 'Lo que el cliente ve primero: el puesto limpio, el termo caliente y la atención de siempre.',
    challenges: [
      { kind: 'foto', title: 'Calle: tu puesto limpio', brief: 'Tu carrito, sombrilla o termo listo para vender: ordenado, limpio y con tus precios a la vista.', how: 'Limpieza, orden y precios claros.' },
      { kind: 'foto', title: 'Calle: el termo caliente', brief: 'El tinto del termo a las 3 de la tarde todavía a más de 70 °C. Muestra el termómetro o cuenta tu truco.', how: 'La temperatura o el truco, explicado.' },
      { kind: 'foto', title: 'Calle: tu puesto al amanecer', brief: 'La primera luz del día sobre tu carrito, tu sombrilla o tu termo.', how: 'Granos de clientes y baristas.' },
      { kind: 'foto', title: 'Calle: el cliente de siempre', brief: 'Con su permiso: la persona que te compra todos los días.', how: 'Granos de clientes y baristas.' },
    ],
  },
];

// Ideas para abrir un reto (el equipo las toca y las ajusta): todos los retos básicos
export const CHALLENGE_IDEAS = BASIC_SECTIONS.flatMap((s) => s.challenges.map((c) => ({ ...c, section: s.id })));

/** El nombre sin la sección, con mayúscula: «Espresso: la crema avellana» → «La crema avellana». */
export function shortTitle(title) {
  const t = String(title ?? '').replace(/^[^:]+:\s*/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** La sección de un reto por su nombre («Espresso: …»); los viejos sin prefijo también. */
export function sectionOf(challenge) {
  const title = String(challenge?.title ?? '').trim().toLowerCase();
  if (!title) return null;
  const exact = CHALLENGE_IDEAS.find((i) => i.title.toLowerCase() === title);
  if (exact) return BASIC_SECTIONS.find((s) => s.id === exact.section);
  if (challenge?.kind === 'arte_latte' || title.startsWith('arte latte')) return BASIC_SECTIONS.find((s) => s.id === 'arte_latte');
  return BASIC_SECTIONS.find((s) => title.startsWith(s.label.toLowerCase()) || title.startsWith(s.id)) ?? null;
}

/** «Cierra hoy», «Cierra mañana», «Quedan 4 días» o «Cerró». */
export function daysLeftLabel(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n < 0) return 'Cerró';
  if (n === 0) return 'Cierra hoy';
  if (n === 1) return 'Cierra mañana';
  return `Quedan ${n} días`;
}

/** «4,2» con una decimal; sin votos, «—». */
export const scoreLabel = (avg) => (avg == null ? '—' : Number(avg).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/**
 * El podio: con MIN_VOTES o más, por promedio y luego por votos (puesto 1, 2,
 * 3…); los demás después, los más votados primero, sin puesto.
 */
export function rankEntries(entries, { minVotes = MIN_VOTES } = {}) {
  const list = (Array.isArray(entries) ? entries : []).filter((e) => e && e.id);
  const by = (a, b) => (Number(b.avg ?? 0) - Number(a.avg ?? 0)) || ((b.votes ?? 0) - (a.votes ?? 0)) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
  const ranked = list.filter((e) => (e.votes ?? 0) >= minVotes).sort(by).map((e, i) => ({ ...e, rank: i + 1 }));
  const rest = list.filter((e) => (e.votes ?? 0) < minVotes).sort((a, b) => ((b.votes ?? 0) - (a.votes ?? 0)) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))).map((e) => ({ ...e, rank: null }));
  return [...ranked, ...rest];
}

/** La llave de votos de este celular: distinta a la de los apartados y a la del «busco café». */
export function voteRef(store, rand) {
  try {
    const cur = store?.getItem(VOTE_REF_KEY);
    if (cur && /^voto-[a-z0-9-]{8,}$/.test(cur)) return cur;
    const ref = newRef('voto', rand);
    store?.setItem(VOTE_REF_KEY, ref);
    return ref;
  } catch { return newRef('voto', rand); }
}

/** ¿Puede calificar esta entrada? No la suya, y solo con el reto abierto. */
export const canVote = (entry, challenge) => !!entry && !entry.mine && Number(challenge?.days_left) >= 0;

export const ENTRY_STATUS = { pending: 'En revisión', approved: 'En el reto', rejected: 'No entró' };

/** El formulario del equipo → lo que va a micra_challenge_save, o el error. */
export function challengeDraft(f, today) {
  const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const title = t(f.title, 80);
  if (title.length < 2) return { error: 'Falta el nombre del reto.' };
  const starts = /^\d{4}-\d{2}-\d{2}$/.test(f.starts_on ?? '') ? f.starts_on : today;
  const ends = /^\d{4}-\d{2}-\d{2}$/.test(f.ends_on ?? '') ? f.ends_on : null;
  if (!ends) return { error: 'Falta hasta cuándo va el reto.' };
  if (ends < starts) return { error: 'La fecha final va después de la inicial.' };
  return {
    ch: {
      title, brief: t(f.brief, 280) || null, prize: t(f.prize, 120) || null,
      kind: KINDS.some(([id]) => id === f.kind) ? f.kind : 'arte_latte',
      starts_on: starts, ends_on: ends,
    },
  };
}

/**
 * El medallero de la cabecera: una medalla por sección de retos básicos. Se
 * enciende cuando un reto de esa sección ya cerró; «ganada» si tuvo ganador.
 * Los retos que no caen en ninguna sección cuentan solo en el total.
 */
export function medalBoard(past = []) {
  const closed = (past ?? []).filter(Boolean);
  const medals = BASIC_SECTIONS.map((s) => {
    const mine = closed.filter((p) => sectionOf(p)?.id === s.id);
    return { id: s.id, label: s.label.split(' ')[0], done: mine.length, won: mine.filter((p) => p.winner).length };
  });
  return { medals, total: closed.length, won: closed.filter((p) => p.winner).length };
}

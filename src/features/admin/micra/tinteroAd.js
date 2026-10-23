// Filtro «Tintero aliado»: la tarjeta de publicidad de un tintero, armada con
// su ficha (nombre, dónde está, qué vende, a qué hora) y su encuesta (hace
// cuánto vende, qué días, cómo le pagan). La foto se toma al final, después
// de la encuesta. Puro, sin DOM.
//
// De la encuesta solo sale lo que sirve para publicidad: nunca notas, género,
// edad ni ingresos (la API ni siquiera los manda a esta tarjeta).
//
// Sale su nombre en redes: solo con su permiso de publicidad (ad_consent),
// distinto del permiso de la foto del estudio, que es privada.

import { TINTERO_OPTIONS, hourLabel } from './tinteroForm.js';
import { money } from './captions.js';
import { OPTIONS } from '../survey/survey.js';

const label = (field, v) => TINTERO_OPTIONS[field]?.find(([x]) => x === v)?.[1] ?? null;
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','));

/** Puede salir en una publicación: aceptó la publicidad. */
export const canAdvertise = (t) => !!t?.ad_consent;

/** Dónde encontrarlo, corto para la pieza «Ubicación» (máx. 30). */
export function adPlace(t) {
  const area = t?.localidad || t?.zone || '';
  if (t?.carrera && t?.calle) {
    const cuadra = `Cl. ${fmt(Number(t.calle))} # ${fmt(Number(t.carrera))}`;
    const full = area ? `${cuadra} · ${area}` : cuadra;
    return full.length <= 30 ? full : cuadra;
  }
  return area ? `${area}, Bogotá`.slice(0, 30) : 'Bogotá';
}

/** Lo que vende, con precio donde se anotó: «Tinto $1.500 · Perico $2.000 · Aromática». */
export function adProducts(t) {
  const price = { tinto: t?.tinto_price, perico: t?.perico_price, aromatica: t?.aromatica_price };
  const list = t?.products?.length ? t.products : Object.keys(price).filter((k) => price[k] != null);
  return list
    .map((p) => {
      const name = label('products', p);
      if (!name) return null;
      return price[p] != null ? `${name} ${money(price[p])}` : name;
    })
    .filter(Boolean)
    .join(' · ');
}

/** «De 6 a. m. a 12 m.», «Desde las 6 a. m.» o ''. */
export function adHours(t) {
  const a = t?.hora_inicio;
  const b = t?.hora_fin;
  if (a != null && b != null) return `De ${hourLabel(a)} a ${hourLabel(b)}`;
  if (a != null) return `Desde las ${hourLabel(a)}`;
  if (b != null) return `Hasta las ${hourLabel(b)}`;
  return '';
}

const YEARS = { menos_1: 'Nuevo en la calle', '1_3': '1 a 3 años en la calle', '3_10': 'Más de 3 años en la calle', mas_10: 'Más de 10 años en la calle' };

/** Cómo le pagan: lo que dijo en la encuesta, o lo que se vio en la ficha. */
export function adPayments(t, survey = t?.survey) {
  const said = (survey?.payments ?? []).map((p) => OPTIONS.payments.find(([v]) => v === p)?.[1]).filter(Boolean);
  const seen = (t?.payments_seen ?? []).filter((p) => p !== 'fiado').map((p) => label('payments_seen', p)).filter(Boolean);
  const list = said.length ? said : seen;
  return list.length ? `Recibe ${list.join(' · ')}` : '';
}

/** Lo que cuenta la encuesta: «Más de 10 años en la calle · 6 días a la semana». */
export function adStory(survey) {
  const d = survey?.days_per_week;
  return [YEARS[survey?.years_selling], d === 7 ? 'Todos los días' : d ? `${d} días a la semana` : null].filter(Boolean).join(' · ');
}

/** Junta renglones mientras quepan (los primeros son los que más importan). */
function fit(lines, max) {
  const out = [];
  for (const l of lines.filter(Boolean)) {
    const next = [...out, l].join('\n');
    if (next.length <= max) out.push(l);
    else if (!out.length) out.push(l.slice(0, max));
  }
  return out.join('\n');
}

/**
 * Textos de la tarjeta (los mismos huecos que el editor: título, subtítulo,
 * ubicación y el texto del anuncio). El texto cabe en los 140 del anuncio.
 */
export function adTexts(t, survey = t?.survey) {
  const name = String(t?.name ?? '').trim().slice(0, 40);
  const how = [label('formato', t?.formato), t?.recorrido === 'ruta' ? 'Hace ruta' : null, adHours(t)].filter(Boolean).join(' · ');
  const sells = adProducts(t);
  const announce = fit([sells ? `Vende: ${sells}` : 'Tinto en la calle', how, adPayments(t, survey), adStory(survey)], 140);
  return {
    title: name,
    subtitle: `TINTERO ALIADO · ${String(t?.localidad || t?.zone || 'Bogotá').toLocaleUpperCase('es-CO')}`.slice(0, 48),
    place: adPlace(t),
    announce,
  };
}

/** Pie de foto para redes. */
export function adCaption(t, survey = t?.survey) {
  const x = adTexts(t, survey);
  return `☕ ${x.title}, tintero aliado de ACERO.press\n\n${x.announce}\n\n📍 ${x.place}\n\nApoya el café de la calle: búscalo y pídele un tinto.`;
}

// Encuesta del tintero: preguntas, conversiones y validación. Dos minutos de
// pie frente al puesto, con botones; lo que se OBSERVA (precio del tinto,
// tazas por hora, foto) va en la ficha, aquí va lo que el tintero DICE.
// Solo datos, sin React: corre en node --test. Los rangos son los mismos de
// la base (supabase/migrations/20261022140000_tintero_surveys.sql).

/** La «libra» de la tienda en Colombia: 500 g. La base guarda gramos y precio por kilo. */
export const LIBRA_G = 500;

const YES3 = [['si', 'Sí'], ['tal_vez', 'Tal vez'], ['no', 'No']];

export const OPTIONS = {
  years_selling: [['menos_1', 'Menos de 1 año'], ['1_3', '1 a 3 años'], ['3_10', '3 a 10 años'], ['mas_10', 'Más de 10']],
  buys_where: [['tienda', 'Tienda de barrio'], ['supermercado', 'Supermercado'], ['plaza', 'Plaza de mercado'], ['distribuidor', 'Distribuidor'], ['otro', 'Otro']],
  would_sell_specialty: YES3,
  kit_interest: YES3,
  kit_payment: [['contado', 'De contado'], ['cuotas', 'En cuotas'], ['arriendo', 'Arrendado'], ['no_sabe', 'No sabe']],
  has_smartphone: [[true, 'Sí'], [false, 'No']],
  payments: [['efectivo', 'Efectivo'], ['nequi', 'Nequi'], ['daviplata', 'Daviplata'], ['bre_b', 'Bre-B'], ['tarjeta', 'Tarjeta']],
  gender: [['mujer', 'Mujer'], ['hombre', 'Hombre'], ['otro', 'Otro'], ['prefiere_no', 'Prefiere no decir']],
  age_range: [['18_24', '18 a 24'], ['25_34', '25 a 34'], ['35_44', '35 a 44'], ['45_54', '45 a 54'], ['55_64', '55 a 64'], ['65_mas', '65 o más'], ['prefiere_no', 'Prefiere no decir']],
  main_income: [['si', 'Sí'], ['no', 'No'], ['prefiere_no', 'Prefiere no decir']],
};

/** Etiqueta de una opción guardada (para el informe y las fichas). */
export const optionLabel = (field, value) => OPTIONS[field]?.find(([v]) => v === value)?.[1] ?? null;

// Marcas que se ven en los puestos; «Otra» abre el campo de texto
export const BRANDS = ['Águila Roja', 'Sello Rojo', 'La Bastilla', 'Colcafé', 'Juan Valdez', 'Sin marca'];

export const PRESETS = {
  cups_per_day: [30, 50, 80, 120, 200],
  hours_per_day: [4, 6, 8, 10, 12],
  libras_week: [0.5, 1, 2, 3, 5, 10],
  days_per_week: [1, 2, 3, 4, 5, 6, 7],
};

export const EMPTY_SURVEY = {
  consent: false,
  cups_per_day: '', hours_per_day: '', days_per_week: null, years_selling: null,
  coffee_brand: '', libras_week: '', price_libra: '', buys_where: null,
  would_sell_specialty: null, specialty_price: '', kit_interest: null, kit_payment: null,
  has_smartphone: null, payments: [],
  gender: null, age_range: null, main_income: null,
  notes: '',
};

/** «1.500», «$ 2.000» → 1500. Vacío → null. */
export function parseMoney(v) {
  if (v === null || v === undefined) return null;
  const digits = String(v).replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

/** «0,5», «1.5», «2» → número. Vacío o basura → null (NaN si hay texto que no es número). */
export function parseDecimal(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

const QUESTION_KEYS = ['cups_per_day', 'hours_per_day', 'days_per_week', 'years_selling', 'coffee_brand', 'libras_week', 'price_libra', 'buys_where',
  'would_sell_specialty', 'specialty_price', 'kit_interest', 'kit_payment', 'has_smartphone', 'payments', 'gender', 'age_range', 'main_income'];

const answered = (form, k) => {
  const v = form[k];
  if (Array.isArray(v)) return v.length > 0;
  return v !== null && v !== undefined && String(v).trim() !== '';
};

/** Cuántas preguntas van respondidas (para la barra de avance). */
export function surveyProgress(form) {
  return { answered: QUESTION_KEYS.filter((k) => answered(form, k)).length, total: QUESTION_KEYS.length };
}

/**
 * Del formulario a lo que recibe la API (POST /api/v1/bi/tinteros/{id}/surveys):
 * { body } o { error } con la primera pregunta que no cuadra.
 */
export function buildSurvey(form, { surveyedAt = new Date() } = {}) {
  if (!form.consent) return { error: 'Primero el permiso: sin él no se guarda nada.' };
  const body = { consent: true, surveyed_at: surveyedAt.toISOString() };

  const int = (key, label, min, max) => {
    if (!answered(form, key)) return null;
    const n = parseDecimal(form[key]);
    if (!Number.isFinite(n) || n < min || n > max) return `${label}: entre ${min} y ${max}.`;
    body[key] = Math.round(n);
    return null;
  };
  const err = int('cups_per_day', 'Tazas al día', 0, 2000)
    || (() => {
      if (!answered(form, 'hours_per_day')) return null;
      const h = parseDecimal(form.hours_per_day);
      if (!Number.isFinite(h) || h <= 0 || h > 24) return 'Horas al día: más de 0 y hasta 24.';
      body.hours_per_day = Math.round(h * 10) / 10;
      return null;
    })()
    || (() => {
      if (form.days_per_week === null || form.days_per_week === undefined) return null;
      const d = Number(form.days_per_week);
      if (!Number.isInteger(d) || d < 1 || d > 7) return 'Días a la semana: de 1 a 7.';
      body.days_per_week = d;
      return null;
    })()
    || (() => {
      if (!answered(form, 'libras_week')) return null;
      const lb = parseDecimal(form.libras_week);
      if (!Number.isFinite(lb) || lb < 0 || lb > 400) return 'Café a la semana: en libras de 500 g, hasta 400.';
      body.coffee_g_week = Math.round(lb * LIBRA_G);
      return null;
    })()
    || (() => {
      if (!answered(form, 'price_libra')) return null;
      const p = parseMoney(form.price_libra);
      if (p === null || p > 250000) return 'Precio de la libra: hasta $250.000.';
      body.coffee_price_kg = Math.round((p * 1000) / LIBRA_G);
      return null;
    })()
    || (() => {
      if (!answered(form, 'specialty_price')) return null;
      const p = parseMoney(form.specialty_price);
      if (p === null || p > 50000) return 'Precio de la taza de especialidad: hasta $50.000.';
      body.specialty_price = p;
      return null;
    })();
  if (err) return { error: err };

  const brand = String(form.coffee_brand ?? '').trim();
  if (brand) {
    if (brand.length > 60) return { error: 'La marca del café: máximo 60 letras.' };
    body.coffee_brand = brand;
  }
  for (const key of ['years_selling', 'buys_where', 'would_sell_specialty', 'kit_interest', 'kit_payment', 'gender', 'age_range', 'main_income']) {
    if (form[key] === null || form[key] === undefined) continue;
    if (!OPTIONS[key].some(([v]) => v === form[key])) return { error: `Respuesta no válida en ${key}.` };
    body[key] = form[key];
  }
  if (form.has_smartphone === true || form.has_smartphone === false) body.has_smartphone = form.has_smartphone;
  const pays = [...new Set(form.payments ?? [])];
  if (pays.some((p) => !OPTIONS.payments.some(([v]) => v === p))) return { error: 'Medio de pago no válido.' };
  if (pays.length) body.payments = pays;
  const notes = String(form.notes ?? '').trim();
  if (notes) body.notes = notes.slice(0, 500);
  return { body };
}

/** La encuesta más reciente de cada tintero. */
export function latestByTintero(surveys) {
  const out = new Map();
  for (const s of surveys ?? []) {
    if (!s?.tintero_id) continue;
    const prev = out.get(s.tintero_id);
    if (!prev || String(s.surveyed_at) > String(prev.surveyed_at)) out.set(s.tintero_id, s);
  }
  return out;
}

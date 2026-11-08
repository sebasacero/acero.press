// La presencia digital de las fincas cafeteras (8 nov 2026, pedido del usuario).
// Nadie publica cuántas de las ~540.000 familias cafeteras tienen web o redes: la
// estimación de hoy es 1 % a 3 % con cuenta propia de la finca y menos de 0,5 % con
// web propia (informe del 8 nov). Aquí se mide de verdad: el caficultor que crea su
// finca en Micra contesta qué tiene en internet, y el equipo saca una cifra con su
// margen. La cifra que vale es la de la muestra al azar (una lista de un comité o
// cooperativa, sorteada aquí): quien llega solo a Micra ya está en internet y la infla.
// También vive aquí la oferta de Micra para las fincas y el mensaje para invitarlas.

export const FINCA_REF_KEY = 'micra_finca_ref_v1';
/** Familias cafeteras: FNC citada por Portafolio (2021); 2026 dice «cerca de 550.000». */
export const BASE_FAMILIAS = 540227;
export const MUESTRA_META = 203;

/** Lo que la finca tiene en internet (varias a la vez). `nivel`: 1 personal, 2 cuenta de la finca, 3 web propia. */
export const CANALES = [
  { id: 'whatsapp', label: 'WhatsApp en mi celular', nivel: 1 },
  { id: 'whatsapp_business', label: 'WhatsApp Business de la finca', nivel: 2 },
  { id: 'instagram', label: 'Instagram de la finca', nivel: 2 },
  { id: 'facebook', label: 'Página de Facebook de la finca', nivel: 2 },
  { id: 'tiktok', label: 'TikTok de la finca', nivel: 2 },
  { id: 'maps', label: 'La finca sale en Google Maps', nivel: 2 },
  { id: 'tienda', label: 'Vendo en una tienda en línea', nivel: 3 },
  { id: 'web', label: 'Página web propia', nivel: 3 },
  { id: 'ninguna', label: 'Nada de esto', nivel: 0 },
];
export const VENTAS = [
  { id: 'cooperativa', label: 'A la cooperativa o la FNC' },
  { id: 'intermediario', label: 'A un comprador del pueblo' },
  { id: 'exportador', label: 'A un exportador o tostador directo' },
  { id: 'marca', label: 'Con mi propia marca' },
];
export const INTERES = [
  { id: 'si', label: 'Sí' },
  { id: 'tal_vez', label: 'Tal vez' },
  { id: 'no', label: 'No por ahora' },
];
export const NIVELES = [
  { id: 0, key: 'sin', label: 'Sin internet para la finca' },
  { id: 1, key: 'personal', label: 'Solo WhatsApp personal' },
  { id: 2, key: 'cuenta', label: 'Cuenta propia de la finca' },
  { id: 3, key: 'web', label: 'Web o tienda en línea' },
];
/** Los departamentos cafeteros (para ubicar el municipio que escribe). */
export const DEPARTAMENTOS = [
  'Antioquia', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Cundinamarca', 'Huila', 'La Guajira', 'Magdalena',
  'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'Santander', 'Tolima', 'Valle del Cauca',
];

const plain = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const text = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** «Pitalito, Huila» → «Huila»; «valle» → «Valle del Cauca»; lo que no se reconoce → null. */
export function departamentoDe(city) {
  const parts = String(city ?? '').split(/[,·\-/]/).map(plain).filter(Boolean);
  for (const p of parts.reverse()) {
    const hit = DEPARTAMENTOS.find((d) => plain(d) === p) ?? DEPARTAMENTOS.find((d) => p.length >= 4 && plain(d).startsWith(p));
    if (hit) return hit;
  }
  return null;
}

/** El usuario de Instagram como se guarda: sin @ ni enlace, solo lo que Instagram acepta. */
export function igHandle(v) {
  const s = String(v ?? '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0].toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) && !/^\.|\.$|\.\./.test(s) ? s : null;
}
/** La web con https y sin espacios; «finca.com» → «https://finca.com». */
export function webUrl(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const u = /^https?:\/\//i.test(s) ? s.replace(/^http:/i, 'https:') : `https://${s}`;
  return /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s]*)?$/i.test(u) ? u.slice(0, 200) : null;
}

/** El nivel de la finca: el más alto de lo que marcó; «Nada de esto» gana sobre lo demás solo si va solo. */
export function nivelDe(canales = []) {
  const set = new Set(canales);
  return CANALES.filter((c) => set.has(c.id)).reduce((n, c) => Math.max(n, c.nivel), 0);
}
/** Marcar «Nada de esto» quita lo demás; marcar otra cosa quita «Nada de esto». */
export function toggleCanal(canales = [], id) {
  if (id === 'ninguna') return canales.includes('ninguna') ? [] : ['ninguna'];
  const rest = canales.filter((c) => c !== 'ninguna');
  return rest.includes(id) ? rest.filter((c) => c !== id) : [...rest, id];
}

export const emptyPresencia = () => ({ canales: [], venta: '', interes: '', ig: '', web: '', consent: false });

/** Qué falta para seguir (vacío = se puede). El permiso es opcional: sin él solo va por WhatsApp. */
export function presenciaMissing(p) {
  const out = [];
  if (!p?.canales?.length) out.push('qué tiene tu finca en internet');
  if (!VENTAS.some((v) => v.id === p?.venta)) out.push('a quién le vendes');
  if (!INTERES.some((v) => v.id === p?.interes)) out.push('si te interesa vender a baristas');
  if (p?.ig && !igHandle(p.ig)) out.push('un usuario de Instagram válido');
  if (p?.web && !webUrl(p.web)) out.push('una página web válida');
  return out;
}

/** Lo que va a la base (sin nombre de la finca ni del caficultor: solo un hash para no contarla dos veces). */
export function presenciaPayload(finca, p, ref = null) {
  const canales = CANALES.map((c) => c.id).filter((id) => p?.canales?.includes(id));
  const ha = Number(String(finca?.hectares ?? '').replace(',', '.'));
  return {
    consent: p?.consent === true,
    finca_key: `${plain(finca?.name)}|${plain(finca?.city)}`,
    departamento: departamentoDe(finca?.city),
    hectareas: Number.isFinite(ha) && ha > 0 ? Math.round(ha * 10) / 10 : null,
    canales,
    nivel: nivelDe(canales),
    venta: VENTAS.some((v) => v.id === p?.venta) ? p.venta : null,
    interes: INTERES.some((v) => v.id === p?.interes) ? p.interes : null,
    ig: igHandle(p?.ig),
    web: webUrl(p?.web),
    ref: refCode(ref?.ref),
    muestra: ref?.muestra === true,
  };
}

/** Las líneas del mensaje de WhatsApp al equipo. */
export function presenciaLines(p) {
  const canales = CANALES.filter((c) => p?.canales?.includes(c.id)).map((c) => c.label.toLowerCase());
  const venta = VENTAS.find((v) => v.id === p?.venta)?.label;
  return [
    `En internet: ${canales.length ? canales.join(', ') : 'sin responder'}${igHandle(p?.ig) ? ` (@${igHandle(p.ig)})` : ''}${webUrl(p?.web) ? ` · ${webUrl(p.web)}` : ''}`,
    venta ? `Hoy vendo: ${venta.toLowerCase()}` : null,
  ].filter(Boolean);
}

// ---------- De dónde llegó: el enlace de invitación ----------
/** Un código corto de invitación: letras, números y guiones. */
export const refCode = (v) => { const s = plain(v).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32); return s || null; };

/** `?ref=coop-pitalito&m=1` → { ref, muestra }. `m=1` marca que la finca salió del sorteo. */
export function readRefParams(search) {
  const q = new URLSearchParams(search || '');
  const ref = refCode(q.get('ref'));
  return ref ? { ref, muestra: q.get('m') === '1' } : null;
}
export function rememberRef(r, storage = globalThis.localStorage) {
  try { if (r) storage?.setItem(FINCA_REF_KEY, JSON.stringify(r)); } catch { /* sin memoria */ }
}
export function readRef(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(FINCA_REF_KEY) ?? 'null'); return v && refCode(v.ref) ? { ref: refCode(v.ref), muestra: v.muestra === true } : null; } catch { return null; }
}

/** El enlace de la oferta con su código; `muestra` para las fincas sorteadas. */
export function inviteUrl(site, ref, muestra = false) {
  const r = refCode(ref);
  const base = `${String(site || '').replace(/\/+$/, '')}/micra/fincas`;
  return r ? `${base}?ref=${r}${muestra ? '&m=1' : ''}` : base;
}
/** El mensaje que el equipo, un comité o un caficultor manda por WhatsApp. */
export function inviteText({ url, nombre = '' }) {
  const hola = text(nombre, 60) ? `Hola, ${text(nombre, 60)}.` : 'Hola.';
  return [
    `${hola} Micra es una app de Bogotá donde los baristas de la calle compran café por kilo directo a la finca.`,
    'Su finca queda con su propio perfil (historia, altura, lotes) y un enlace para mandar por WhatsApp. No cuesta nada.',
    `Se crea en cinco minutos desde el celular: ${url}`,
  ].join('\n');
}

// ---------- La cifra con su margen ----------
/** Intervalo de Wilson al 95 %: sirve con pocas respuestas y con proporciones cerca de 0. */
export function wilson(k, n, z = 1.96) {
  if (!(n > 0)) return { p: null, lo: null, hi: null };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}
/** Cuántas fincas al azar hacen falta para ±`margen` si la proporción ronda `p`. */
export const sampleSize = (p = 0.05, margen = 0.03, z = 1.96) => Math.ceil((z * z * p * (1 - p)) / (margen * margen));

/** Lo que dice la base, contado: total, por nivel (con margen), por departamento, venta e interés. */
export function summarize(rows = [], { soloMuestra = false } = {}) {
  const list = rows.filter((r) => Number.isInteger(r?.nivel) && r.nivel >= 0 && r.nivel <= 3 && (!soloMuestra || r.muestra === true));
  const n = list.length;
  const count = (f) => list.filter(f).length;
  const niveles = NIVELES.map((l) => ({ ...l, k: count((r) => r.nivel === l.id), ...wilson(count((r) => r.nivel === l.id), n) }));
  const cuenta = { k: count((r) => r.nivel >= 2), ...wilson(count((r) => r.nivel >= 2), n) };
  const web = { k: count((r) => r.nivel >= 3), ...wilson(count((r) => r.nivel >= 3), n) };
  const deptos = new Map();
  for (const r of list) {
    const d = r.departamento || 'Sin departamento';
    const x = deptos.get(d) ?? { departamento: d, n: 0, cuenta: 0 };
    x.n += 1;
    if (r.nivel >= 2) x.cuenta += 1;
    deptos.set(d, x);
  }
  const porDepto = [...deptos.values()].sort((a, b) => b.n - a.n || a.departamento.localeCompare(b.departamento, 'es'));
  const tally = (key, opts) => opts.map((o) => ({ ...o, k: count((r) => r[key] === o.id) }));
  const canales = CANALES.filter((c) => c.id !== 'ninguna').map((c) => ({ ...c, k: count((r) => Array.isArray(r.canales) && r.canales.includes(c.id)) })).sort((a, b) => b.k - a.k);
  return { n, niveles, cuenta, web, porDepto, venta: tally('venta', VENTAS), interes: tally('interes', INTERES), canales, meta: MUESTRA_META, faltan: Math.max(0, MUESTRA_META - n) };
}

/** La proporción llevada a las familias del país, con el mismo margen. */
export function aPais(x, base = BASE_FAMILIAS) {
  if (x?.p == null) return null;
  return { mid: Math.round(x.p * base), lo: Math.round(x.lo * base), hi: Math.round(x.hi * base) };
}
export const pct = (v) => (v == null ? '—' : `${(v * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`);

// ---------- La muestra al azar ----------
/** Una lista pegada (una finca por línea; «nombre, celular» o «nombre;celular») sin repetidas. */
export function parseLista(raw) {
  const seen = new Set();
  const out = [];
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const [nombre, ...rest] = line.split(/[;,\t]/).map((s) => s.trim());
    if (!nombre) continue;
    const digits = rest.join(' ').replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, '');
    const celular = /^3\d{9}$/.test(digits) ? `57${digits}` : null;
    const key = plain(nombre) + (celular ?? '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ nombre: nombre.slice(0, 80), celular });
  }
  return out;
}
// Azar con semilla: el mismo sorteo sale igual si se repite con la misma semilla (se puede auditar)
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seedOf = (s) => [...String(s ?? '')].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0), 2166136261);
/** Sortea `n` de la lista (Fisher-Yates con semilla). */
export function sortear(lista, n, semilla) {
  const a = [...lista];
  const rnd = mulberry32(seedOf(semilla));
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(a.length, n)));
}

// ---------- La oferta de Micra para las fincas ----------
/** Los textos de /micra/fincas; el equipo los puede cambiar en app_config `micra_fincas_oferta` sin publicar la app. */
export const OFERTA = {
  titulo: 'Tu finca en internet, con baristas que te compran',
  cifra: 'Solo 1 a 3 de cada 100 fincas cafeteras tienen su propia cuenta en redes. Las demás salen, si acaso, en la página de quien les compra.',
  precio: 'Gratis: Micra no cobra comisión. El barista te paga a ti.',
  beneficios: [
    { icon: '🏡', title: 'Tu perfil de finca', text: 'Historia, municipio, altura, hectáreas y tus lotes, en un enlace tuyo para mandar por WhatsApp.' },
    { icon: '☕', title: 'Baristas que te piden por kilo', text: 'Los baristas de la calle en Bogotá ven tu lote en Insumos y te piden por kilo para preparar.' },
    { icon: '🛍️', title: 'Tu café en la góndola', text: 'Los clientes de Micra ven tus bolsas y las piden con su barista o a domicilio.' },
    { icon: '✅', title: 'El sello «Probado por el equipo»', text: 'Probamos una muestra de tu lote y tu finca sale con el sello: así el barista confía.' },
  ],
  pasos: ['Crea tu finca en cinco pasos desde el celular.', 'Mándanos una muestra de tu lote.', 'Sales en Micra y los baristas te piden.'],
};
/** Lo que el equipo cargó en app_config, encima de lo de siempre; nada roto pasa. */
export function readOferta(raw) {
  let o;
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { o = null; }
  if (!o || typeof o !== 'object') return OFERTA;
  const benef = Array.isArray(o.beneficios)
    ? o.beneficios.map((b) => ({ icon: text(b?.icon, 4) || '•', title: text(b?.title, 60), text: text(b?.text, 200) })).filter((b) => b.title && b.text).slice(0, 6)
    : [];
  const pasos = Array.isArray(o.pasos) ? o.pasos.map((p) => text(p, 120)).filter(Boolean).slice(0, 5) : [];
  return {
    titulo: text(o.titulo, 80) || OFERTA.titulo,
    cifra: text(o.cifra, 240) || OFERTA.cifra,
    precio: text(o.precio, 160) || OFERTA.precio,
    beneficios: benef.length ? benef : OFERTA.beneficios,
    pasos: pasos.length ? pasos : OFERTA.pasos,
  };
}

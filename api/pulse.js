// Pulso del café (función serverless de Vercel, sin claves): los datos reales
// que pasan por las cintas de la página.
//
//   · Carga FNC → precio interno de referencia de la Federación Nacional de
//     Cafeteros (carga de 125 kg de pergamino seco), leído de su página.
//   · Bolsa NY  → contrato C de arábica (ICE), en centavos de dólar por libra.
//   · Dólar     → TRM certificada por la Superfinanciera (datos.gov.co).
//   · Bogotá    → clima de hoy (Open-Meteo).
//
// Cada fuente se lee por separado y con tiempo límite: si una falla, esa cifra
// no sale (nunca se inventa) y las demás sí. "status" dice qué pasó con cada
// una. La CDN de Vercel guarda la respuesta una hora, así que las fuentes se
// consultan unas pocas veces al día, no una vez por visita.

import { BOGOTA_LAT, BOGOTA_LON } from '../src/shared/lib/weather.js';

export const config = { maxDuration: 15 };

const TIMEOUT_MS = 6000;
const UA = 'Mozilla/5.0 (compatible; AceroPressPulse/1.0; +https://acero.press)';

// Páginas de la FNC que muestran el precio del día (la primera que se pueda
// leer con la fecha más reciente gana).
const FNC_PAGES = [
  'https://federaciondecafeteros.org/',
  'https://federaciondecafeteros.org/publicaciones/',
  'https://tolima.federaciondecafeteros.org/precio-delcafe/',
  'https://cauca.federaciondecafeteros.org/precio-delcafe/',
];

const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

async function get(url, as = 'json') {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: as === 'json' ? 'application/json' : 'text/html' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

const bogotaDate = (ms) => new Date(ms - 5 * 3600e3).toISOString().slice(0, 10);
const round = (n, d = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);
const within = (n, lo, hi) => (Number.isFinite(n) && n >= lo && n <= hi ? n : null);

// "2.160.000" → 2160000 · "305,60" → 305.6 · "3.238,88" / "3,238.88" → 3238.88
function num(s) {
  const t = String(s).trim();
  const i = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  if (i >= 0 && t.length - i - 1 <= 2) return Number(`${t.slice(0, i).replace(/[.,]/g, '')}.${t.slice(i + 1)}`);
  return Number(t.replace(/[.,]/g, ''));
}

function pageText(html) {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#0?36;|&dollar;/gi, '$')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ');
}

// Fecha publicada cerca del precio: 2026-10-16 · 16/10/2026 · 16 de octubre de 2026
function findDate(text) {
  let y, m, d;
  const iso = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  const dmy = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  const long = text.match(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de|del)?\s*(20\d{2})/i);
  const monthFirst = text.match(/\b([a-záéíóú]+)\s+(\d{1,2})\s*(?:de|del|,)?\s*(20\d{2})/i);
  const month = (w) => MONTHS[w?.toLowerCase()];
  if (iso) [, y, m, d] = iso;
  else if (dmy) [, d, m, y] = dmy;
  else if (long && month(long[2])) [d, m, y] = [long[1], month(long[2]), long[3]];
  else if (monthFirst && month(monthFirst[1])) [m, d, y] = [month(monthFirst[1]), monthFirst[2], monthFirst[3]];
  else return null;
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const age = (Date.now() - Date.parse(`${date}T12:00:00-05:00`)) / 864e5;
  return age > -1 && age < 45 ? date : null;
}

function parseFnc(html) {
  const text = pageText(html);
  // "Precio interno" puede salir también en el menú: se prueba cada aparición
  let at = -1;
  let value = null;
  for (const m of text.matchAll(/precio interno/gi)) {
    const price = text.slice(m.index, m.index + 700).match(/(?:\$|cop)?\s*(\d{1,2}[.,]\d{3}[.,]\d{3})\b/i);
    value = price && within(num(price[1]), 300000, 20000000);
    if (value) { at = m.index; break; }
  }
  if (!value) throw new Error('no se pudo leer el precio interno');
  const ny = text.match(/bolsa de (?:ny|nueva york|new york)\D{0,60}?(\d{2,3}[.,]\d{1,2})\b/i);
  const trm = text.match(/tasa de cambio\D{0,40}?(\d{1,2}[.,]\d{3}(?:[.,]\d{1,2})?)\b/i);
  return {
    value,
    date: findDate(text.slice(Math.max(0, at - 400), at + 1000)),
    ny: ny ? within(num(ny[1]), 50, 1000) : null,
    trm: trm ? within(num(trm[1]), 1500, 10000) : null,
  };
}

async function readFnc() {
  const pages = await Promise.allSettled(FNC_PAGES.map((url) => get(url, 'text').then(parseFnc)));
  const ok = pages.filter((p) => p.status === 'fulfilled').map((p) => p.value);
  if (!ok.length) throw new Error(pages[0].reason?.message || 'sin datos');
  return ok.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
}

async function readNy() {
  const j = await get('https://query1.finance.yahoo.com/v8/finance/chart/KC=F?range=10d&interval=1d');
  const r = j?.chart?.result?.[0];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  const pts = (r?.timestamp ?? []).map((t, i) => [t, closes[i]]).filter(([, c]) => Number.isFinite(c));
  if (!pts.length) throw new Error('sin cierres');
  const [t, value] = pts.at(-1);
  return { value: within(round(value), 50, 1000), prev: round(pts.at(-2)?.[1]), date: bogotaDate(t * 1000) };
}

async function readTrm() {
  const q = new URLSearchParams({
    $select: 'valor,vigenciadesde',
    $where: `vigenciadesde <= '${bogotaDate(Date.now())}T00:00:00'`,
    $order: 'vigenciadesde DESC',
    $limit: '2',
  });
  const rows = await get(`https://www.datos.gov.co/resource/32sa-8pi3.json?${String(q).replace(/\+/g, '%20')}`);
  const value = within(Number(rows?.[0]?.valor), 1500, 10000);
  if (!value) throw new Error('sin TRM');
  return { value: round(value), prev: round(Number(rows[1]?.valor)), date: rows[0].vigenciadesde.slice(0, 10) };
}

async function readBogota() {
  const q = new URLSearchParams({
    latitude: BOGOTA_LAT,
    longitude: BOGOTA_LON,
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'America/Bogota',
    forecast_days: '1',
  });
  const j = await get(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!Number.isFinite(j?.current?.temperature_2m)) throw new Error('sin clima');
  return {
    tempC: Math.round(j.current.temperature_2m),
    code: j.current.weather_code,
    max: Math.round(j.daily?.temperature_2m_max?.[0]),
    min: Math.round(j.daily?.temperature_2m_min?.[0]),
    rainProb: j.daily?.precipitation_probability_max?.[0] ?? null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const [fnc, ny, trm, bogota] = await Promise.allSettled([readFnc(), readNy(), readTrm(), readBogota()]);
  const val = (r) => (r.status === 'fulfilled' ? r.value : null);
  const f = val(fnc);

  // La página de la FNC también trae la bolsa y la tasa: sirven de respaldo
  const market = {
    fnc: f && { value: f.value, date: f.date },
    ny: val(ny)?.value ? val(ny) : f?.ny ? { value: f.ny, prev: null, date: f.date } : null,
    trm: val(trm) ?? (f?.trm ? { value: f.trm, prev: null, date: f.date } : null),
  };
  const status = Object.fromEntries(
    Object.entries({ fnc, ny, trm, bogota }).map(([k, r]) => [k, r.status === 'fulfilled' ? 'ok' : String(r.reason?.message || r.reason)]),
  );

  const complete = market.fnc && market.ny && market.trm && val(bogota);
  res.setHeader('Cache-Control', `public, s-maxage=${complete ? 3600 : 600}, stale-while-revalidate=86400`);
  return res.status(200).json({ updatedAt: new Date().toISOString(), market, bogota: val(bogota), status });
}

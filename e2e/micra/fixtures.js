// Supabase simulado para las pruebas de Micra: catálogo, inventario, ventas
// (la función atómica de la base o, con atomic:false, el camino de antes),
// publicaciones y subida de tarjetas. Cualquier otro Supabase queda bloqueado.

export const RECIPE = 'Dosis 18 g · Agua 220 ml · 92°C · 2:00. Invertida, remover 10 s, presionar 30 s.';

const coffees = (rows) => rows.map(([name, img, prices], i) => ({
  id: 'c' + i, slug: img, name, recipe_text: RECIPE, image_url: `/image/${img}.png`,
  product_variants: prices.map(([label, price]) => ({ id: `c${i}-${parseInt(label, 10)}`, label, price, active: true })),
}));
/** Castillo y Geisha, cada uno en 250 g y 500 g. */
export const TWO_COFFEES = coffees([['Castillo', 'castillo', [['250 g', 32000], ['500 g', 58000]]], ['Geisha', 'geisha', [['250 g', 45000], ['500 g', 80000]]]]);
/** Solo Castillo 250 g. */
export const ONE_COFFEE = coffees([['Castillo', 'castillo', [['250 g', 32000]]]]);
/** 3 de cada presentación, menos Geisha 500 g (agotada). */
export const DEFAULT_STOCK = (coffee) => coffee.flatMap((c) => c.product_variants.map((v) => ({ variant_id: v.id, stock_qty: v.id === 'c1-500' ? 0 : 3, low_stock_threshold: 2 })));

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
// Un estilo chico con capas que se llaman como las de Liberty (fondo, agua, una
// autopista y su borde), dibujadas desde GeoJSON: sin teselas ni fuentes
const TEST_STYLE = {
  version: 8,
  name: 'prueba',
  sources: {
    base: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-74.062, 4.64], [-74.045, 4.69]] } },
          { type: 'Feature', properties: { agua: true }, geometry: { type: 'Polygon', coordinates: [[[-74.07, 4.66], [-74.066, 4.66], [-74.066, 4.664], [-74.07, 4.66]]] } },
        ],
      },
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#efe9dc' } },
    { id: 'water', type: 'fill', source: 'base', filter: ['has', 'agua'], paint: { 'fill-color': '#9fc4e8' } },
    { id: 'road_motorway_casing', type: 'line', source: 'base', filter: ['!', ['has', 'agua']], paint: { 'line-color': '#e9ac77', 'line-width': 8 } },
    { id: 'road_motorway', type: 'line', source: 'base', filter: ['!', ['has', 'agua']], paint: { 'line-color': '#fc8', 'line-width': 5 } },
  ],
};
const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' };

export async function mockBackend(page, { coffee = TWO_COFFEES, inventory, atomic = true } = {}) {
  const calls = [];
  const opts = { slowPublish: false, dropNextSaleResponse: false, streetMap: null, piloto: null };
  const stock = new Map((inventory ?? DEFAULT_STOCK(coffee)).map((r) => [r.variant_id, { ...r }]));
  const priceOf = new Map(coffee.flatMap((c) => c.product_variants.map((v) => [v.id, v.price])));
  const orders = new Map();
  // Mi ruta: código de invitación vigente, el tintero enlazado, recorridos y puntos subidos
  const ruta = { code: 'ABC234', me: null, routes: [], points: [], summary: null, down: false };
  const byRef = new Map();
  let orderN = 0;

  // Como micra_record_sale / micra_void_sale (supabase/migrations/20261021120000_micra_atomic_sale.sql)
  const summary = (o, replay) => ({ order_id: o.id, total: o.total, status: o.status, replay, place: o.place ?? null, stock: [...o.net].map(([variant_id, applied]) => ({ variant_id, applied })) });
  const recordSale = ({ p_lines, p_client_ref, p_place = null }) => {
    if (p_client_ref && byRef.has(p_client_ref)) return summary(byRef.get(p_client_ref), true);
    const per = new Map();
    let total = 0;
    for (const l of p_lines) {
      total += priceOf.get(l.variant_id) * l.qty;
      per.set(l.variant_id, (per.get(l.variant_id) || 0) + l.qty);
    }
    const net = new Map();
    for (const [variantId, qty] of per) {
      const row = stock.get(variantId);
      if (!row) continue;
      const next = Math.min(row.stock_qty, Math.max(0, row.stock_qty - qty));
      net.set(variantId, next - row.stock_qty);
      row.stock_qty = next;
    }
    const o = { id: `order-${++orderN}`, total, status: 'completed', net, ref: p_client_ref, place: p_place };
    orders.set(o.id, o);
    if (p_client_ref) byRef.set(p_client_ref, o);
    return summary(o, false);
  };
  const voidSale = ({ p_order_id }) => {
    const o = orders.get(p_order_id);
    if (!o || o.status !== 'completed') return { order_id: p_order_id, already_voided: true, stock: [] };
    o.status = 'cancelled';
    const back = [];
    for (const [variantId, applied] of o.net) {
      if (!applied || !stock.has(variantId)) continue;
      stock.get(variantId).stock_qty -= applied;
      back.push({ variant_id: variantId, change: -applied });
    }
    o.net = new Map([...o.net].map(([v]) => [v, 0]));
    return { order_id: p_order_id, already_voided: false, stock: back };
  };

  await page.route(/supabase\.co/, (route) => route.abort());
  await page.route(/googletagmanager/, (route) => route.abort());
  // Clima fijo: 14 °C y lluvia ligera
  await page.route(/open-meteo/, (route) => route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 14, weather_code: 61 } }) }));
  await page.route('**/api/v1/pulse', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  // Teselas del mapa real (MapLibre): un estilo mínimo de OpenFreeMap y PNG de 1 px de OpenStreetMap.
  // opts.styleDown simula que OpenFreeMap no responde (el mapa cae a OpenStreetMap).
  await page.route('https://tiles.openfreemap.org/**', (route) => (opts.styleDown
    ? route.fulfill({ status: 503, headers: CORS, body: 'caído' })
    : route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(TEST_STYLE) })));
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: PIXEL }));
  // API de BI: el piloto (lo que la prueba ponga en opts.piloto; vacío por defecto)
  await page.route('**/api/v1/bi/piloto**', (route) => {
    if (!(route.request().headers().authorization || '').startsWith('Bearer ')) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Sin sesión' }) });
    const empty = { generatedAt: new Date().toISOString(), days: 90, week: { from: '2026-10-16', to: '2026-10-22', cur: { cups: 0, sales: 0, income: 0, blocks: 0, zones: [], kg: 0 }, prev: { cups: 0, sales: 0, income: 0, blocks: 0, zones: [], kg: 0 } }, sales: [], tinteros: [], study: { surveyed: 0, with_photo: 0, consented: 0, tinto_price_avg: null, cups_per_hour_avg: null, zones: [] } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.piloto ?? empty) });
  });
  // API de BI: la ficha de campo de un tintero (como POST /api/v1/bi/tinteros)
  const tinteros = [];
  await page.route('**/api/v1/bi/tinteros', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') {
      // Como la API: de la última encuesta, solo lo que puede salir en publicidad
      const latest = (id) => surveys.filter((s) => s.tintero_id === id).at(-1);
      const pub = (s) => (s ? { years_selling: s.years_selling ?? null, years_here: s.years_here ?? null, days_per_week: s.days_per_week ?? null, payments: s.payments ?? null } : null);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tinteros.map((t) => ({ survey: pub(latest(t.id)), ...t, days: [] }))) });
    }
    if (!(req.headers().authorization || '').startsWith('Bearer ')) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Sin sesión' }) });
    const body = req.postDataJSON();
    calls.push({ m: 'POST', p: '/api/v1/bi/tinteros', q: '', data: body });
    if ((body.carrera == null) !== (body.calle == null)) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: [{ msg: 'El lugar necesita carrera y calle.' }] }) });
    const row = { id: `tintero-${tinteros.length + 1}`, created_at: new Date().toISOString(), ...body };
    tinteros.push(row);
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row) });
  });
  // Cambiar una ficha (PATCH /api/v1/bi/tinteros/{id}): p. ej. el permiso de publicidad
  await page.route('**/api/v1/bi/tinteros/*', async (route) => {
    const req = route.request();
    if (req.method() !== 'PATCH') return route.fallback();
    const id = req.url().split('/').pop();
    const body = req.postDataJSON();
    calls.push({ m: 'PATCH', p: `/api/v1/bi/tinteros/${id}`, q: '', data: body });
    const row = tinteros.find((t) => t.id === id);
    if (!row) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'No existe ese tintero.' }) });
    Object.assign(row, body, 'ad_consent' in body ? { ad_consent_at: body.ad_consent ? new Date().toISOString() : null } : {});
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) });
  });
  // Encuesta (POST /api/v1/bi/tinteros/{id}/surveys) y escenario de la reunión (PUT /api/v1/bi/piloto/escenario).
  // opts.surveysDown simula que la migración de la encuesta aún no se aplicó.
  const surveys = [];
  const MISSING = { detail: 'Falta activar la encuesta y el escenario del piloto (migración 20261022140000_tintero_surveys).' };
  await page.route('**/api/v1/bi/tinteros/*/surveys', async (route) => {
    const req = route.request();
    if (!(req.headers().authorization || '').startsWith('Bearer ')) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Sin sesión' }) });
    const id = decodeURIComponent(new URL(req.url()).pathname.split('/').at(-2));
    const body = req.postDataJSON();
    calls.push({ m: 'POST', p: `/api/v1/bi/tinteros/${id}/surveys`, q: '', data: body });
    if (opts.surveysDown) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify(MISSING) });
    if (!body.consent) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: [{ msg: 'Value error, Sin permiso del tintero no se guarda la encuesta.' }] }) });
    const known = tinteros.some((t) => t.id === id) || (opts.piloto?.tinteros ?? []).some((t) => t.id === id);
    if (!known) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'No existe ese tintero.' }) });
    const row = { id: `encuesta-${surveys.length + 1}`, tintero_id: id, created_at: new Date().toISOString(), ...body };
    surveys.push(row);
    if (opts.piloto) opts.piloto = { ...opts.piloto, surveys: [row, ...(opts.piloto.surveys ?? [])] };
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row) });
  });
  await page.route('**/api/v1/bi/piloto/escenario', async (route) => {
    const req = route.request();
    if (!(req.headers().authorization || '').startsWith('Bearer ')) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Sin sesión' }) });
    const body = req.postDataJSON();
    calls.push({ m: req.method(), p: '/api/v1/bi/piloto/escenario', q: '', data: body });
    if (opts.surveysDown) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify(MISSING) });
    opts.scenario = body;
    if (opts.piloto) opts.piloto = { ...opts.piloto, scenario: body };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('https://mock.supabase.co/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const m = req.method();
    const single = (req.headers().accept || '').includes('vnd.pgrst.object');
    const json = (status, body) => route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) });
    if (m === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': '0-0/0' }, body: '' });
    let data = null;
    try { data = req.postDataJSON(); } catch { data = req.postData(); }
    if (m !== 'GET') calls.push({ m, p, q: u.search, data });

    // Mi ruta (supabase/migrations/20261023120000_tintero_routes.sql), en memoria
    const rpc = p.match(/\/rpc\/(tintero_\w+)$/)?.[1];
    if (rpc) {
      const r = ruta;
      const meOf = () => (r.me ? { ...r.me, open_route: r.routes.find((x) => !x.ended_at) ?? null } : null);
      const fail = (code, message) => json(400, { code, message, details: null, hint: null });
      if (r.down) return route.abort('failed');
      if (rpc === 'tintero_me') return json(200, meOf());
      if (rpc === 'tintero_claim') {
        if (String(data.p_code).toUpperCase() !== r.code) return fail('22023', 'Ese código no sirve o ya venció. Pídele uno nuevo al equipo de Micra.');
        r.me = { id: 'tintero-1', name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null };
        return json(200, meOf());
      }
      if (rpc === 'tintero_consent') { r.me.consent_at = data.p_accept ? new Date().toISOString() : null; if (!data.p_accept) r.routes.forEach((x) => { x.ended_at ??= new Date().toISOString(); }); return json(200, meOf()); }
      if (rpc === 'tintero_route_start') {
        if (!r.me?.consent_at) return fail('42501', 'Primero acepta compartir tu ubicación.');
        let row = r.routes.find((x) => x.client_ref === data.p_client_ref) ?? r.routes.find((x) => !x.ended_at);
        if (!row) { row = { id: `ruta-${r.routes.length + 1}`, client_ref: data.p_client_ref, started_at: data.p_started_at, ended_at: null, points_n: 0, distance_m: null, stops: null }; r.routes.push(row); }
        return json(200, row);
      }
      if (rpc === 'tintero_route_add_points') {
        const row = r.routes.find((x) => x.id === data.p_route_id);
        const seen = new Set(r.points.filter((x) => x.route === row.id).map((x) => x.t));
        const fresh = data.p_points.filter((x) => !seen.has(x.t));
        fresh.forEach((x) => r.points.push({ ...x, route: row.id }));
        row.points_n += fresh.length;
        return json(200, { accepted: fresh.length, sent: data.p_points.length, points_n: row.points_n });
      }
      if (rpc === 'tintero_route_end') {
        const row = r.routes.find((x) => x.id === data.p_route_id);
        if (!row.ended_at) Object.assign(row, { ended_at: data.p_ended_at, distance_m: Math.round(data.p_summary.distance_m), stops: data.p_summary.stops, path: data.p_summary.path });
        r.summary = data.p_summary;
        return json(200, { id: row.id, started_at: row.started_at, ended_at: row.ended_at, points_n: row.points_n, distance_m: row.distance_m, stops: (row.stops ?? []).length });
      }
      if (rpc === 'tintero_route_delete') { const n = r.routes.length; r.routes = r.routes.filter((x) => x.id !== data.p_route_id); return json(200, r.routes.length < n); }
      if (rpc === 'tintero_invite') { r.code = 'K7M2QX'; return json(200, { code: r.code, expires_at: new Date(Date.now() + 7 * 864e5).toISOString() }); }
    }
    if (p.endsWith('/tintero_routes') && m === 'GET') return json(200, ruta.routes.filter((x) => x.ended_at).sort((a, b) => b.started_at.localeCompare(a.started_at)));
    if (p.endsWith('/rpc/micra_street_map')) return json(200, opts.streetMap ?? { days: 90, sales: [], tinteros: [] });
    if (p.endsWith('/rpc/micra_record_sale') || p.endsWith('/rpc/micra_void_sale')) {
      if (!atomic) return json(404, { code: 'PGRST202', details: null, hint: null, message: `Could not find the function public.${p.split('/').pop()} in the schema cache` });
      if (p.endsWith('/rpc/micra_void_sale')) return json(200, voidSale(data));
      const result = recordSale(data);
      // Se guardó, pero la respuesta no llega (corte de red)
      if (opts.dropNextSaleResponse) { opts.dropNextSaleResponse = false; return route.abort('failed'); }
      return json(200, result);
    }
    if (p.includes('/storage/v1/object/marketing')) return json(200, { Key: 'marketing/x' });
    if (p.includes('/storage/v1/object/estudio/')) return json(200, { Key: p.split('/object/')[1] });
    // URL firmada del bucket privado (la pide la página del piloto con la sesión)
    if (p.includes('/storage/v1/object/sign/estudio/')) return json(200, { signedURL: `/object/sign/${p.split('/object/sign/')[1]}?token=firmado` });
    if (p.includes('/functions/v1/publish-content')) {
      if (opts.slowPublish) await new Promise((r) => setTimeout(r, 2500));
      return json(200, { ok: true, results: { instagram: { success: true, post_id: '1' } } });
    }

    let body = [];
    if (p.includes('/admin_users')) body = [{ id: 1, role: 'owner' }];
    else if (p.endsWith('/products')) body = ['eq.coffee_bag', null].includes(u.searchParams.get('category')) ? coffee : [];
    else if (p.endsWith('/inventory') && m === 'GET') {
      const eq = u.searchParams.get('variant_id');
      body = eq?.startsWith('eq.') ? [...stock.values()].filter((r) => r.variant_id === eq.slice(3)).map((r) => ({ stock_qty: r.stock_qty })) : [...stock.values()];
    } else if (p.endsWith('/inventory') && m === 'PATCH') {
      const row = stock.get(u.searchParams.get('variant_id')?.slice(3));
      if (row) row.stock_qty = data.stock_qty;
    } else if (p.endsWith('/orders') && m === 'POST') {
      const o = { id: `order-${++orderN}`, total: data.total, status: data.status, net: new Map() };
      orders.set(o.id, o);
      body = [{ id: o.id }];
    } else if (p.endsWith('/orders') && m === 'PATCH') {
      // Anular solo cambia un pedido que sigue completado (una vez)
      const o = orders.get(u.searchParams.get('id')?.slice(3));
      const guard = u.searchParams.get('status') === 'eq.completed';
      if (!o || (guard && o.status !== 'completed')) body = [];
      else { o.status = data.status; body = [{ id: o.id }]; }
    } else if (p.endsWith('/publications') && m === 'POST') body = [{ id: 'pub-1' }];
    if (single) body = Array.isArray(body) ? body[0] ?? null : body;
    return json(body === null ? 406 : 200, body ?? {});
  });

  return {
    calls,
    opts,
    orders,
    stock,
    tinteros,
    surveys,
    ruta,
    clear: () => { calls.length = 0; },
    find: (path, method) => calls.find((c) => c.p.endsWith(path) && (!method || c.m === method)),
    all: (path, method) => calls.filter((c) => c.p.endsWith(path) && (!method || c.m === method)),
  };
}

/**
 * Sesión de admin simulada. camera: 'none' | 'denied' reemplaza getUserMedia
 * (escritorio sin cámara / permiso bloqueado). prefs: preferencias de Micra al
 * cargar (null las borra).
 */
export async function signIn(page, { coach = false, camera, prefs } = {}) {
  await page.addInitScript(({ coach, camera, prefs }) => {
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, user: { id: 'u1' } }));
    localStorage.setItem('acero-press-lang', 'es');
    if (!localStorage.getItem('acero.consent')) localStorage.setItem('acero.consent', 'granted'); // sin aviso de cookies encima (e2e/home/analytics.spec.js lo prueba)
    if (coach) localStorage.setItem('micra_coach_v1', '1');
    if (prefs === null) localStorage.removeItem('micra_prefs_v1');
    else if (prefs) localStorage.setItem('micra_prefs_v1', JSON.stringify(prefs));
    if (camera && navigator.mediaDevices) {
      const name = camera === 'denied' ? 'NotAllowedError' : 'NotFoundError';
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('no'), { name }));
    }
  }, { coach, camera, prefs });
}

export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, permissions: ['camera', 'microphone'] };

/** Errores de la página (sin el ruido de red de los recursos bloqueados). */
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(msg.text())) errors.push('console: ' + msg.text());
  });
  return errors;
}

/** Un contexto con Supabase simulado y sesión iniciada. */
export async function openPage(browser, { context = PHONE, backend, session } = {}) {
  const ctx = await browser.newContext(context);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page, backend);
  await signIn(page, session);
  return { page, api, errors };
}

/** Inicio → panel flotante → Micra (cámara). */
export async function openMicraFromHome(page) {
  await page.goto('/', { waitUntil: 'load' });
  await page.click('.espresale-float');
  await page.click('.mh-dock .mh-app[aria-label="Micra"]');
  await page.waitForSelector('.mstudio.is-camera');
}

/** /admin → barra lateral → Micra. */
export async function openMicraFromAdmin(page) {
  await page.goto('/admin', { waitUntil: 'load' });
  await page.click('.ax-side .ax-item:has-text("Micra")');
  await page.waitForSelector('.mstudio.is-camera');
  await page.waitForTimeout(600);
}

/** Plano → «Usar»: el editor con la tarjeta en papel. */
export async function openEditorPlain(page) {
  await page.click('.mc-seg button:has-text("Plano")');
  await page.waitForSelector('.mc-shutter-ring b:has-text("Usar")');
  await page.waitForTimeout(400);
  await page.click('.mc-filter.on');
  await waitForCard(page);
}

export async function waitForCard(page) {
  await page.waitForSelector('.mstudio.is-edit');
  await page.waitForFunction(() => (document.querySelector('.mst-card')?.__layout || []).length > 3);
}

/** Ids de las piezas dibujadas en la tarjeta. */
export const layout = (page) => page.evaluate(() => (document.querySelector('.mst-card')?.__layout || []).map((b) => b.id));
/** Cuántas veces se ha dibujado la tarjeta (contador de desarrollo). */
export const draws = (page) => page.evaluate(() => window.__micraDraws || 0);
/** Centro en pantalla de una pieza de la tarjeta. */
export const center = (page, id) => page.evaluate((id) => {
  const c = document.querySelector('.mst-card');
  const b = c.__layout.find((x) => x.id === id);
  const r = c.getBoundingClientRect();
  return { x: r.left + ((b.x + b.w / 2) / c.width) * r.width, y: r.top + ((b.y + b.h / 2) / c.height) * r.height, r: { l: r.left, t: r.top, w: r.width, h: r.height } };
}, id);

/**
 * Graba un clip corto en la página (canvas → MediaRecorder) y lo suelta sobre
 * `selector`, como si se arrastrara un video desde el escritorio. `seconds`
 * manda cuando la prueba necesita que preparar el video tarde más que sus pasos.
 */
export const dropGeneratedClip = (page, selector, { seconds = 2.5 } = {}) => page.evaluate(async ([selector, ms]) => {
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 640;
  const g = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm;codecs=vp8' });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((r) => { rec.onstop = r; });
  rec.start(100);
  const t0 = performance.now();
  await new Promise((done) => {
    const tick = () => {
      const t = performance.now() - t0;
      g.fillStyle = `hsl(${Math.round(t / 8) % 360} 55% 45%)`;
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#fff';
      g.fillRect(Math.round(t / 6) % c.width, 300, 48, 48);
      if (t < ms) requestAnimationFrame(tick); else done();
    };
    tick();
  });
  rec.stop();
  await stopped;
  const dt = new DataTransfer();
  dt.items.add(new File(chunks, 'clip.webm', { type: 'video/webm' }));
  const el = document.querySelector(selector);
  el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
  el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
}, [selector, seconds * 1000]);

// El algoritmo de Celestra (12 nov 2026, pedido del usuario: «un modo offline que se base en un
// algoritmo… más visitas en redes, descargas, ventas de café y experiencias, con datos reales»).
// Escribe el parte del día SIN modelo: lee las mismas herramientas del servidor MCP, arma
// propuestas candidatas con reglas, les pone un peso y escoge 3 que no repitan meta.
// Puro: no toca la red; las lecturas llegan ya hechas (o guardadas, si no hay señal).
// Regla de siempre: nunca compara con menos de 3 y dice cuando un dato no existe.

import { TOOLS } from './tools.js';
import { PARTE_PROPUESTAS } from './celestra.js';

export const MIN_N = 3;
/** Lo que el algoritmo empuja. «datos» es medir lo que todavía no se mide. */
export const METAS = { ventas: 'Ventas', redes: 'Visitas en redes', descargas: 'Descargas', experiencias: 'Experiencias', datos: 'Datos del mercado' };
/** Publicaciones por semana que pide el plan de contenido (5 cortos + 1 carrusel). */
export const PLAN_SEMANA = 6;

const LECTURAS = { dia: 'dia_del_equipo', encuestas: 'encuestas_pendientes', apartados: 'apartados', mapa: 'mapa_en_vivo', precio: 'precio_cafe', fincas: 'fincas' };
const BEBIDA = { tinto: 'tinto', perico: 'perico', aromatica: 'aromática' };
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const plural = (n, one, many) => (Number(n) === 1 ? `1 ${one}` : `${n} ${many}`);
const dec = (n) => String(Math.round(Number(n) * 10) / 10).replace('.', ',');

/** Lee todo lo que el algoritmo usa. Lo que falle queda en null y en `faltan`. */
export async function leer(source, now = new Date()) {
  const keys = Object.keys(LECTURAS);
  const res = await Promise.allSettled(keys.map((k) => TOOLS.find((t) => t.name === LECTURAS[k]).run(source, {})));
  const out = { at: now.toISOString(), faltan: [] };
  keys.forEach((k, i) => {
    let v = res[i].status === 'fulfilled' ? res[i].value : null;
    if (k === 'apartados' && v && !v.notas && !v.tiempos) v = null; // esa herramienta no lanza: dice qué le faltó
    out[k] = v;
    if (v == null) out.faltan.push(k);
  });
  return out;
}

/** Una lectura sirve si trajo al menos una de las piezas. */
export const hayLectura = (l) => !!l && Object.keys(LECTURAS).some((k) => l[k] != null);

// La pieza del plan de contenido según el día (Receta del lunes, Campeón del miércoles, Viernes de calle)
const PIEZA = { 1: 'la Receta del lunes', 3: 'el Campeón del miércoles', 5: 'el Viernes de calle', 4: 'el carrusel de la semana' };
const weekday = (today) => new Date(`${today}T12:00:00Z`).getUTCDay();

/**
 * Las propuestas posibles de hoy, cada una con su meta y su peso (0–100).
 * l: leer(). redes: { posts, perWeek, reach } de 30 días o null (Instagram sin conectar).
 * tienda: { pedidos_7d, pedidos_30d, total_30d } o null.
 */
export function candidatas(l = {}, { today, redes = null, tienda = null } = {}) {
  const out = [];
  const add = (id, meta, oficio, peso, titulo, por_que, accion = null) => out.push({ id, meta, oficio, peso, titulo, por_que, accion });

  const dia = l.dia;
  const conCuenta = (dia?.baristas ?? []).filter((b) => b.enlazado);
  const enCalle = conCuenta.filter((b) => b.en_la_calle).length;
  const zonas = l.mapa?.zonas_con_demanda ?? [];
  const senales = zonas.reduce((a, z) => a + (Number(z.senales) || 0), 0);

  // Ventas: nadie o pocos en la calle
  if (dia && conCuenta.length >= 1 && enCalle === 0) {
    add('calle-nadie', 'ventas', 'calle', 90, 'Saca a la calle a quien falta',
      `Hoy salió 0 de ${plural(conCuenta.length, 'barista', 'baristas')} con cuenta: sin nadie en la calle no hay tazas ni apartados.`,
      'Escríbeles por WhatsApp temprano y diles en qué zona buscan café.');
  } else if (dia && conCuenta.length >= MIN_N && enCalle / conCuenta.length < 0.34) {
    add('calle-pocos', 'ventas', 'calle', 70, `Sube los baristas en la calle: van ${enCalle} de ${conCuenta.length}`,
      `Solo ${enCalle} de ${conCuenta.length} baristas con cuenta salió hoy.`, 'Un mensaje al grupo a esta hora suele sacar a más de uno.');
  }

  // Ventas: gente que busca café
  if (zonas.length > 0) {
    const drinks = {};
    for (const z of zonas) for (const [k, v] of Object.entries(z.bebidas ?? {})) drinks[k] = (drinks[k] ?? 0) + (Number(v) || 0);
    const top = Object.entries(drinks).filter(([k, v]) => BEBIDA[k] && v > 0).sort((a, b) => b[1] - a[1])[0];
    add('demanda', 'ventas', 'clientes', enCalle === 0 ? 85 : 60, 'Cubre la zona donde buscan café',
      `${plural(zonas.length, 'zona', 'zonas')} con ${senales} señales en ${l.mapa?.minutos ?? 45} min${top ? `; lo más pedido es ${BEBIDA[top[0]]}` : ''}.`,
      'Abre el mapa del equipo y manda al barista más cercano.');
  }

  // Ventas: apartados que esperan
  const esperando = Number(dia?.totales?.apartados_esperando) || 0;
  if (esperando > 0) {
    add('apartados-esperan', 'ventas', 'clientes', 80, `Atiende ${plural(esperando, 'apartado que espera', 'apartados que esperan')}`,
      `Hay ${plural(esperando, 'taza apartada', 'apartados')} sin entregar ahora mismo: cada uno es una venta ya pedida.`, 'Llama al barista que lo tiene y confirma la entrega.');
  }

  // Ventas: apartados lentos o que se pierden
  const t = l.apartados?.tiempos;
  if (t && Number(t.n) >= MIN_N && (Number(t.perdidos) + Number(t.cancelados)) / Number(t.n) >= 0.25) {
    add('apartados-perdidos', 'ventas', 'clientes', 70, 'Baja los apartados que se pierden',
      `${Number(t.perdidos) + Number(t.cancelados)} de ${t.n} apartados en ${t.dias} días se perdieron o se cancelaron.`, 'Mira el motivo que más se repite y háblalo con el barista.');
  } else if (t && Number(t.entregar_min?.n) >= MIN_N && Number(t.entregar_min.mediana) > 15) {
    add('apartados-lentos', 'ventas', 'clientes', 65, 'Acorta la entrega de los apartados',
      `Un apartado tarda ${dec(t.entregar_min.mediana)} min de mediana en entregarse (n=${t.entregar_min.n}).`, 'Pide que avisen «voy en camino» apenas lo vean.');
  }

  // Ventas: notas bajas y precio pagado
  for (const r of l.apartados?.notas ?? []) {
    if (Number(r.n) >= MIN_N && r.nota != null && Number(r.nota) < 3.5) {
      add(`nota-${r.nombre}`, 'ventas', 'clientes', 75, `Habla con ${r.nombre}: tiene ${dec(r.nota)} granos de 5`, `En ${r.n} entregas calificadas.`, 'Una visita o una llamada hoy.');
    }
    if (Number(r.pagado_n) >= MIN_N && Number(r.pide_taza) > 0 && Number(r.pagado_taza) >= Number(r.pide_taza) * 1.1) {
      add(`precio-${r.nombre}`, 'ventas', 'mercado', 55, `Sube el precio de ${r.nombre}: le pagan más de lo que pide`,
        `Mediana pagada ${money(r.pagado_taza)} por taza; pide ${money(r.pide_taza)} (n=${r.pagado_n}).`, 'Proponle probar el precio nuevo una semana.');
    }
  }

  // Ventas: hoy frente a la semana
  const semana = dia?.semana ?? [];
  if (semana.length >= 2) {
    const hoy = Number(semana.at(-1).tazas) || 0;
    const antes = semana.slice(0, -1).map((d) => Number(d.tazas) || 0).filter((n) => n > 0);
    if (antes.length >= MIN_N) {
      const avg = antes.reduce((a, n) => a + n, 0) / antes.length;
      if (hoy < avg * 0.6) {
        add('semana-baja', 'ventas', 'calle', 45, `Levanta el día: va en ${Math.round((hoy / avg) * 100)} % de un día promedio`,
          `${plural(hoy, 'taza', 'tazas')} hoy; el promedio de ${antes.length} días con ventas es ${Math.round(avg)}.`, 'Revisa quién falta por salir y a qué hora vendieron más ayer.');
      }
    }
  }

  // Ventas: la tienda
  if (tienda && Number(tienda.pedidos_7d) === 0) {
    add('tienda-quieta', 'ventas', 'mercado', 55, 'Mueve la tienda: 0 pedidos en 7 días',
      `${plural(Number(tienda.pedidos_30d) || 0, 'pedido', 'pedidos')} en 30 días${tienda.total_30d ? ` (${money(tienda.total_30d)})` : ''}.`,
      'Manda el café de esta semana por WhatsApp a tus clientes y súbelo a historias con el enlace.');
  }

  // Redes: la pieza de hoy del plan, y el precio del café como contenido
  const wd = today ? weekday(today) : null;
  const pieza = PIEZA[wd] ?? 'el corto de hoy';
  const sinRedes = !redes || Number(redes.posts) === 0;
  if (wd != null) {
    add('redes-plan', 'redes', 'mercado', sinRedes || Number(redes.perWeek) < PLAN_SEMANA / 2 ? 60 : 35, `Publica ${pieza}`,
      sinRedes
        ? `No hay publicaciones medidas en 30 días: el plan pide ${PLAN_SEMANA} por semana y sin publicar no hay visitas.`
        : `Van ${dec(redes.perWeek)} publicaciones por semana (el plan pide ${PLAN_SEMANA})${redes.reach ? `; alcance mediano ${Math.round(redes.reach)}` : ''}.`,
      'Ábrela en Redes › Crear: gancho, guion y texto ya salen armados.');
  }
  const fnc = l.precio?.carga_fnc_cop;
  if (fnc?.valor && fnc.cambio_pct != null && Math.abs(Number(fnc.cambio_pct)) >= 1) {
    add('redes-precio', 'redes', 'mercado', 50, `Cuenta que la carga de café ${fnc.cambio_pct > 0 ? 'subió' : 'bajó'} ${dec(Math.abs(fnc.cambio_pct))} %`,
      `La carga de la FNC está en ${money(fnc.valor)}, ${fnc.cambio_pct > 0 ? '+' : '−'}${dec(Math.abs(fnc.cambio_pct))} % frente al dato anterior: es noticia para quien vende y toma café.`,
      'Una historia con la cifra y qué significa para el tinto; también va en el muro Hoy.');
  }

  // Datos: lo que todavía no se mide
  if (sinRedes) {
    add('datos-instagram', 'datos', 'mercado', 58, 'Conecta Instagram para medir las visitas',
      'Instagram no tiene publicaciones sincronizadas: sin eso no se sabe qué formato ni qué hora trae más visitas.',
      'Panel › Instagram › conectar la cuenta; mientras tanto, el CSV de Meta Business Suite en Redes › Analizar.');
  }
  const enc = l.encuestas;
  if (enc && Number(enc.faltan) > 0) {
    const zona = enc.ir_primero?.[0];
    add('datos-encuestas', 'datos', 'estudio', Math.round(45 + 35 * (Number(enc.faltan) / Number(enc.meta || 25))), zona ? `Encuesta hoy en ${zona}` : 'Haz encuestas del estudio hoy',
      Number(enc.sin_encuesta) > 0
        ? `Van ${enc.encuestas} de ${enc.meta} encuestas y hay ${plural(enc.sin_encuesta, 'ficha', 'fichas')} sin encuesta. Sin ellas no hay qué decirle al mercado.`
        : `Van ${enc.encuestas} de ${enc.meta} encuestas y no quedan fichas sin encuesta: toca mapear puestos nuevos.`,
      Number(enc.sin_encuesta) > 0 ? 'Estudio › «Cerca de mí»: dos encuestas hoy.' : 'Ficha rápida: mapea dos puestos hoy y encuéstalos ahí mismo.');
  }
  const mu = l.fincas?.muestra_al_azar;
  if (mu && Number(mu.faltan) > 0 && Number(mu.n) < MIN_N) {
    add('datos-fincas', 'datos', 'fincas', 30, 'Manda la encuesta a las primeras fincas de la muestra',
      `La muestra al azar va en ${mu.n} de ${mu.meta} fincas: aún no hay cifra del país.`, 'Equipo › Hoy › Fincas: sortea y comparte los enlaces.');
  }

  // Descargas: todavía no se miden (la app no está en las tiendas); el QR del barista es la puerta
  add('descargas-qr', 'descargas', 'calle', enCalle > 0 ? 42 : 30, enCalle > 0 ? 'Pide a quien salió que muestre su QR' : 'Comparte el enlace de Micra en tus historias',
    enCalle > 0
      ? `${plural(enCalle, 'barista está', 'baristas están')} en la calle: cada QR escaneado es un cliente nuevo en Micra. Las descargas aún no se miden: la app no está en las tiendas.`
      : 'Las descargas aún no se miden: la app no está en las tiendas. Hoy la puerta es aceropress.com/micra.',
    enCalle > 0 ? 'Recuérdales «Mi QR» en Vender.' : 'Una historia con el enlace y la pantalla del radar.');

  // Experiencias: aún sin ventas registradas; el reto de la semana es lo que hay para mover
  add('experiencias-reto', 'experiencias', 'equipo', wd === 1 ? 48 : 28, 'Mueve el reto de la semana',
    'Las experiencias aún no tienen ventas registradas en Micra: el reto de Competencia es lo que hoy trae gente a participar.',
    'Equipo › Hoy › Competencia: revisa que haya un reto abierto y compártelo.');

  return out.sort((a, b) => b.peso - a.peso);
}

// Para reconocer la misma propuesta otro día aunque cambien las cifras
export const clave = (titulo) => String(titulo ?? '').toLowerCase().replace(/[\d.,%$]+/g, '').replace(/\s+/g, ' ').trim();

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * Escoge las 3 de hoy: lo descartado hace poco casi no vuelve, lo recién hecho descansa,
 * lo aprobado y sin hacer se recuerda, y no se repite meta mientras haya otra.
 */
export function elegir(cands = [], { today, decisions = [] } = {}) {
  const memoria = new Map();
  for (const d of decisions ?? []) {
    const k = clave(d?.titulo);
    if (k && !memoria.has(k)) memoria.set(k, d); // vienen de la más reciente a la más vieja
  }
  const scored = cands.map((c) => {
    const d = memoria.get(clave(c.titulo));
    const age = d?.dia && today ? daysBetween(String(d.dia).slice(0, 10), today) : null;
    let peso = c.peso;
    if (d?.estado === 'descartada' && (age == null || age <= 14)) peso *= 0.15;
    else if (d?.estado === 'hecha' && (age == null || age <= 2)) peso *= 0.4;
    else if (d?.estado === 'aprobada' && (age == null || age <= 7)) peso *= 1.15;
    return { ...c, peso };
  });
  const picked = [];
  const pool = [...scored];
  while (picked.length < PARTE_PROPUESTAS && pool.length) {
    const used = new Set(picked.map((p) => p.meta));
    pool.sort((a, b) => b.peso * (used.has(b.meta) ? 0.6 : 1) - a.peso * (used.has(a.meta) ? 0.6 : 1));
    picked.push(pool.shift());
  }
  return picked;
}

/** Dos o tres frases con lo de hoy; solo lo que sí se leyó. */
export function resumen(l = {}, { cached = false } = {}) {
  const parts = [];
  const tot = l.dia?.totales;
  if (tot) {
    const conCuenta = (l.dia.baristas ?? []).filter((b) => b.enlazado).length;
    parts.push(`Hoy van ${plural(tot.tazas, 'taza', 'tazas')} y ${tot.en_la_calle} de ${conCuenta || tot.baristas} baristas en la calle${tot.apartados_esperando ? `, con ${plural(tot.apartados_esperando, 'apartado', 'apartados')} esperando` : ''}.`);
  }
  if (l.encuestas) parts.push(`El estudio va en ${l.encuestas.encuestas} de ${l.encuestas.meta} encuestas.`);
  const fnc = l.precio?.carga_fnc_cop;
  if (fnc?.valor) parts.push(`La carga de café está en ${money(fnc.valor)}${fnc.cambio_pct != null ? ` (${fnc.cambio_pct > 0 ? '+' : '−'}${dec(Math.abs(fnc.cambio_pct))} %)` : ''}.`);
  if (!parts.length) parts.push('No se pudo leer Micra: estas propuestas salen del plan, sin cifras de hoy.');
  parts.push(cached ? 'Escrito por el algoritmo con la última lectura guardada.' : 'Escrito por el algoritmo, sin IA.');
  return parts.join(' ').slice(0, 400);
}

/** El parte del día con la misma forma que el de la IA: { resumen, propuestas: [{ oficio, titulo, por_que, accion }] }. */
export function parteAlgoritmo(l = {}, { today, decisions = [], redes = null, tienda = null, cached = false } = {}) {
  const picked = elegir(candidatas(l, { today, redes, tienda }), { today, decisions });
  return {
    resumen: resumen(l, { cached }),
    propuestas: picked.map((p) => ({ oficio: p.oficio, titulo: p.titulo.slice(0, 90), por_que: `${METAS[p.meta]}. ${p.por_que}`.slice(0, 260), accion: p.accion ? p.accion.slice(0, 220) : null })),
    metas: picked.map((p) => p.meta),
  };
}

/** Las cuatro preguntas de la tarjeta, respondidas con las lecturas (sin IA). null si no la conoce. */
export function responder(pregunta, l = {}) {
  const q = String(pregunta ?? '').toLowerCase();
  if (/c[oó]mo vamos/.test(q)) {
    if (!l.dia) return { answer: 'No pude leer el día del equipo.', tools: [] };
    const fuera = l.dia.baristas.filter((b) => b.enlazado && !b.en_la_calle).map((b) => b.nombre).filter(Boolean);
    return { answer: `${resumen({ dia: l.dia }).replace(/ Escrito.*$/, '')}${fuera.length ? ` No han salido: ${fuera.slice(0, 6).join(', ')}.` : ''}`, tools: ['dia_del_equipo'] };
  }
  if (/encuestar/.test(q)) {
    const e = l.encuestas;
    if (!e) return { answer: 'No pude leer el estudio.', tools: [] };
    const z = e.por_zona.filter((x) => x.sin_encuesta > 0).slice(0, 3).map((x) => `${x.zona} (${plural(x.sin_encuesta, 'ficha', 'fichas')} sin encuesta)`);
    return { answer: `Van ${e.encuestas} de ${e.meta} encuestas. ${z.length ? `Ve primero a ${z.join(', ')}.` : 'No quedan fichas sin encuesta: toca mapear puestos nuevos.'}`, tools: ['encuestas_pendientes'] };
  }
  if (/apartados/.test(q)) {
    const t = l.apartados?.tiempos;
    if (!t || !Number(t.n)) return { answer: 'Todavía no hay apartados suficientes para decir cómo les va.', tools: ['apartados'] };
    const tiempo = Number(t.entregar_min?.n) >= MIN_N ? ` La entrega tarda ${dec(t.entregar_min.mediana)} min de mediana (n=${t.entregar_min.n}).` : ' Con menos de 3 entregas aún no hay tiempo de entrega.';
    return { answer: `En ${t.dias} días: ${t.n} apartados, ${t.entregados} entregados, ${t.perdidos} perdidos y ${t.cancelados} cancelados.${tiempo}`, tools: ['apartados'] };
  }
  if (/precio/.test(q)) {
    const p = l.precio;
    if (!p?.carga_fnc_cop?.valor) return { answer: 'No pude leer el precio del café.', tools: [] };
    const ch = (x) => (x?.cambio_pct != null ? ` (${x.cambio_pct > 0 ? '+' : '−'}${dec(Math.abs(x.cambio_pct))} %)` : '');
    return { answer: `Carga FNC: ${money(p.carga_fnc_cop.valor)}${ch(p.carga_fnc_cop)}.${p.bolsa_ny_usc_lb?.valor ? ` Nueva York: ${dec(p.bolsa_ny_usc_lb.valor)} ¢/lb${ch(p.bolsa_ny_usc_lb)}.` : ''}${p.trm_cop?.valor ? ` Dólar: ${money(p.trm_cop.valor)}${ch(p.trm_cop)}.` : ''}`, tools: ['precio_cafe'] };
  }
  return null;
}

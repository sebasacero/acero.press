// Herramientas del servidor MCP de Micra (solo lectura).
//
// Lógica pura: cada herramienta recibe una «fuente» (de dónde salen los datos:
// la API de Acero y Supabase en producción, un JSON en pruebas) y devuelve un
// objeto ya recortado para el equipo. Nada escribe en la base y nada sale con
// nombres de tinteros del estudio, notas ni fotos: lo mismo que el informe.

import { buildReport, latestByTintero } from '../../src/features/admin/piloto/pilotReport.js';
import { aPais, summarize as fincasSummary } from '../../src/features/micra-app/presencia.js';

// Meta de Celestra para el estudio (plan nov–dic 2026): con 25 encuestas ya se compara en serio
export const SURVEY_GOAL = 25;
// Menos de esto no da proporción (la misma regla del informe)
const MIN_N = 5;

const obj = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

const firstName = (s) => String(s ?? '').trim().split(/\s+/)[0] || null;
const clamp = (n, lo, hi, dflt) => (Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Number(n))) : dflt);

// Comparación con el valor anterior en porcentaje, con un decimal
const change = (q) => (q && q.prev ? Math.round(((q.value - q.prev) / q.prev) * 1000) / 10 : null);

export const TOOLS = [
  {
    name: 'estudio_resumen',
    title: 'Estudio de calle: resumen',
    description:
      'Resumen del estudio de mercado del café de la calle en Bogotá: muestra (fichas, encuestas, zonas), precio del tinto, ' +
      'tazas al día, café que compran, ingreso del tinto, actitud frente al café de especialidad, tecnología y lo que falta ' +
      'para la reunión con el distribuidor. Cada cifra trae su n; con menos de 5 respuestas el grupo se oculta. Sin nombres.',
    inputSchema: obj({ dias: { type: 'integer', minimum: 7, maximum: 365, description: 'Ventana de ventas del piloto, en días (90 por defecto).' } }),
    async run(source, args = {}) {
      const days = clamp(args.dias, 7, 365, 90);
      const data = await source.piloto(days);
      const r = buildReport(data, data?.scenario);
      // Fuera: puntos uno a uno (price.dots) y el nombre del aliado (no se nombra antes del acuerdo)
      const { partner: _partner, ...scenario } = r.scenario;
      const { dots: _dots, ...price } = r.price;
      return { ...r, scenario, price };
    },
  },
  {
    name: 'mapa_en_vivo',
    title: 'Mapa en vivo',
    description:
      'Quién está vendiendo en la calle ahora (nombre de pila y punto de referencia), zonas donde la gente busca café ' +
      '(celdas de ~440 m con 2 señales o más, por bebida) y celdas donde suelen estar los puestos del estudio.',
    inputSchema: obj({ minutos: { type: 'integer', minimum: 15, maximum: 60, description: 'Qué tan atrás contar las señales (45 por defecto).' } }),
    async run(source, args = {}) {
      const m = await source.liveMap(clamp(args.minutos, 15, 60, 45));
      const demand = (m?.demand ?? []).map((d) => ({ lat: d.lat, lng: d.lng, senales: d.n, buscan: d.pings, apartados: d.holds, bebidas: d.drinks }));
      return {
        minutos: m?.minutes ?? null,
        baristas_en_linea: (m?.baristas ?? []).map((b) => ({ nombre: firstName(b.name), punto: b.referencia ?? null, hasta: b.live_until ?? null })),
        zonas_con_demanda: demand,
        personas_buscando: demand.reduce((a, d) => a + (d.buscan ?? 0), 0),
        celdas_del_estudio: (m?.study ?? []).map((c) => ({ lat: c.lat, lng: c.lng, puestos: c.n })),
      };
    },
  },
  {
    name: 'dia_del_equipo',
    title: 'El día del equipo',
    description:
      'El día de hoy en Micra: por barista (nombre de pila, localidad, tazas, plata, apartados que esperan y servidos, ' +
      'si está en la calle) y las tazas de los últimos 7 días. Úsala para «cómo vamos hoy» o «quién no ha salido».',
    inputSchema: obj(),
    async run(source) {
      const d = await source.ownerDay();
      const now = Date.now();
      const baristas = (d?.baristas ?? []).map((b) => ({
        nombre: firstName(b.name),
        localidad: b.localidad ?? null,
        etapa: b.stage ?? null,
        en_la_calle: !!(b.live_until && new Date(b.live_until).getTime() > now),
        enlazado: !!b.linked,
        tazas: b.cups ?? 0,
        plata: b.total ?? 0,
        fiado: b.fiado ?? 0,
        apartados_esperando: b.waiting ?? 0,
        apartados_servidos: b.served ?? 0,
      }));
      const sum = (k) => baristas.reduce((a, b) => a + (b[k] ?? 0), 0);
      return {
        dia: d?.day ?? null,
        totales: { baristas: baristas.length, en_la_calle: baristas.filter((b) => b.en_la_calle).length, tazas: sum('tazas'), plata: sum('plata'), apartados_esperando: sum('apartados_esperando') },
        baristas,
        semana: (d?.week ?? []).map((w) => ({ dia: w.day, tazas: w.cups ?? 0 })),
        clientes: d?.clients ?? null,
      };
    },
  },
  {
    name: 'precio_cafe',
    title: 'Precio del café',
    description:
      'Pulso del mercado: precio interno de la carga de café de la FNC (COP por 125 kg), contrato C en Nueva York ' +
      '(centavos de dólar por libra) y dólar (TRM), con el cambio frente al dato anterior, y el clima de Bogotá hoy.',
    inputSchema: obj(),
    async run(source) {
      const p = await source.pulse();
      const q = (x) => (x ? { valor: x.value, anterior: x.prev ?? null, cambio_pct: change(x), fecha: x.date ?? null } : null);
      return {
        actualizado: p?.updatedAt ?? null,
        carga_fnc_cop: q(p?.market?.fnc),
        bolsa_ny_usc_lb: q(p?.market?.ny),
        trm_cop: q(p?.market?.trm),
        bogota: p?.bogota ?? null,
        faltan: Object.entries(p?.status ?? {}).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k}: ${v}`),
      };
    },
  },
  {
    name: 'apartados',
    title: 'Apartados: notas, precio pagado y tiempos',
    description:
      'Cómo les va a los apartados de los clientes: por barista (nombre de pila), nota de 1 a 5 y precio pagado por taza ' +
      'frente al que pide (mediana, 30 días); y del total, cuántos se entregan, se pierden o se cancelan, cuánto tarda el ' +
      'barista en verlos y en entregarlos (mediana y peor 10 %) y por qué cancelan. Cada cifra trae su n.',
    inputSchema: obj({ dias: { type: 'integer', minimum: 1, maximum: 30, description: 'Ventana de los tiempos, en días (7 por defecto).' } }),
    async run(source, args = {}) {
      const days = clamp(args.dias, 1, 30, 7);
      const [ratings, times] = await Promise.allSettled([source.holdRatings(), source.holdTimes(days)]);
      const faltan = [];
      if (ratings.status === 'rejected') faltan.push(`notas: ${ratings.reason?.message ?? ratings.reason}`);
      if (times.status === 'rejected') faltan.push(`tiempos: ${times.reason?.message ?? times.reason}`);
      const t = times.status === 'fulfilled' ? times.value : null;
      return {
        notas: ratings.status === 'fulfilled'
          ? (ratings.value ?? []).map((r) => ({ nombre: firstName(r.name), n: r.n ?? 0, nota: r.avg == null ? null : Number(r.avg), pagado_n: r.paid_n ?? 0, pagado_taza: r.paid_cup ?? null, pide_taza: r.listed_cup ?? null }))
          : null,
        tiempos: t && {
          dias: t.days ?? days,
          n: t.n ?? 0,
          entregados: t.served ?? 0,
          perdidos: t.missed ?? 0,
          cancelados: t.cancelled ?? 0,
          esperando: t.waiting ?? 0,
          ver_min: { n: t.seen_n ?? 0, mediana: t.seen_p50 ?? null, peor_10: t.seen_p90 ?? null },
          entregar_min: { n: t.served_n ?? 0, mediana: t.served_p50 ?? null, peor_10: t.served_p90 ?? null },
          motivos_cancelar: { se_demoro: t.reasons?.tarde ?? 0, no_llego: t.reasons?.no_llego ?? 0, ya_no_quiero: t.reasons?.cambie ?? 0, otro: t.reasons?.otro ?? 0 },
        },
        faltan,
      };
    },
  },
  {
    name: 'fincas',
    title: 'Fincas en internet',
    description:
      'Estudio de las fincas cafeteras en internet (paso «Tu finca en internet» y /micra/fincas): cuántas respondieron, ' +
      'qué parte tiene cuenta propia o web (con intervalo de Wilson al 95 %), llevado a las ~540.000 familias cafeteras, ' +
      'por departamento, cómo venden y su interés. La muestra al azar va aparte de quien llegó solo. Sin nombres.',
    inputSchema: obj(),
    async run(source) {
      const rows = (await source.fincas()) ?? [];
      // Con menos de 5 respuestas no hay proporción ni cifra del país: solo el conteo
      const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
      const share = (x, n, pais = false) => (n < MIN_N
        ? { k: x.k, p: null, lo: null, hi: null, ...(pais ? { familias: null } : {}) }
        : { k: x.k, p: r3(x.p), lo: r3(x.lo), hi: r3(x.hi), ...(pais ? { familias: aPais(x) } : {}) });
      const pick = (sum) => ({ n: sum.n, con_cuenta: share(sum.cuenta, sum.n, true), con_web: share(sum.web, sum.n) });
      const todo = fincasSummary(rows);
      const muestra = fincasSummary(rows, { soloMuestra: true });
      return {
        muestra_al_azar: { ...pick(muestra), meta: muestra.meta, faltan: muestra.faltan },
        todas: pick(todo),
        por_departamento: todo.porDepto.slice(0, 8),
        venta: todo.venta.map((v) => ({ id: v.id, k: v.k })),
        interes: todo.interes.map((v) => ({ id: v.id, k: v.k })),
        nota: 'Quien llega solo a /micra/fincas ya está en internet: para la cifra del país vale la muestra al azar.',
      };
    },
  },
  {
    name: 'encuestas_pendientes',
    title: 'Encuestas pendientes del estudio',
    description:
      `Qué falta para llegar a ${SURVEY_GOAL} encuestas del estudio de calle: fichas, fichas con encuesta y sin encuesta ` +
      'por zona, y las zonas donde conviene ir primero (más puestos sin encuesta). Solo cuentas, sin nombres ni puntos.',
    inputSchema: obj(),
    async run(source) {
      const data = await source.piloto(90);
      const fichas = data?.tinteros ?? [];
      const latest = latestByTintero((data?.surveys ?? []).filter((s) => s?.consent !== false));
      const zonas = new Map();
      for (const t of fichas) {
        const z = t.zone || 'Sin zona';
        const x = zonas.get(z) ?? { zona: z, fichas: 0, con_encuesta: 0 };
        x.fichas += 1;
        if (latest.has(t.id)) x.con_encuesta += 1;
        zonas.set(z, x);
      }
      const porZona = [...zonas.values()].map((z) => ({ ...z, sin_encuesta: z.fichas - z.con_encuesta }))
        .sort((a, b) => b.sin_encuesta - a.sin_encuesta || a.zona.localeCompare(b.zona, 'es'));
      const hechas = porZona.reduce((a, z) => a + z.con_encuesta, 0);
      return {
        meta: SURVEY_GOAL,
        fichas: fichas.length,
        encuestas: hechas,
        faltan: Math.max(0, SURVEY_GOAL - hechas),
        sin_encuesta: fichas.length - hechas,
        por_zona: porZona,
        ir_primero: porZona.filter((z) => z.sin_encuesta > 0).slice(0, 3).map((z) => z.zona),
      };
    },
  },
];

export const toolByName = (name) => TOOLS.find((t) => t.name === name) ?? null;

/** Corre una herramienta y la deja lista para MCP: texto JSON + contenido estructurado. */
export async function callTool(source, name, args) {
  const tool = toolByName(name);
  if (!tool) return { isError: true, content: [{ type: 'text', text: `No existe la herramienta «${name}».` }] };
  try {
    const result = await tool.run(source, args ?? {});
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  } catch (err) {
    // El modelo lee el error y puede decirlo o probar otra herramienta
    return { isError: true, content: [{ type: 'text', text: `No se pudo leer «${name}»: ${err?.message ?? err}` }] };
  }
}

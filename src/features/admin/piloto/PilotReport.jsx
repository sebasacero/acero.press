import { useMemo, useRef, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import MapCanvas from '../../esspresale/MapCanvas.jsx';
import { heatFromSales, pinsFromTinteros } from '../../../shared/lib/streetMap.js';
import { GOALS, WEEKS_PER_MONTH, buildReport, scenarioFromForm, scenarioPayload, scenarioToForm } from './pilotReport.js';
import { Bars, Figure, PriceStrip } from './charts.jsx';
import { dateLong, dateShort, kg, money, moneyBig, nNote, num, pct, rangeOf } from './fmt.js';
import PilotDeck from './PilotDeck.jsx';
import './piloto.css';

// Informe del piloto: arriba (solo en pantalla) lo que falta para la reunión
// y los supuestos; abajo el documento que se imprime o se guarda en PDF, y el
// botón para presentarlo a pantalla completa. Todo sale de los datos reales
// de /api/v1/bi/piloto; lo que es supuesto lo dice.

const SCENARIO_LS = 'acero.piloto.escenario';
const readLocal = () => {
  try { return JSON.parse(localStorage.getItem(SCENARIO_LS) ?? 'null'); } catch { return null; }
};
const writeLocal = (v) => {
  try { localStorage.setItem(SCENARIO_LS, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
};

async function putScenario(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/v1/bi/piloto/escenario', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error(typeof data?.detail === 'string' ? data.detail : 'No se guardó el escenario.'), { status: res.status });
  }
}

/** Supuestos: los guardados en la base mandan; si no hay, los de este navegador. */
function useScenarioForm(data) {
  const [form, setForm] = useState(() => scenarioToForm(data?.scenario ?? readLocal() ?? {}));
  const [status, setStatus] = useState({ state: data?.scenario ? 'saved' : 'idle', message: null });
  const timer = useRef(0);
  const update = (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    writeLocal(scenarioPayload(scenarioFromForm(next)));
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus({ state: 'saving', message: null });
      try {
        await putScenario(scenarioPayload(scenarioFromForm(next)));
        setStatus({ state: 'saved', message: null });
      } catch (err) {
        setStatus({ state: err.status === 409 ? 'local' : 'error', message: err.message });
      }
    }, 800);
  };
  return { form, update, status };
}

/** El mapa ilustrado con los puntos reales (se imprime bien y no depende de la red). */
function studyView(data) {
  const blocks = new Map();
  for (const s of data.sales ?? []) {
    if (s.carrera == null || s.calle == null) continue;
    const key = `${Math.round(s.carrera)}|${Math.round(s.calle)}`;
    const b = blocks.get(key) ?? { carrera: Math.round(s.carrera), calle: Math.round(s.calle), cups: 0 };
    b.cups += s.cups;
    blocks.set(key, b);
  }
  const heatPoints = heatFromSales([...blocks.values()]);
  const pinPoints = pinsFromTinteros(data.tinteros);
  const all = [...blocks.values(), ...(data.tinteros ?? []).filter((t) => t.carrera != null)];
  const c = all.length ? all.reduce((n, r) => n + +r.carrera, 0) / all.length : 12;
  const k = all.length ? all.reduce((n, r) => n + +r.calle, 0) / all.length : 72;
  return { style: 'plano', c, k, ax: 0.5, ay: 0.5, s: 10, heat: 1, labels: 1.1, heatPoints, pinPoints, pins: pinPoints.length > 0, real: heatPoints.length + pinPoints.length > 0 };
}

function Readiness({ items }) {
  const done = items.filter((i) => i.done).length;
  return (
    <section className="rep-ready dash-sheet" aria-label="Listo para la reunión">
      <div className="esp-cota"><span>LISTO PARA LA REUNIÓN</span><span>{done} de {items.length}</span></div>
      <ul>
        {items.map((i) => (
          <li key={i.id} className={i.done ? 'is-done' : undefined}>
            <span className="rep-ready-mark" aria-hidden="true">{i.done ? '✓' : '○'}</span>
            <span className="rep-ready-label">{i.label}{i.hint ? <small> · {i.hint}</small> : null}</span>
            {'goal' in i && (
              <span className="rep-ready-bar" aria-label={`${i.have} de ${i.goal}`}>
                <i style={{ '--p': `${Math.min(100, (i.have / i.goal) * 100)}%` }} /><b>{i.have} de {i.goal}</b>
              </span>
            )}
          </li>
        ))}
      </ul>
      {done < items.length && <p className="rep-fine">Con 20 tinteros en 3 zonas las medianas ya se sostienen; con menos, el informe lo dice en cada cifra.</p>}
    </section>
  );
}

const FIELDS = [
  ['partner', 'Para quién es la propuesta', 'text', 'Nombre de la empresa'],
  ['specialtyPrice', 'Precio de la taza de especialidad', 'numeric', '$ por taza'],
  ['gramsPerCup', 'Gramos de café por taza', 'decimal', '18'],
  ['specialtyCupsPerDay', 'Tazas de especialidad al día, por tintero', 'decimal', '10'],
  ['pilotTinteros', 'Tinteros en el piloto', 'numeric', '10'],
  ['pilotWeeks', 'Semanas del piloto', 'numeric', '8'],
  ['kitCost', 'Costo del kit por tintero', 'numeric', '$ AeroPress, termo, filtros'],
  ['startCoffeeKg', 'Café inicial por tintero (kg)', 'decimal', '1'],
  ['distributorPriceKg', 'Precio de distribuidor por kilo', 'numeric', '$ lo que se negocia'],
];

function ScenarioPanel({ form, update, status, report }) {
  const t = report.tintero;
  const hints = {
    specialtyPrice: t.specialty.surveyStat.n ? `Vacío: la mediana de la encuesta, ${money(t.specialty.surveyStat.median)} (${nNote(t.specialty.surveyStat.n)}).` : 'Vacío hasta que la encuesta lo pregunte.',
    gramsPerCup: '18 g es la receta de la barra.',
    distributorPriceKg: t.ceilingKg.n ? `Lo que se negocia. El techo que dan los datos: ${money(t.ceilingKg.median)} por kilo.` : 'Lo que se negocia. Con encuestas, el informe calcula el techo.',
  };
  const say = {
    idle: 'Los supuestos se guardan solos.',
    saving: 'Guardando…',
    saved: 'Guardado.',
    local: 'Guardado solo en este navegador: falta activar la migración de encuestas.',
    error: `No se guardó: ${status.message}`,
  }[status.state];
  return (
    <section className="rep-scenario dash-sheet" aria-label="Supuestos del informe">
      <div className="esp-cota"><span>SUPUESTOS · SE CAMBIAN AQUÍ, EL INFORME SE ACTUALIZA</span><span className={status.state === 'error' ? 'is-err' : undefined} role="status">{say}</span></div>
      <div className="rep-scenario-grid">
        {FIELDS.map(([key, label, mode, placeholder]) => (
          <label key={key} className="rep-field">
            <span>{label}</span>
            <input className="rep-input" type="text" inputMode={mode === 'text' ? undefined : mode} autoComplete="off" placeholder={placeholder} value={form[key] ?? ''} onChange={(e) => update({ [key]: e.target.value })} />
            {hints[key] && <small>{hints[key]}</small>}
          </label>
        ))}
      </div>
      <p className="rep-fine">Son privados: viven en una tabla solo del equipo, no en la configuración pública del sitio.</p>
    </section>
  );
}

function Section({ n, title, children, lede }) {
  return (
    <section className="rep-sec" aria-labelledby={`rep-${n}`}>
      <div className="esp-cota"><span>FIG. {n}</span><span>{title.toUpperCase()}</span></div>
      <h2 id={`rep-${n}`} className="rep-h">{title}</h2>
      {lede && <p className="rep-lede">{lede}</p>}
      {children}
    </section>
  );
}

const sourceText = (src) => (src === 'escenario' ? 'supuesto' : src === 'encuesta' ? 'mediana de lo que dijeron' : 'falta el dato');

/** El documento: lo mismo que se imprime y que alimenta la presentación. */
export function ReportDoc({ report: r, data }) {
  const view = useMemo(() => studyView(data), [data]);
  const sp = r.tintero.specialty;
  const P = r.scenario.distributorPriceKg;
  const ceiling = r.tintero.ceilingKg.median;
  const zones = r.sample.zones.join(', ');
  return (
    <article className="rep-doc" aria-label="Informe del piloto">
      <header className="rep-cover">
        <div className="esp-cota"><span>INFORME DEL PILOTO · ESTUDIO DE CALLE</span><span>ACERO.PRESS · BOGOTÁ</span></div>
        <h1 className="rep-title">Café de especialidad en la calle, medido cuadra por cuadra.</h1>
        <p className="rep-lede">{r.scenario.partner ? `Propuesta de piloto para ${r.scenario.partner}.` : 'Propuesta de piloto.'} Datos al {dateLong(r.generatedAt)}.</p>
      </header>

      <Section n="01" title="Lo que vimos en la calle"
        lede={r.sample.surveyed
          ? `${r.sample.surveyed} ${r.sample.surveyed === 1 ? 'tintero encuestado' : 'tinteros encuestados'}${zones ? ` en ${zones}` : ''}. Entre todos compran ${kg(r.coffee.kgMonthTotal)} de café al mes y venden el tinto a ${money(r.price.median)}.`
          : 'Aún no hay encuestas: cada una que se hace en Micra llena este informe.'}>
        <div className="rep-figs">
          <Figure label="Tinteros encuestados" value={num(r.sample.surveyed)} foot={`de ${r.sample.total} registrados${zones ? ` · ${zones}` : ''}`} />
          <Figure label="Tinto, precio mediano" value={money(r.price.median)} foot={`observado en ${r.price.n} ${r.price.n === 1 ? 'puesto' : 'puestos'}${rangeOf(r.price) ? ` · ${rangeOf(r.price)}` : ''}`} />
          <Figure label="Café que compran al mes" value={kg(r.coffee.kgMonthTotal)} foot={`entre ${r.coffee.kgMonth.n} · declarado`} />
          <Figure label="Lo que gastan en café al mes" value={moneyBig(r.coffee.spendMonthTotal)} foot={`entre ${r.coffee.spendN} · declarado`} accent />
        </div>
      </Section>

      <Section n="02" title="El precio del tinto" lede="Observado en el puesto: un punto por tintero.">
        <PriceStrip price={r.price} />
        {r.price.byZone.length > 0 && (
          <table className="rep-table">
            <thead><tr><th scope="col">Zona</th><th scope="col">Puestos</th><th scope="col">Precio mediano</th></tr></thead>
            <tbody>{r.price.byZone.map((z) => <tr key={z.zone}><td>{z.zone}</td><td>{z.n}</td><td>{money(z.median)}</td></tr>)}</tbody>
          </table>
        )}
        <p className="rep-fine">Tazas por hora vistas en el puesto: {num(r.volume.cupsHourObserved.median, 1)} ({nNote(r.volume.cupsHourObserved.n)}). Tazas al día que dicen vender: {num(r.volume.cupsDay.median)} ({nNote(r.volume.cupsDay.n)}).</p>
      </Section>

      <Section n="03" title="Su café hoy" lede="Lo que compran, a cuánto y dónde. Es el mercado que ya existe en estas cuadras.">
        <div className="rep-figs">
          <Figure label="Café al mes por tintero" value={kg(r.coffee.kgMonth.median)} foot={`mediana · ${nNote(r.coffee.kgMonth.n)}${rangeOf(r.coffee.kgMonth, kg) ? ` · ${rangeOf(r.coffee.kgMonth, kg)}` : ''}`} />
          <Figure label="Precio por kilo que pagan" value={money(r.coffee.priceKg.median)} foot={`mediana · ${nNote(r.coffee.priceKg.n)} · la libra a ${money(r.coffee.priceKg.median !== null ? r.coffee.priceKg.median / 2 : null)}`} />
          <Figure label="Café por taza de tinto" value={money(r.coffee.costPerCup.median)} foot={`mediana · ${nNote(r.coffee.costPerCup.n)}`} />
          <Figure label="Tazas por kilo" value={num(r.coffee.cupsPerKg.median)} foot={`mediana · ${nNote(r.coffee.cupsPerKg.n)}`} />
        </div>
        <div className="rep-cols">
          <div><h3 className="rep-h3">Qué café usan</h3><Bars tally={r.coffee.brands} label="Marcas de café" /></div>
          <div><h3 className="rep-h3">Dónde lo compran</h3><Bars tally={r.coffee.where} label="Dónde compran el café" /></div>
        </div>
      </Section>

      <Section n="04" title="La cuenta del tintero" lede="Si no gana más, no hay negocio. Por taza, hoy con tinto y con una taza de especialidad.">
        <div className="rep-compare">
          <div>
            <h3 className="rep-h3">Tinto, hoy</h3>
            <dl className="rep-dl">
              <dt>Precio</dt><dd>{money(r.price.median)}</dd>
              <dt>Café por taza</dt><dd>{money(r.tintero.costPerCup.median)}</dd>
              <dt>Le queda por taza</dt><dd>{money(r.tintero.marginCup.median)}</dd>
              <dt>Ingreso al día</dt><dd>{money(r.tintero.incomeDay.median)} <small>{nNote(r.tintero.incomeDay.n)}</small></dd>
              <dt>Ingreso al mes</dt><dd>{moneyBig(r.tintero.incomeMonth.median)}</dd>
            </dl>
          </div>
          <div>
            <h3 className="rep-h3">Taza de especialidad</h3>
            <dl className="rep-dl">
              <dt>Precio</dt><dd>{money(sp.price)} <small>{sourceText(sp.source)}</small></dd>
              <dt>Café por taza</dt><dd>{sp.costCup !== null ? money(sp.costCup) : 'según el precio por kilo'} <small>{num(sp.grams)} g</small></dd>
              <dt>Le queda por taza</dt><dd>{money(sp.marginCup)}</dd>
              <dt>Extra al mes</dt><dd>{moneyBig(sp.extraMonth)} <small>{num(sp.cupsPerDay)} tazas × {num(sp.daysPerWeek)} días</small></dd>
            </dl>
          </div>
        </div>
        <div className="rep-ceiling">
          <Figure label="Precio techo del café de especialidad" value={ceiling !== null ? `${money(ceiling)} / kg` : '—'} accent
            foot={r.tintero.ceilingKg.n ? `Hasta este precio por kilo, cada taza de especialidad le deja al tintero al menos lo mismo que un tinto. Mediana de ${r.tintero.ceilingKg.n} tinteros.` : 'Se calcula con el precio del tinto, el café que usa cada tintero y el precio de la taza.'} />
          {r.tintero.notViable > 0 && <p className="rep-fine">En {r.tintero.notViable} {r.tintero.notViable === 1 ? 'puesto' : 'puestos'} el tinto ya deja más que la taza a ese precio: ahí no conviene.</p>}
        </div>
      </Section>

      <Section n="05" title="La cuenta del distribuidor">
        <div className="rep-cols">
          <div>
            <h3 className="rep-h3">El mercado que ya existe</h3>
            <div className="rep-figs is-2">
              <Figure label="Café que compran al mes" value={kg(r.distributor.measured.kgMonth)} foot={`${nNote(r.distributor.measured.n)} · declarado`} />
              <Figure label="Lo que pagan al mes" value={moneyBig(r.distributor.measured.spendMonth)} foot={`${nNote(r.distributor.measured.spendN)} · a otras marcas`} />
            </div>
          </div>
          <div>
            <h3 className="rep-h3">Con la taza de especialidad</h3>
            <div className="rep-figs is-2">
              <Figure label={`Piloto: ${r.scenario.pilotTinteros} tinteros`} value={`${kg(r.distributor.pilotKgMonth)} / mes`} foot={`${kg(r.distributor.kgMonthPerTintero)} por tintero`} />
              <Figure label={`En ${r.scenario.pilotWeeks} semanas`} value={kg(r.distributor.pilotKg)} foot={P !== null ? `${moneyBig(r.distributor.pilotSalesMonth)} al mes a ${money(P)}/kg` : 'ventas: según el precio por kilo'} accent />
            </div>
          </div>
        </div>
        <p className="rep-fine">Taza de especialidad: {num(sp.cupsPerDay)} tazas al día × {num(sp.grams)} g × {num(sp.daysPerWeek)} días a la semana ({sp.daysSource === 'encuesta' ? 'mediana de la encuesta' : 'supuesto'}) × {num(WEEKS_PER_MONTH, 2)} semanas al mes.</p>
      </Section>

      <Section n="06" title="Qué quieren y con qué cuentan">
        <div className="rep-cols">
          <div><h3 className="rep-h3">¿Vendería una taza de especialidad?</h3><Bars tally={r.attitude.wouldSell} label="Vendería especialidad" /></div>
          <div><h3 className="rep-h3">¿Le interesa un kit AeroPress?</h3><Bars tally={r.attitude.kitInterest} label="Interés en el kit" /></div>
          <div><h3 className="rep-h3">¿Cómo lo pagaría?</h3><Bars tally={r.attitude.kitPayment} label="Cómo pagaría el kit" /></div>
          <div><h3 className="rep-h3">¿Cómo le pagan hoy?</h3><Bars tally={r.tech.payments} label="Medios de pago" /></div>
          <div><h3 className="rep-h3">¿Tiene celular con datos?</h3><Bars tally={r.tech.smartphone} label="Celular con datos" /></div>
          <div><h3 className="rep-h3">Precio que le pondrían a la taza</h3><Figure label="Mediana" value={money(r.attitude.specialtyPrice.median)} foot={`${nNote(r.attitude.specialtyPrice.n)}${rangeOf(r.attitude.specialtyPrice) ? ` · ${rangeOf(r.attitude.specialtyPrice)}` : ''}`} /></div>
        </div>
      </Section>

      <Section n="07" title="Quiénes son" lede="Solo se muestran grupos de 5 personas o más, para que nadie se pueda reconocer.">
        <div className="rep-cols">
          <div><h3 className="rep-h3">Género</h3><Bars tally={r.people.gender} label="Género" /></div>
          <div><h3 className="rep-h3">Edad</h3><Bars tally={r.people.age} label="Edad" /></div>
          <div><h3 className="rep-h3">¿Es su ingreso principal?</h3><Bars tally={r.people.mainIncome} label="Ingreso principal" /></div>
          <div><h3 className="rep-h3">Hace cuánto vende tinto</h3><Bars tally={r.volume.years} label="Años vendiendo" /></div>
        </div>
      </Section>

      <Section n="08" title="Nuestro piloto en la calle" lede={`Lo que ACERO.press ha vendido con AeroPress en la calle, con la cuadra de cada taza (últimos ${r.pilot.days ?? 90} días).`}>
        <div className="rep-figs">
          <Figure label="Tazas vendidas" value={num(r.pilot.cups)} foot={`${r.pilot.sales} ventas · ${r.pilot.blocks} cuadras`} />
          <Figure label="Ingreso" value={moneyBig(r.pilot.income)} foot={`ticket promedio ${money(r.pilot.avgTicket)}`} />
          <Figure label="Esta semana" value={num(r.pilot.week?.cur?.cups)} foot={r.pilot.week?.growth !== null && r.pilot.week?.growth !== undefined ? `${pct(r.pilot.week.growth)} frente a la anterior` : 'sin semana anterior para comparar'} />
          <Figure label="Lista de espera de la app" value={num((r.pilot.waitlist?.cliente ?? 0) + (r.pilot.waitlist?.barista ?? 0))} foot={r.pilot.waitlist ? `${r.pilot.waitlist.cliente} quieren pedir · ${r.pilot.waitlist.barista} quieren ser baristas` : 'sin datos'} />
        </div>
        <div className="rep-map"><MapCanvas view={view} redrawKey={data} label="Mapa de Bogotá con el calor de las ventas en la calle y los tinteros" /></div>
        {!view.real && <p className="rep-muted">El mapa se llena con cada venta con lugar y cada tintero registrado.</p>}
      </Section>

      <Section n="09" title="El piloto y lo que pedimos">
        <ol className="rep-plan">
          <li><b>Semanas 1 y 2</b><span>{r.scenario.pilotTinteros} tinteros reciben el kit, aprenden la receta en la barra de ACERO.press y empiezan a registrar en Micra.</span></li>
          <li><b>Semanas 3 a {r.scenario.pilotWeeks}</b><span>Venden la taza de especialidad al lado del tinto. Cada taza queda con su cuadra y su hora; cada semana sale este informe.</span></li>
          <li><b>Al terminar</b><span>Con los datos se decide: seguir, crecer la red o ajustar precio y zonas.</span></li>
        </ol>
        <div className="rep-ask">
          <div>
            <h3 className="rep-h3">Precio de distribuidor</h3>
            <p>{P !== null
              ? `${money(P)} por kilo${ceiling !== null ? (P <= ceiling ? `, por debajo del techo de ${money(ceiling)}: la taza le deja al tintero más que un tinto.` : `, por encima del techo de ${money(ceiling)}: la taza le deja al tintero menos que un tinto.`) : '.'}`
              : ceiling !== null ? `Por acordar, por debajo del techo de ${money(ceiling)} por kilo que sale de los datos.` : 'Por acordar con lo que diga la encuesta.'}</p>
          </div>
          <div>
            <h3 className="rep-h3">Inversión del piloto</h3>
            <p>{r.distributor.investment.total !== null ? moneyBig(r.distributor.investment.total) : '—'}
              {r.distributor.investment.kits !== null && <small>{r.scenario.pilotTinteros} kits a {money(r.scenario.kitCost)}: {moneyBig(r.distributor.investment.kits)}</small>}
              {r.distributor.investment.coffee !== null && <small>Café inicial, {num(r.scenario.startCoffeeKg, 1)} kg por tintero: {moneyBig(r.distributor.investment.coffee)}</small>}
              {r.distributor.investment.missing.length > 0 && <small>Falta: {r.distributor.investment.missing.join(' y ')}</small>}
            </p>
          </div>
          <div>
            <h3 className="rep-h3">Lo que pone ACERO.press</h3>
            <p>Micra (venta, cuadra, encuesta e informe), la formación en la receta, la marca y el contenido para redes de cada puesto.</p>
          </div>
          <div>
            <h3 className="rep-h3">Lo que recibe el distribuidor</h3>
            <p>Volumen medido cuadra por cuadra, su café en la calle con una receta que lo luce, y datos de precio y demanda que hoy no tiene.</p>
          </div>
        </div>
      </Section>

      <Section n="10" title="Método y límites">
        <ul className="rep-method">
          <li>Encuestas del {dateShort(r.sample.first)} al {dateShort(r.sample.last)}: {r.sample.surveyed} tinteros de {r.sample.total} registrados; cada uno cuenta con su encuesta más reciente ({r.sample.visits} visitas en total).</li>
          <li>Todas con permiso de la persona: sin consentimiento la base no guarda la encuesta (ley 1581 de 2012). Nombres, teléfonos y fotos no salen en este informe.</li>
          <li>Observado: precio del tinto y tazas por hora, anotados en el puesto. Declarado: tazas al día, café que compran y su precio, lo que dijo cada tintero.</li>
          <li>Se reporta mediana y rango, cada cifra con su n. Con menos de 20 tinteros son señales, no promedios de la ciudad.</li>
          <li>La libra es de 500 g; un mes son {num(WEEKS_PER_MONTH, 2)} semanas. La ubicación es por cuadra, con una o dos cuadras de margen.</li>
          <li>Supuestos: taza de especialidad a {money(sp.price)} ({sourceText(sp.source)}), {num(sp.grams)} g por taza, {num(sp.cupsPerDay)} tazas al día, {r.scenario.pilotTinteros} tinteros, {r.scenario.pilotWeeks} semanas, kit a {money(r.scenario.kitCost)}, {num(r.scenario.startCoffeeKg, 1)} kg de café inicial, precio de distribuidor {P !== null ? `${money(P)}/kg` : 'por definir'}.</li>
          <li>Metas para estar listos: {GOALS.surveyed} tinteros encuestados en {GOALS.zones} zonas y {GOALS.cups} tazas vendidas con lugar.</li>
        </ul>
      </Section>
    </article>
  );
}

export default function PilotReport({ data }) {
  const { form, update, status } = useScenarioForm(data);
  const report = useMemo(() => buildReport(data, scenarioFromForm(form)), [data, form]);
  const [presenting, setPresenting] = useState(false);
  const missing = report.readiness.filter((i) => !i.done).length;

  const present = () => {
    setPresenting(true);
    // A pantalla completa si el navegador deja (en iPhone no: la presentación igual ocupa la ventana)
    try { document.documentElement.requestFullscreen?.()?.catch?.(() => {}); } catch { /* sin pantalla completa */ }
  };

  return (
    <div className="rep">
      <div className="rep-tools rep-screen-only">
        <Readiness items={report.readiness} />
        <ScenarioPanel form={form} update={update} status={status} report={report} />
        <div className="rep-actions">
          <button type="button" className="rep-btn is-primary" onClick={present}>Presentar</button>
          <button type="button" className="rep-btn" onClick={() => window.print()}>Imprimir o guardar PDF</button>
          {missing > 0 && <span className="rep-fine">Faltan {missing} de la lista para la reunión.</span>}
        </div>
      </div>
      <ReportDoc report={report} data={data} />
      {presenting && <PilotDeck report={report} data={data} onClose={() => setPresenting(false)} />}
    </div>
  );
}

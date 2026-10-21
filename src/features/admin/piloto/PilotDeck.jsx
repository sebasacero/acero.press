import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PilotoMap from '../pages/PilotoMap.jsx';
import { StreetPhone } from '../../esspresale/AppPhones.jsx';
import { mapLayers, summarize } from '../../../shared/lib/streetMap.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../../shared/layout/WhatsAppButton.jsx';
import { Bars, Figure } from './charts.jsx';
import { WEEKS_PER_MONTH } from './pilotReport.js';
import { dateLong, kg, money, moneyBig, nNote, num, rangeOf } from './fmt.js';

// La presentación de la reunión: el informe en diapositivas, a pantalla
// completa, con los datos vivos. Flechas, espacio o los botones para pasar;
// Esc para salir. Lo que ve el distribuidor no lleva nombres de tinteros.

const phoneNumber = (n) => `+${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;

function Slide({ fig, title, children, className = '' }) {
  return (
    <div className={`deck-slide ${className}`}>
      {fig && <div className="esp-cota deck-cota"><span>{fig}</span><span>ACERO.PRESS</span></div>}
      {title && <h2 className="deck-h">{title}</h2>}
      <div className="deck-body">{children}</div>
    </div>
  );
}

/** Los datos del piloto con la forma de micra_street_map (para el celular de la app). */
function streetLike(data) {
  const blocks = new Map();
  for (const s of data.sales ?? []) {
    if (s.carrera == null || s.calle == null) continue;
    const key = `${Math.round(s.carrera)}|${Math.round(s.calle)}`;
    const b = blocks.get(key) ?? { carrera: Math.round(s.carrera), calle: Math.round(s.calle), cups: 0, zone: s.zone };
    b.cups += s.cups;
    blocks.set(key, b);
  }
  const tinteros = (data.tinteros ?? []).filter((t) => t.carrera != null && t.stage !== 'salio')
    .map((t) => ({ carrera: t.carrera, calle: t.calle, stage: t.stage, cups_per_hour: t.cups_per_hour, zone: t.zone }));
  return { days: data.days ?? 90, sales: [...blocks.values()], tinteros };
}

export function buildSlides(r, data) {
  const sp = r.tintero.specialty;
  const P = r.scenario.distributorPriceKg;
  const ceiling = r.tintero.ceilingKg.median;
  const zones = r.sample.zones.join(', ');
  const street = streetLike(data);
  const layers = mapLayers(street);
  const quienes = [r.people.gender, r.people.age].some((t) => t.rows.length > 0);
  const slides = [
    { id: 'portada', render: () => (
      <Slide className="is-cover">
        <div className="esp-cota deck-cota"><span>PROPUESTA DE PILOTO · {dateLong(r.generatedAt).toUpperCase()}</span><span>BOGOTÁ</span></div>
        <h1 className="deck-title">Café de especialidad en la calle, medido cuadra por cuadra.</h1>
        <p className="deck-sub">{r.scenario.partner ? `Para ${r.scenario.partner} · ` : ''}ACERO.press</p>
      </Slide>
    ) },
    { id: 'calle', render: () => (
      <Slide fig="FIG. 01 — LO QUE VIMOS EN LA CALLE" title={r.sample.surveyed ? `${r.sample.surveyed} tinteros${zones ? ` en ${zones}` : ''}` : 'Lo que vimos en la calle'}>
        <div className="deck-figs">
          <Figure label="Tinto, precio mediano" value={money(r.price.median)} foot={`observado en ${r.price.n} puestos${rangeOf(r.price) ? ` · ${rangeOf(r.price)}` : ''}`} />
          <Figure label="Tazas al día por tintero" value={num(r.volume.cupsDay.median)} foot={`mediana · ${nNote(r.volume.cupsDay.n)} · declarado`} />
          <Figure label="Café que compran al mes" value={kg(r.coffee.kgMonthTotal)} foot={`entre ${r.coffee.kgMonth.n} tinteros · declarado`} accent />
        </div>
      </Slide>
    ) },
    { id: 'mapa', render: () => (
      <Slide fig="FIG. 02 — DÓNDE" title="El café ya se vende en estas cuadras">
        <div className="deck-map">
          <PilotoMap sales={data.sales} tinteros={data.tinteros} withNames={false} fallbackView={{ style: 'plano', c: 12, k: 75, ax: 0.5, ay: 0.5, s: 9 }} label="Mapa del estudio: calor de las tazas vendidas y tinteros" />
        </div>
        <p className="deck-fine">Calor: tazas que ACERO.press vendió en la calle. Pines: tinteros, con su etapa y las tazas por hora vistas.</p>
      </Slide>
    ) },
    { id: 'cafe', render: () => (
      <Slide fig="FIG. 03 — SU CAFÉ HOY" title={r.coffee.spendMonthTotal !== null ? `Gastan ${moneyBig(r.coffee.spendMonthTotal)} al mes en café` : 'Su café hoy'}>
        <div className="deck-cols">
          <div className="deck-figs is-col">
            <Figure label="Café al mes, entre todos" value={kg(r.coffee.kgMonthTotal)} foot={`${nNote(r.coffee.kgMonth.n)} · declarado`} />
            <Figure label="Precio por kilo que pagan" value={money(r.coffee.priceKg.median)} foot={`mediana · ${nNote(r.coffee.priceKg.n)}`} />
          </div>
          <div><h3 className="rep-h3">Qué café usan</h3><Bars tally={r.coffee.brands} label="Marcas de café" /></div>
        </div>
      </Slide>
    ) },
    { id: 'tintero', render: () => (
      <Slide fig="FIG. 04 — LA CUENTA DEL TINTERO" title="Si no gana más, no hay negocio">
        <div className="deck-cols">
          <dl className="rep-dl is-big">
            <dt>Tinto: le queda por taza</dt><dd>{money(r.tintero.marginCup.median)}</dd>
            <dt>Especialidad a {money(sp.price)}: le queda</dt><dd>{money(sp.marginCup)}</dd>
            <dt>Extra al mes con {num(sp.cupsPerDay)} tazas al día</dt><dd>{moneyBig(sp.extraMonth)}</dd>
          </dl>
          <Figure label="Precio techo del café de especialidad" value={ceiling !== null ? `${money(ceiling)} / kg` : '—'} accent
            foot={r.tintero.ceilingKg.n ? `Hasta ahí, cada taza le deja al tintero al menos lo mismo que un tinto (mediana de ${r.tintero.ceilingKg.n}).` : 'Sale de la encuesta: precio del tinto, café por taza y precio de la taza.'} />
        </div>
      </Slide>
    ) },
    { id: 'distribuidor', render: () => (
      <Slide fig="FIG. 05 — LA CUENTA DEL DISTRIBUIDOR" title="Volumen medido, no estimado">
        <div className="deck-figs">
          <Figure label="Hoy compran a otras marcas" value={`${kg(r.distributor.measured.kgMonth)} / mes`} foot={`${moneyBig(r.distributor.measured.spendMonth)} · ${nNote(r.distributor.measured.n)}`} />
          <Figure label={`Piloto con ${r.scenario.pilotTinteros} tinteros`} value={`${kg(r.distributor.pilotKgMonth)} / mes`} foot={`${num(sp.cupsPerDay)} tazas × ${num(sp.grams)} g × ${num(sp.daysPerWeek)} días × ${num(WEEKS_PER_MONTH, 2)} semanas`} />
          <Figure label={`En ${r.scenario.pilotWeeks} semanas`} value={kg(r.distributor.pilotKg)} foot={P !== null ? `${moneyBig(r.distributor.pilotSalesMonth)} al mes a ${money(P)}/kg` : 'ventas según el precio que acordemos'} accent />
        </div>
      </Slide>
    ) },
    { id: 'micra', render: () => (
      <Slide fig="FIG. 06 — CÓMO LO MEDIMOS" title="Cada taza deja un dato">
        <div className="deck-cols is-phone">
          <StreetPhone className="deck-phone" street={summarize(street)} layers={layers.real ? layers : null} />
          <ul className="deck-list">
            <li><b>Micra registra cada venta</b> con su cuadra y su hora, desde el celular.</li>
            <li><b>Ficha y encuesta de cada tintero</b>, con su permiso: precio, café, volumen.</li>
            <li><b>Mapa de calor</b> de dónde se vende y dónde están los puestos.</li>
            <li><b>Este informe cada semana</b>, para decidir con datos y no con intuición.</li>
          </ul>
        </div>
      </Slide>
    ) },
    { id: 'quieren', render: () => (
      <Slide fig="FIG. 07 — QUÉ QUIEREN Y QUIÉNES SON" title="Lo que dicen los tinteros">
        <div className="deck-cols">
          <div><h3 className="rep-h3">¿Vendería una taza de especialidad?</h3><Bars tally={r.attitude.wouldSell} label="Vendería especialidad" /></div>
          <div><h3 className="rep-h3">¿Le interesa un kit AeroPress?</h3><Bars tally={r.attitude.kitInterest} label="Interés en el kit" /></div>
          {quienes && <div><h3 className="rep-h3">Género</h3><Bars tally={r.people.gender} label="Género" /></div>}
          {quienes && <div><h3 className="rep-h3">Edad</h3><Bars tally={r.people.age} label="Edad" /></div>}
        </div>
        <p className="deck-fine">Solo grupos de 5 personas o más; nombres y fotos no salen de Micra.</p>
      </Slide>
    ) },
    { id: 'plan', render: () => (
      <Slide fig={`FIG. 08 — EL PILOTO: ${r.scenario.pilotWeeks} SEMANAS`} title={`${r.scenario.pilotTinteros} tinteros, ${r.scenario.pilotWeeks} semanas, todo medido`}>
        <ol className="rep-plan is-deck">
          <li><b>Semanas 1 y 2</b><span>Kit, receta en la barra de ACERO.press y Micra en el celular.</span></li>
          <li><b>Semanas 3 a {r.scenario.pilotWeeks}</b><span>Taza de especialidad al lado del tinto; informe cada semana.</span></li>
          <li><b>Al final</b><span>Seguir, crecer la red o ajustar precio y zonas, con datos.</span></li>
        </ol>
        <div className="deck-figs">
          <Figure label="Meta por tintero" value={`${num(sp.cupsPerDay)} tazas / día`} />
          <Figure label="Café del piloto" value={`${kg(r.distributor.pilotKgMonth)} / mes`} />
          <Figure label="Extra para el tintero" value={sp.extraMonth !== null ? `${moneyBig(sp.extraMonth)} / mes` : '—'} />
        </div>
      </Slide>
    ) },
    { id: 'pedimos', render: () => (
      <Slide fig="FIG. 09 — LO QUE PEDIMOS" title="Lo que proponemos">
        <div className="deck-ask-figs">
          <Figure label="Precio de distribuidor" value={P !== null ? `${money(P)} / kg` : 'Por acordar'}
            foot={ceiling !== null ? `Techo que dan los datos: ${money(ceiling)} por kilo.${P !== null ? (P <= ceiling ? ' Por debajo: la taza le deja al tintero más que un tinto.' : ' Por encima: la taza le deja menos que un tinto.') : ''}` : 'Se define con el techo que sale de la encuesta.'} />
          <Figure label={`Inversión del piloto · ${r.scenario.pilotTinteros} tinteros`} value={moneyBig(r.distributor.investment.total)} accent
            foot={[r.distributor.investment.kits !== null && `Kits: ${moneyBig(r.distributor.investment.kits)}`, r.distributor.investment.coffee !== null && `café inicial: ${moneyBig(r.distributor.investment.coffee)}`, r.distributor.investment.missing.length > 0 && `falta ${r.distributor.investment.missing.join(' y ')}`].filter(Boolean).join(' · ')} />
        </div>
        <div className="rep-ask is-deck">
          <div><h3 className="rep-h3">Lo que pone ACERO.press</h3><p>La tecnología, la formación en la receta, la marca y el contenido de cada puesto.</p></div>
          <div><h3 className="rep-h3">Lo que recibe el distribuidor</h3><p>Volumen medido cuadra por cuadra, su café en la calle y datos que hoy no tiene.</p></div>
        </div>
      </Slide>
    ) },
    { id: 'gracias', render: () => (
      <Slide className="is-cover">
        <div className="esp-cota deck-cota"><span>GRACIAS</span><span>ACERO.PRESS</span></div>
        <h1 className="deck-title">Hablemos del piloto.</h1>
        <p className="deck-sub">WhatsApp {phoneNumber(FALLBACK_WHATSAPP_NUMBER)} · www.aceropress.com</p>
      </Slide>
    ) },
  ];
  return slides;
}

export default function PilotDeck({ report, data, onClose }) {
  const slides = useMemo(() => buildSlides(report, data), [report, data]);
  const [i, setI] = useState(0);
  const ref = useRef(null);
  const swipe = useRef(null);
  const go = useCallback((d) => setI((n) => Math.min(slides.length - 1, Math.max(0, n + d))), [slides.length]);
  const close = useCallback(() => {
    try { if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {}); } catch { /* nada */ }
    onClose();
  }, [onClose]);

  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(slides.length - 1);
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    // Salir de pantalla completa con la tecla del navegador también cierra la presentación
    const onFs = () => { if (!document.fullscreenElement) onClose(); };
    const fsArmed = setTimeout(() => document.addEventListener('fullscreenchange', onFs), 400);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(fsArmed);
      document.removeEventListener('fullscreenchange', onFs);
      document.body.style.overflow = '';
      if (prev && document.contains(prev)) prev.focus?.();
    };
  }, [go, close, onClose, slides.length]);

  const slide = slides[i];
  return createPortal(
    <div
      ref={ref}
      className="deck"
      role="dialog"
      aria-modal="true"
      aria-label="Presentación del piloto"
      tabIndex={-1}
      onPointerDown={(e) => { if (!e.target.closest('.piloto-geo')) swipe.current = e.clientX; }}
      onPointerUp={(e) => {
        const x0 = swipe.current;
        swipe.current = null;
        if (x0 === null || x0 === undefined) return;
        const dx = e.clientX - x0;
        if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
      }}
    >
      <section className="deck-stage" aria-roledescription="diapositiva" aria-label={`${i + 1} de ${slides.length}`} key={slide.id}>
        {slide.render()}
      </section>
      <nav className="deck-nav" aria-label="Diapositivas">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Anterior">←</button>
        <span className="deck-count" aria-live="polite">{i + 1} / {slides.length}</span>
        <button type="button" onClick={() => go(1)} disabled={i === slides.length - 1} aria-label="Siguiente">→</button>
        <button type="button" className="deck-x" onClick={close} aria-label="Salir de la presentación">Salir</button>
      </nav>
      <div className="deck-progress" aria-hidden="true"><i style={{ '--p': `${((i + 1) / slides.length) * 100}%` }} /></div>
    </div>,
    document.body,
  );
}

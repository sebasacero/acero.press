import { useEffect, useState } from 'react';
import { Segs, useClock } from './parts.jsx';

// Pantallas de la app Micra dentro de un celular, para el banner. En el
// celular el banner muestra la pantalla a sangre, como si fuera la app (ver
// esspresale.css). Los textos de la app van en español: abre primero en Bogotá.
//
// La app piensa en micras, como los molinos profesionales:
// - Dial de la EK Omnia: anillo de escala y pantalla al centro con la
//   distancia real entre muelas en µm (no un número de dial arbitrario).
// - Clics de los molinos de mano (Comandante C40 ≈ 30 µm/clic,
//   Kingrinder K6 ≈ 16 µm/clic, 1Zpresso JX-Pro ≈ 12,5 µm/clic): la receta en
//   micras se traduce al molino de cada quien.
// - Distribución de partículas de los analizadores (DiFluid Omni) y los
//   tamices (Kruve): curva con su D50 y la ventana de la receta.

// Escala del dial: 200–1400 µm en un arco de 270° (de espresso a prensa).
const MIN = 200;
const MAX = 1400;
const START = -135;
const SWEEP = 270;
const angle = (um) => START + ((Math.min(MAX, Math.max(MIN, um)) - MIN) / (MAX - MIN)) * SWEEP;
const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
};
const arc = (r, from, to) => {
  const [x0, y0] = polar(r, angle(from));
  const [x1, y1] = polar(r, angle(to));
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${angle(to) - angle(from) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

const TICKS = Array.from({ length: (MAX - MIN) / 25 + 1 }, (_, i) => MIN + i * 25);
const KNURL = Array.from({ length: 120 }, (_, i) => i * 3);
// Rangos de cada método sobre la escala (gris) y el de AeroPress (rojo suave).
const METHODS = [
  { from: 200, to: 350 },
  { from: 450, to: 600 },
  { from: 600, to: 1000, aero: true },
  { from: 1050, to: 1400 },
];

// Receta campeona de la barra y la lectura del barista que está calibrando.
const RECIPE = { um: 850, tol: 25 };
const BARISTA_READ = 912;

// Molinos de mano: micras por clic (aprox., según fabricantes y reseñas).
const GRINDERS = [
  { id: 'C40', step: 30 }, // Comandante C40
  { id: 'K6', step: 16 }, // Kingrinder K6
  { id: 'JX', step: 12.5 }, // 1Zpresso JX-Pro
];
const clicks = (um, step) => Math.round(um / step);

function StatusBar() {
  const { time } = useClock();
  return (
    <div className="essp-phone-status">
      <span>{time}</span>
      <span>5G ▮▮▮</span>
    </div>
  );
}

function AppBar({ zone }) {
  return (
    <div className="essp-phone-appbar">
      <b className="essp-micra">micra<i>.</i></b>
      <span>{zone}</span>
    </div>
  );
}

/** Dial de micras: bisel moleteado, escala, ventana de la receta y pantalla al centro. */
function MicronDial({ value, target = RECIPE.um, tol = RECIPE.tol, caption }) {
  // La aguja barre desde el cero hasta la lectura al montar, como un molino al encender.
  const [shown, setShown] = useState(MIN);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const delta = value - target;
  const onTarget = Math.abs(delta) <= tol;
  const [lx, ly] = polar(80, angle(target));

  return (
    <div className="essp-dial">
      <svg viewBox="0 0 200 200">
        {KNURL.map((deg) => {
          const [x0, y0] = polar(93, deg);
          const [x1, y1] = polar(99, deg);
          return <line key={deg} x1={x0} y1={y0} x2={x1} y2={y1} className="essp-dial-knurl" />;
        })}
        <circle cx="100" cy="100" r="89" className="essp-dial-face" />

        {METHODS.map((m) => (
          <path key={m.from} d={arc(64, m.from, m.to)} className={`essp-dial-band${m.aero ? ' is-aero' : ''}`} />
        ))}
        <path d={arc(71, target - tol, target + tol)} className="essp-dial-window" />

        {TICKS.map((um) => {
          const major = um % 200 === 0;
          const mid = um % 100 === 0;
          const [x0, y0] = polar(major ? 74 : mid ? 77 : 79, angle(um));
          const [x1, y1] = polar(84, angle(um));
          return <line key={um} x1={x0} y1={y0} x2={x1} y2={y1} className={`essp-dial-tick${major ? ' is-major' : ''}`} />;
        })}
        {TICKS.filter((um) => um % 200 === 0).map((um) => {
          const [x, y] = polar(53, angle(um));
          return <text key={um} x={x} y={y + 2.4} className="essp-dial-num">{um}</text>;
        })}
        <circle cx={lx} cy={ly} r="1.6" className="essp-dial-mark" />

        <g className="essp-dial-needle" style={{ transform: `rotate(${angle(shown)}deg)` }}>
          <line x1="100" y1="58" x2="100" y2="18" />
          <path d="M100 13 L104.5 22 L95.5 22 Z" />
        </g>

        <circle cx="100" cy="100" r="40" className="essp-dial-screen" />
        <text x="100" y="80" className="essp-dial-cap">{caption}</text>
        <text x="100" y="106" className="essp-dial-val">{value}</text>
        <text x="100" y="117" className="essp-dial-unit">µm · MUELAS</text>
        <rect x="78" y="122" width="44" height="11" rx="5.5" className={`essp-dial-chip${onTarget ? '' : ' is-off'}`} />
        <text x="100" y="130" className="essp-dial-chip-t">
          {onTarget ? `±${tol} µm` : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} µm`}
        </text>
      </svg>
    </div>
  );
}

/** La receta en clics del molino de mano de cada quien; con `delta`, cuántos clics cerrar (−) o abrir (+). */
function ClickRow({ um, active = 'C40', delta }) {
  return (
    <div className="essp-clicks">
      {GRINDERS.map((g) => (
        <div key={g.id} className={g.id === active ? 'is-on' : undefined}>
          <span>{g.id} · {String(g.step).replace('.', ',')} µm</span>
          <b>
            {delta ? `${delta > 0 ? '−' : '+'}${Math.round(Math.abs(delta) / g.step)}` : clicks(um, g.step)}
            <small>clics</small>
          </b>
        </div>
      ))}
    </div>
  );
}

// Distribución de partículas (100–1600 µm en tramos de 50): pico en la receta
// y la joroba de finos cerca de 150 µm que muestran los analizadores.
const BINS = Array.from({ length: 30 }, (_, i) => 100 + i * 50);
function psd(d50) {
  const raw = BINS.map((x) => {
    const main = Math.exp(-((Math.log(x) - Math.log(d50)) ** 2) / (2 * 0.24 ** 2));
    const fines = 0.24 * Math.exp(-((x - 150) ** 2) / (2 * 55 ** 2));
    return main + fines;
  });
  const top = Math.max(...raw);
  return raw.map((v) => v / top);
}

function Distribution({ fig, d50 = RECIPE.um }) {
  const vals = psd(d50);
  const w = 232 / BINS.length;
  const x = (um) => ((um - 100) / 1500) * 232;
  return (
    <div className="essp-psd">
      <div className="essp-phone-cota"><span>{fig}</span><span>D50 {d50} µm</span></div>
      <svg viewBox="0 0 232 40" preserveAspectRatio="none">
        <rect x={x(600)} y="0" width={x(1000) - x(600)} height="40" className="essp-psd-win" />
        {vals.map((v, i) => (
          <rect
            key={BINS[i]}
            x={i * w + 0.6}
            y={40 - v * 36}
            width={w - 1.2}
            height={v * 36}
            className={BINS[i] < 300 ? 'essp-psd-fines' : 'essp-psd-bar'}
          />
        ))}
        <line x1={x(d50)} x2={x(d50)} y1="0" y2="40" className="essp-psd-d50" />
      </svg>
      <div className="essp-psd-axis"><span>100</span><span>600</span><span>1000</span><span>1600 µm</span></div>
    </div>
  );
}

export function ClientPhone({ className = '' }) {
  return (
    <div className={`essp-phone essp-phone--mill ${className}`} role="img" aria-label="App Micra: tu receta molida a 850 micras, en clics de tu molino, y tu pedido en camino">
      <div className="essp-phone-screen" aria-hidden="true">
        <StatusBar />
        <AppBar zone="CHAPINERO" />
        <div className="essp-mill-cota"><span>FIG. 01 — MOLIENDA</span><span>PINK BOURBON · WAC</span></div>
        <MicronDial value={RECIPE.um} caption="RECETA" />
        <ClickRow um={RECIPE.um} />
        <div className="essp-phone-sheet">
          <span className="essp-phone-handle" />
          <Distribution fig="FIG. 01.2 — PARTÍCULAS" />
          <div className="essp-phone-card">
            <div className="essp-phone-cota"><span>FIG. 01.3 — TU PEDIDO</span><span className="essp-phone-badge">EN CAMINO</span></div>
            <Segs filled={13} />
            <div className="essp-phone-who">
              <span className="essp-phone-av">LM</span>
              <div><b>Laura molió a 850 µm</b><small>AeroPress · 18 g · 84 °C</small></div>
              <em>12′</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BaristaPhone({ className = '' }) {
  const delta = BARISTA_READ - RECIPE.um;
  return (
    <div className={`essp-phone essp-phone--mill ${className}`} role="img" aria-label="App Micra para baristas: calibra tu molino a 850 micras para certificar la receta">
      <div className="essp-phone-screen" aria-hidden="true">
        <StatusBar />
        <AppBar zone="BARISTA" />
        <div className="essp-mill-cota"><span>FIG. 04 — CALIBRACIÓN</span><span className="is-red">AJUSTAR</span></div>
        <MicronDial value={BARISTA_READ} caption="TU LECTURA" />
        <ClickRow um={RECIPE.um} delta={delta} />
        <div className="essp-phone-sheet">
          <span className="essp-phone-handle" />
          <Distribution fig="FIG. 04.1 — TU MUESTRA" d50={BARISTA_READ} />
          <div className="essp-phone-card">
            <div className="essp-phone-cota"><span>FIG. 04.2 — PASO 3 DE 4</span><span className="essp-phone-badge">2 / 4</span></div>
            <Segs filled={10} />
            <b>Cierra 2 clics: meta 850 ± 25 µm</b>
            <div className="essp-phone-toggle">
              <span><b>Recibir pedidos</b><small>Al terminar los 4 pasos</small></span>
              <span className="essp-phone-switch" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

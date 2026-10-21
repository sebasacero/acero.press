import MapCanvas from './MapCanvas.jsx';
import { Segs, useClock } from './parts.jsx';

// Pantallas de Micra dentro de un celular, para el banner: el mapa con las
// ventas reales de la calle y la pantalla del barista. En el
// celular el banner muestra la pantalla a sangre, como si fuera la app (ver
// esspresale.css). Los textos de la app van en español: abre primero en Bogotá.

// Sin pines ni ruta de ejemplo: el celular solo señala lo que el estudio tiene de verdad
const CLIENT_VIEW = { style: 'oscuro', c: 11, k: 81, ax: 0.55, ay: 0.36, s: 8.5, heat: 0.9, pins: false, route: false, labels: 0.9 };
const BARISTA_VIEW = { style: 'oscuro', c: 12, k: 80, ax: 0.55, ay: 0.4, s: 4.2, heat: 1, labels: 0.9 };
// A pantalla completa (celular) el pedido baja al hueco entre el texto y la tarjeta.
const FULL = 320;
const clientView = (w) => (w >= FULL ? { ...CLIENT_VIEW, ay: 0.64, s: 9.5 } : CLIENT_VIEW);
// Con el estudio real, el calor y los tinteros del mapa grande también van en el celular
const streetView = (layers) => (w) => (layers ? { ...clientView(w), heatPoints: layers.heatPoints, pinPoints: layers.pinPoints, pins: layers.pinPoints.length > 0 } : clientView(w));
const baristaView = (w) => (w >= FULL ? { ...BARISTA_VIEW, ay: 0.66, s: 4.8 } : BARISTA_VIEW);

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

export function StreetPhone({ className = '', street = null, layers = null }) {
  const n = (v) => (street ? String(v) : '—');
  const zone = street?.zones?.[0] ?? 'Chapinero';
  return (
    <div className={`essp-phone ${className}`} role="img" aria-label="App Micra: el mapa de las ventas en la calle y los tinteros de Chapinero">
      <MapCanvas view={streetView(layers)} redrawKey={layers} />
      <div className="essp-phone-screen" aria-hidden="true">
        <StatusBar />
        <AppBar zone={zone.toUpperCase()} />
        <div className="essp-phone-pill">
          <div><span>HOY VENDEMOS EN</span>{zone} ▾</div>
          <span className="essp-phone-chip">AP</span>
        </div>
        <div className="essp-phone-sheet">
          <span className="essp-phone-handle" />
          <div className="essp-phone-card">
            <div className="essp-phone-cota"><span>FIG. 01 — EL ESTUDIO</span><span className="essp-phone-badge">EN LA CALLE</span></div>
            <Segs filled={Math.min(20, street?.blocks ?? 0)} />
            <div className="essp-phone-who">
              <span className="essp-phone-av">AP</span>
              <div><b>{n(street?.cups)} tazas en la calle</b><small>{n(street?.blocks)} cuadras · {n(street?.tinteros)} tinteros</small></div>
              <em>{street ? `${street.days} d` : '—'}</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BaristaPhone({ className = '' }) {
  return (
    <div className={`essp-phone ${className}`} role="img" aria-label="App Micra para baristas: mapa de calor de la demanda y avance del registro">
      <MapCanvas view={baristaView} />
      <div className="essp-phone-screen" aria-hidden="true">
        <StatusBar />
        <AppBar zone="BARISTA" />
        <div className="essp-phone-pill">
          <div><span>DEMANDA DE CAFÉ</span>Ahora en tu zona</div>
          <span className="essp-phone-chip is-red">BARISTA</span>
        </div>
        <div className="essp-phone-sheet">
          <span className="essp-phone-handle" />
          <div className="essp-phone-card">
            <div className="essp-phone-cota"><span>FIG. 04.1 — PASO 3 DE 4</span><span className="essp-phone-badge">2 / 4</span></div>
            <Segs filled={10} />
            <b>Certifica la receta WAC</b>
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

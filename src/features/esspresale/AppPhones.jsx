import MapCanvas from './MapCanvas.jsx';
import { Segs, useClock } from './parts.jsx';

// Micra dentro de un celular, para la sección de la portada: el mapa con las ventas reales de la
// calle. Los textos de la app van en español (abre primero en Bogotá) y en público se dice
// «baristas», no «tinteros».

// Sin pines ni ruta de ejemplo: el celular solo señala lo que el estudio tiene de verdad
const CLIENT_VIEW = { style: 'oscuro', c: 11, k: 81, ax: 0.55, ay: 0.36, s: 8.5, heat: 0.9, pins: false, route: false, labels: 0.9 };
// A pantalla completa (celular) el pedido baja al hueco entre el texto y la tarjeta.
const FULL = 320;
const clientView = (w) => (w >= FULL ? { ...CLIENT_VIEW, ay: 0.64, s: 9.5 } : CLIENT_VIEW);
// Con el estudio real, el calor y los tinteros del mapa grande también van en el celular
const streetView = (layers) => (w) => (layers ? { ...clientView(w), heatPoints: layers.heatPoints, pinPoints: layers.pinPoints, pins: layers.pinPoints.length > 0 } : clientView(w));

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
    <div className={`essp-phone ${className}`} role="img" aria-label="App Micra: el mapa de las ventas en la calle y los baristas de la calle en Chapinero">
      <MapCanvas view={streetView(layers)} redrawKey={layers} />
      <div className="essp-phone-screen" aria-hidden="true">
        <StatusBar />
        <AppBar zone={zone.toUpperCase()} />
        <div className="essp-phone-pill">
          <div><span>EL ESTUDIO EN</span>{zone} ▾</div>
          <span className="essp-phone-chip">AP</span>
        </div>
        <div className="essp-phone-sheet">
          <span className="essp-phone-handle" />
          <div className="essp-phone-card">
            <div className="essp-phone-cota"><span>FIG. 01 — EL ESTUDIO</span><span className="essp-phone-badge">{layers ? 'DATOS REALES' : 'MAPA DE EJEMPLO'}</span></div>
            <Segs filled={Math.min(20, street?.blocks ?? 0)} />
            <div className="essp-phone-who">
              <span className="essp-phone-av">AP</span>
              <div><b>{n(street?.cups)} tazas en la calle</b><small>{n(street?.blocks)} cuadras · {n(street?.tinteros)} baristas</small></div>
              <em>{street ? `${street.days} d` : '—'}</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

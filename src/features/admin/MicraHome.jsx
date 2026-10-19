import { useEffect, useState } from 'react';
import { ADMIN_TOOLS } from './adminTools.js';
import { fetchPulse, weatherKind } from '../../shared/lib/pulse.js';
import AppIcon from './micraIcons.jsx';

// Inicio de Micra: el panel como la pantalla de inicio de un celular. Cada
// ventana es una app; las que se usan todo el día van en el dock, las del
// sitio web en una carpeta, y arriba un widget con el pulso del café.

const FOLDER = { folder: 'site-folder', label: 'Sitio', apps: ['sections', 'recipes', 'settings'] };
const GRID = ['dashboard', 'algorithm', 'inventory', 'catalog', FOLDER, 'instagram', 'publications', 'waitlist'];
const DOCK = ['espresale', 'orders', 'site', 'tables'];
const WX = { clear: 'Despejado', partly: 'Parcialmente nublado', cloudy: 'Nublado', fog: 'Neblina', drizzle: 'Llovizna', rain: 'Lluvia', showers: 'Chubascos', storm: 'Tormenta' };

const toolOf = (id) => ADMIN_TOOLS.find((t) => t.id === id);
const money = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

function Badge({ n }) {
  if (!n) return null;
  return <span className="mh-badge" aria-hidden="true">{n > 999 ? `${Math.floor(n / 1000)}k` : n}</span>;
}

// Fuera del inicio: el reloj re-renderiza cada segundo y un componente
// definido adentro se volvería a montar (perdiendo el foco) en cada tic.
function App({ id, dock, overlay, signals, onOpen }) {
  const tool = toolOf(id);
  const isSite = id === 'site';
  const label = isSite ? (overlay ? 'Ver sitio' : 'Sitio') : tool?.label;
  const n = tool?.signal ? signals[tool.signal] : null;
  return (
    <button
      type="button"
      className="mh-app"
      onClick={() => onOpen(id)}
      aria-label={n ? `${label}, ${n} ${n === 1 ? 'aviso' : 'avisos'}` : label}
      title={isSite ? 'Volver a la página' : tool?.desc}
    >
      <span className="mh-icon-wrap"><AppIcon id={id} /><Badge n={n} /></span>
      {!dock && <span className="mh-label">{label}</span>}
    </button>
  );
}

function PulseWidget({ onOpen }) {
  const [pulse, setPulse] = useState(undefined);
  useEffect(() => {
    let alive = true;
    fetchPulse().then((p) => { if (alive) setPulse(p); });
    return () => { alive = false; };
  }, []);
  const { fnc, ny, trm } = pulse?.market ?? {};
  const b = pulse?.bogota;
  const nyDelta = ny?.prev ? ((ny.value - ny.prev) / ny.prev) * 100 : null;
  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' });
  return (
    <button type="button" className="mh-widget" onClick={onOpen} aria-label="Pulso del café: abrir el Algoritmo">
      <span className="mh-widget-head">
        <span>Pulso del café</span>
        <span>{b ? `${b.tempC}° · ${WX[weatherKind(b.code)]}` : today}</span>
      </span>
      {fnc || ny || trm ? (
        <span className="mh-widget-rows">
          {fnc && <span><small>Carga FNC</small><b>{money(fnc.value)}</b></span>}
          {ny && (
            <span>
              <small>Bolsa NY</small>
              <b>{ny.value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<i>¢/lb</i></b>
              {nyDelta !== null && <em className={nyDelta < 0 ? 'is-down' : 'is-up'}>{nyDelta < 0 ? '▼' : '▲'} {Math.abs(nyDelta).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %</em>}
            </span>
          )}
          {trm && <span><small>Dólar</small><b>{money(trm.value)}</b></span>}
        </span>
      ) : (
        <span className="mh-widget-empty">{pulse === undefined ? 'Leyendo el mercado…' : 'Sin datos del mercado por ahora. Toca para ver el Algoritmo.'}</span>
      )}
    </button>
  );
}

export default function MicraHome({ signals, clock, onOpen, onSearch, onSite, onExit, exitLabel, overlay }) {
  const [folderOpen, setFolderOpen] = useState(false);

  // Esc cierra la carpeta (el panel revisa que no esté abierta antes de cerrarse)
  useEffect(() => {
    if (!folderOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setFolderOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [folderOpen]);

  const open = (id) => {
    setFolderOpen(false);
    if (id === 'site') { onSite(); return; }
    onOpen(id);
  };
  const app = (id, dock = false) => <App key={id} id={id} dock={dock} overlay={overlay} signals={signals} onOpen={open} />;

  return (
    <div className="mh-screen">
      <div className="mh-status">
        <span className="mh-time">{clock}</span>
        <span className="mh-brand">micra<i>.</i></span>
        <span className="mh-status-right">
          <i className="mh-live" aria-hidden="true" />
          <button type="button" className="mh-exit" onClick={onExit} aria-label={overlay ? 'Cerrar el panel' : exitLabel}>
            {overlay ? '×' : 'Salir'}
          </button>
        </span>
      </div>

      <div className="mh-page">
        <PulseWidget onOpen={() => onOpen('algorithm')} />

        <div className="mh-grid">
          {GRID.map((item) => (typeof item === 'string' ? (
            app(item)
          ) : (
            <button key={item.folder} type="button" className="mh-app" onClick={() => setFolderOpen(true)} aria-label={`Carpeta ${item.label}`}>
              <span className="mh-icon-wrap">
                <span className="mh-folder-icon" aria-hidden="true">
                  {item.apps.map((id) => <AppIcon key={id} id={id} />)}
                </span>
              </span>
              <span className="mh-label">{item.label}</span>
            </button>
          )))}
        </div>
      </div>

      <button type="button" className="mh-search" onClick={onSearch}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></svg>
        Buscar
      </button>

      <nav className="mh-dock" aria-label="Apps principales">
        {DOCK.map((id) => app(id, true))}
      </nav>

      {folderOpen && (
        <div className="mh-folder-open" onClick={(e) => { if (e.target === e.currentTarget) setFolderOpen(false); }}>
          <p className="mh-folder-title">{FOLDER.label}</p>
          <div className="mh-folder-panel" role="dialog" aria-label={`Carpeta ${FOLDER.label}`}>
            {FOLDER.apps.map((id) => app(id))}
          </div>
        </div>
      )}
    </div>
  );
}

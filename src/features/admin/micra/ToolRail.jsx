import { useEffect, useState } from 'react';
import { IconImage, IconLayers, IconSticker, IconText, IconZones } from './icons.jsx';

const ZONE_LABEL = { off: 'Zonas', zones: 'Zonas', app: 'App' };

/** Riel de la derecha: texto, stickers, capas, fondo y zonas. Los nombres se ven 3 s al entrar. */
export default function ToolRail({ onText, onStickers, onLayers, onBackground, zones, onZones }) {
  const [labels, setLabels] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setLabels(false), 3000);
    return () => clearTimeout(id);
  }, []);
  const items = [
    { key: 'text', label: 'Texto', Icon: IconText, run: onText },
    { key: 'stickers', label: 'Stickers', Icon: IconSticker, run: onStickers },
    { key: 'layers', label: 'Capas', Icon: IconLayers, run: onLayers },
    { key: 'bg', label: 'Fondo', Icon: IconImage, run: onBackground },
  ];
  return (
    <nav className={`mst-rail ${labels ? 'show-labels' : ''}`} aria-label="Herramientas">
      {items.map(({ key, label, Icon, run }) => (
        <button key={key} type="button" className="mst-rail-btn" onClick={run} aria-label={label}>
          <Icon /><span className="mst-rail-label">{label}</span>
        </button>
      ))}
      <button type="button" className={`mst-rail-btn ${zones !== 'off' ? 'on' : ''}`} onClick={onZones} aria-pressed={zones !== 'off'} aria-label={zones === 'zones' ? 'Zonas: ver la app encima' : zones === 'app' ? 'Zonas: apagar' : 'Ver zonas seguras'}>
        <IconZones /><span className="mst-rail-label">{ZONE_LABEL[zones]}</span>
      </button>
    </nav>
  );
}

import { useEffect, useState } from 'react';
import Figure from './Elenco.jsx';

// El arranque de la app instalada: el barista de ruana se dibuja a trazo
// mientras carga lo primero. Dura poco más de un segundo, se puede tocar para
// saltarlo y una sola vez por sesión; con «menos movimiento» ni aparece.

const SHOWN_KEY = 'micra_splash_shown';
const MS = 1600;

export default function Splash() {
  const [on, setOn] = useState(() => {
    try { if (sessionStorage.getItem(SHOWN_KEY)) return false; } catch { /* sin memoria */ }
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (!on) return undefined;
    try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch { /* sin memoria */ }
    const id = setTimeout(() => setOn(false), MS);
    return () => clearTimeout(id);
  }, [on]);
  if (!on) return null;
  return (
    <div className="mapp-splash" role="presentation" onClick={() => setOn(false)} data-testid="micra-splash">
      <Figure name="ruana" draw />
      <p className="mapp-splash-brand">micra<i>.</i></p>
      <p className="mapp-splash-cota">Café especial más cerca de ti</p>
    </div>
  );
}

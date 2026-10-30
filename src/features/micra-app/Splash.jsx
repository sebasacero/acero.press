import { useEffect, useState } from 'react';
import Termo from './Termo.jsx';

// El arranque de la app instalada: el termo de Micra flota y se destapa
// mientras carga lo primero (sigue al arranque nativo, que es el mismo termo). Dura poco más de un segundo, se puede tocar para
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
      <Termo />
      <p className="mapp-splash-brand">micra<i>.</i></p>
      <p className="mapp-splash-cota">Café especial más cerca de ti</p>
    </div>
  );
}

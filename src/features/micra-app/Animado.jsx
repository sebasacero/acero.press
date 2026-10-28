import { useEffect, useRef, useState } from 'react';

// Los personajes de la calle animados (animado/*.svg): las ilustraciones
// originales recortadas por partes que se mueven en bucle con SMIL, sin JS por
// cuadro (scripts/animar-personajes los genera). Acompañan las esperas, llegan
// aparte y solo cuando se muestran. Son dibujos a color fijo: de noche van
// sobre una tarjeta crema. Con «menos movimiento» quedan quietos.

const FIGURAS = {
  carrito: () => import('./animado/carrito.svg?raw'),
  ruana: () => import('./animado/ruana.svg?raw'),
  caminando: () => import('./animado/caminando.svg?raw'),
  aeropress: () => import('./animado/aeropress.svg?raw'),
  servir: () => import('./animado/servir.svg?raw'),
};

const cache = {};
const quieto = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Animado({ name, className = '' }) {
  const [svg, setSvg] = useState(cache[name] ?? null);
  const ref = useRef(null);
  useEffect(() => {
    if (cache[name]) { setSvg(cache[name]); return undefined; }
    let on = true;
    FIGURAS[name]?.().then((m) => { cache[name] = m.default; if (on) setSvg(m.default); }).catch(() => {});
    return () => { on = false; };
  }, [name]);
  useEffect(() => {
    const el = ref.current?.querySelector('svg');
    if (!el || !quieto()) return;
    el.pauseAnimations?.();
    el.setCurrentTime?.(Number(el.dataset.dur || 0) * 0.4);
  }, [svg]);
  if (!svg) return <span className={`mapp-anim is-${name} is-empty ${className}`} aria-hidden="true" />;
  // El SVG es nuestro (animado/, generado por figuras.js): no entra nada de fuera
  return <span ref={ref} className={`mapp-anim is-${name} ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// Espera con personaje: el texto sigue siendo el mismo para lectores y pruebas
export function Cargando({ fig = 'carrito', children = 'Cargando…' }) {
  return (
    <div className="mapp-loading" role="status">
      <Animado name={fig} />
      <p className="mapp-muted">{children}</p>
    </div>
  );
}

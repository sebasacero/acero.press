import { useEffect, useState } from 'react';

// El elenco de Micra: los baristas dibujados a tinta (trazo, beige y un punto
// rojo) que acompañan la app. Son SVG vectorizados de las ilustraciones de
// micra-app/personajes-28oct; cada uno llega aparte, solo cuando se muestra, y
// se tiñe con CSS (.pi tinta, .pz beige, .pr rojo), así de noche la línea es
// blanca sin otra versión. `draw` dibuja el trazo al aparecer (arranque).

const FIGURES = {
  carrito: () => import('./elenco/carrito.svg?raw'),
  caminando: () => import('./elenco/caminando.svg?raw'),
  ruana: () => import('./elenco/ruana.svg?raw'),
  entrega: () => import('./elenco/entrega.svg?raw'),
  empujando: () => import('./elenco/empujando.svg?raw'),
  duo: () => import('./elenco/duo.svg?raw'),
  sombrilla: () => import('./elenco/sombrilla.svg?raw'),
};

const cache = {};

export default function Figure({ name, draw = false, className = '' }) {
  const [svg, setSvg] = useState(cache[name] ?? null);
  useEffect(() => {
    if (cache[name]) { setSvg(cache[name]); return undefined; }
    let on = true;
    FIGURES[name]?.().then((m) => { cache[name] = m.default; if (on) setSvg(m.default); }).catch(() => {});
    return () => { on = false; };
  }, [name]);
  if (!svg) return <span className={`mapp-fig is-${name} is-empty ${className}`} aria-hidden="true" />;
  // El SVG es nuestro (src/features/micra-app/elenco): no entra nada de fuera
  return <span className={`mapp-fig is-${name} ${draw ? 'is-draw' : ''} ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

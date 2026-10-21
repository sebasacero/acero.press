import { useEffect, useRef } from 'react';
import { drawBogotaMap } from './bogotaMap.js';

/**
 * Canvas con el mapa de Bogotá. `view` puede ser un objeto o una función que
 * recibe el ancho en px (para acercar el mapa en pantallas angostas). Se
 * redibuja al cambiar de tamaño y cuando cargan las fuentes de las etiquetas.
 */
export default function MapCanvas({ view, className = '', label, redrawKey = null }) {
  const ref = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    let frame = 0;
    const draw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const v = viewRef.current;
        drawBogotaMap(canvas, typeof v === 'function' ? v(canvas.clientWidth) : v);
      });
    };
    draw();
    document.fonts?.ready.then(draw);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    ro?.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
    };
  }, [redrawKey]); // se vuelve a dibujar cuando llegan las capas reales del estudio

  return <canvas ref={ref} className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

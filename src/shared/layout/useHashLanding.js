import { useEffect } from 'react';

// Llegar a la portada con #sección desde otra página (el menú en /escuela, la cuenta, un enlace
// compartido): el navegador busca la sección al cargar, antes de que React la pinte, y deja la
// página arriba. Aquí se lleva a la sección cuando ya existe y se la sostiene mientras lo de arriba
// termina de cargar (productos, fotos, la franja de la Escuela), hasta que la persona toque la página.
const USER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
const HOLD_MS = 10_000; // con mala red, los productos tardan en llegar y empujan lo de abajo

// Un enlace mal copiado (#%E0%A4) no debe tumbar la portada
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

export function useHashLanding(on) {
  useEffect(() => {
    if (!on) return undefined;
    const id = safeDecode(window.location.hash.slice(1));
    const nav = performance.getEntriesByType?.('navigation')?.[0]?.type;
    // Al recargar o volver atrás, el navegador devuelve a la persona adonde iba: no se le cambia
    if (!id || nav === 'reload' || nav === 'back_forward') return undefined;

    const land = () => {
      const el = document.getElementById(id);
      if (!el) return;
      const root = document.documentElement;
      const top = Math.min(el.getBoundingClientRect().top + window.scrollY, root.scrollHeight - window.innerHeight);
      // 'instant': el html tiene scroll-behavior: smooth y no se quiere un viaje desde arriba
      if (Math.abs(window.scrollY - top) > 1) window.scrollTo({ top, behavior: 'instant' });
    };
    // El cuerpo cambia de alto cuando aparece la sección o crece algo de arriba
    const ro = new ResizeObserver(land);
    let timer = 0;
    const stop = () => {
      ro.disconnect();
      window.clearTimeout(timer);
      USER_INPUT.forEach((e) => window.removeEventListener(e, stop, { capture: true }));
    };
    ro.observe(document.body);
    timer = window.setTimeout(stop, HOLD_MS);
    USER_INPUT.forEach((e) => window.addEventListener(e, stop, { capture: true, passive: true }));
    return stop;
  }, [on]);
}

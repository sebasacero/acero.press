// La galaxia de Celestra (12 nov 2026, pedido del usuario: «que aparezca como aparece Siri…
// con este diseño», una galaxia espiral). Puro: dónde va cada estrella; el lienzo solo pinta.

/** Azar con semilla (mulberry32): la misma galaxia en cada celular y en las pruebas. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BRAZOS = 2;
export const VUELTAS = 1.6;
// Del núcleo al borde: el tramo frío de la escala térmica (--t-7, rosa, --t-3, --t-2, índigo) y el blanco de las estrellas sueltas
export const TONOS = ['#FFF3B0', '#FFB3C7', '#B0127A', '#5A1E9E', '#3A2A9E', '#FFFFFF'];

/**
 * n estrellas: [{ a, r, size, tono, alpha }]. a = ángulo en reposo, r = distancia al centro (0–1).
 * Una de cada ocho va suelta por el campo; las demás siguen los brazos, más juntas cerca del núcleo.
 */
export function estrellas(n = 600, seed = 7) {
  const rand = rng(seed);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    if (i % 8 === 7) {
      out.push({ a: rand() * Math.PI * 2, r: Math.sqrt(rand()), size: 0.5 + rand() * 0.9, tono: 5, alpha: 0.35 + rand() * 0.5 });
      continue;
    }
    const t = rand() ** 1.05;
    const brazo = i % BRAZOS;
    const suelto = (rand() - 0.5) * (0.5 + t * 0.9);
    out.push({
      a: brazo * ((Math.PI * 2) / BRAZOS) + t * VUELTAS * Math.PI * 2 + suelto,
      r: 0.04 + t * 0.92,
      size: 0.6 + rand() * (1.5 - t * 0.6),
      tono: Math.min(4, Math.floor(t * 4.4 + rand() * 0.9)),
      alpha: 0.35 + (1 - t) * 0.45 + rand() * 0.15,
    });
  }
  return out;
}

/** Dónde se pinta una estrella: gira con `rot`, se acuesta con `tilt` (0–1) y se ladea `lado` radianes. Unidades del radio. */
export function punto(e, rot = 0, tilt = 0.62, lado = -0.35) {
  const x = e.r * Math.cos(e.a + rot);
  const y = e.r * Math.sin(e.a + rot) * tilt;
  return { x: x * Math.cos(lado) - y * Math.sin(lado), y: x * Math.sin(lado) + y * Math.cos(lado) };
}

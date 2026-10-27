// Recetas de la casa (el banner de la barra en la vitrina del local): lógica pura, sin React.

/** Índice dentro de la lista, dando la vuelta en los dos sentidos. */
export const wrapIndex = (i, n) => (n > 0 ? ((i % n) + n) % n : 0);

// Enlace a una sección de la portada. En la portada es un salto dentro de la página
// (no recarga ni pierde ?utm=… de Instagram); desde otra página (/escuela) lleva a ella.
export const homeLink = (hash) => (window.location.pathname === '/' ? hash : `/${hash}`);

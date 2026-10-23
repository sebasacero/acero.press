// Enlace a una sección de la portada. En la portada es un salto dentro de la página
// (no recarga ni pierde ?utm=… de Instagram); desde otra página (/escuela) lleva a ella.
export const homeLink = (hash) => (window.location.pathname === '/' ? hash : `/${hash}`);

/**
 * Los enlaces del menú, en un solo lugar para el de arriba y el de tres rayas (antes cada
 * uno tenía su lista y se desfasaban). `key` es el texto en translations (nav.*).
 */
export function navItems() {
  const onSchool = /^\/escuela\/?$/.test(window.location.pathname);
  return [
    { key: 'home', href: homeLink('#home') },
    { key: 'beans', href: homeLink('#beans') },
    { key: 'championship', href: homeLink('#metodo') }, // las recetas campeonas del WAC
    { key: 'school', href: '/escuela', current: onSchool },
    { key: 'contact', href: '#contact' }, // el pie de página, con las redes, está en todas las páginas
    { key: 'app', href: homeLink('#prensado'), className: 'nav-app-link' },
  ];
}

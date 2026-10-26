// Enlace a una sección de la portada. En la portada es un salto dentro de la página
// (no recarga ni pierde ?utm=… de Instagram); desde otra página (/escuela) lleva a ella.
export const homeLink = (hash) => (window.location.pathname === '/' ? hash : `/${hash}`);

/**
 * Los enlaces del menú, en un solo lugar para el de arriba y el de tres rayas (antes cada
 * uno tenía su lista y se desfasaban). `key` es el texto en translations (nav.*).
 */
export function navItems() {
  const onSchool = /^\/escuela\/?$/.test(window.location.pathname);
  // En el orden de la portada. Sin «Inicio» (lo hace el logo) ni «Contacto» (el pie y el botón de WhatsApp están siempre)
  return [
    { key: 'app', href: homeLink('#micra'), className: 'nav-app-link' },
    { key: 'posts', href: homeLink('#publicaciones') }, // las fichas de redes, dentro de Micra
    { key: 'beans', href: homeLink('#beans') },
    { key: 'recipes', href: homeLink('#recetas') }, // las recetas de la casa, en la vitrina del local
    { key: 'school', href: '/escuela', current: onSchool },
    { key: 'championship', href: homeLink('#metodo') }, // las recetas campeonas del WAC
  ];
}

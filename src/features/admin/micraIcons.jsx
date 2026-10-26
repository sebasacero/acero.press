// Íconos de "apps" para el inicio de Micra: cada ventana del panel es una
// app con su color y un dibujo de línea blanco (24×24, trazo 1.8).

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

const GLYPHS = {
  // Micra: el logotipo
  espresale: () => <text x="12" y="17" textAnchor="middle" className="mh-glyph-word">m.</text>,
  // Pedidos: recibo
  orders: () => (
    <g {...S}>
      <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </g>
  ),
  // Mesas / POS: mesa con dos tazas
  tables: () => (
    <g {...S}>
      <rect x="4" y="8" width="16" height="8" rx="2" />
      <path d="M7 16v4M17 16v4" />
      <path d="M8 5.5h3v2.5H8zM13 5.5h3v2.5h-3z" />
    </g>
  ),
  // Agente: el reactor del HUD
  dashboard: () => (
    <g {...S}>
      <circle cx="12" cy="12" r="8" strokeDasharray="38 12" />
      <circle cx="12" cy="12" r="4.6" strokeDasharray="20 9" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </g>
  ),
  // Algoritmo: curva de bolsa con su punto
  algorithm: () => (
    <g {...S}>
      <path d="M3 15l3.2-3 2.6 2.4 3.4-5.2 2.6 3.2L21 6" />
      <path d="M14.8 3v18" strokeOpacity=".55" strokeWidth="1.2" />
      <circle cx="14.8" cy="12.4" r="1.9" fill="#4ea1ff" stroke="none" />
    </g>
  ),
  // Inventario: cajas apiladas
  inventory: () => (
    <g {...S}>
      <path d="M4 12h7v8H4zM13 12h7v8h-7zM8.5 4h7v8h-7z" />
      <path d="M6.5 15h2M15.5 15h2M11 7h2" />
    </g>
  ),
  // Catálogo: bolsa de café
  catalog: () => (
    <g {...S}>
      <path d="M7 4h10l1.5 4v12H5.5V8z" />
      <path d="M5.5 8h13M9.5 4v4M14.5 4v4" />
      <ellipse cx="12" cy="14" rx="2.2" ry="3" />
      <path d="M12 11.2c-.8 1.6-.8 4 0 5.6" />
    </g>
  ),
  // Publicaciones: video
  publications: () => (
    <g {...S}>
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <path d="M10.5 9.2l4.5 2.8-4.5 2.8z" fill="currentColor" />
    </g>
  ),
  // Instagram (la conexión): cámara
  instagram: () => (
    <g {...S}>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="16.8" cy="7.2" r=".9" fill="currentColor" stroke="none" />
    </g>
  ),
  // Recetas: AeroPress
  recipes: () => (
    <g {...S}>
      <path d="M8 3.5h8M9.5 3.5v3M14.5 3.5v3" />
      <rect x="7.5" y="6.5" width="9" height="11" rx="1" />
      <path d="M7.5 10h9" />
      <path d="M6 17.5h12l-1.5 3h-9z" />
    </g>
  ),
  // Secciones: bloques de la página
  sections: () => (
    <g {...S}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16M10 9v11" />
      <path d="M13 12.5h4M13 15.5h4" />
    </g>
  ),
  // Configuración: engranaje
  settings: () => (
    <g {...S}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5" />
      <circle cx="12" cy="12" r="6.2" />
    </g>
  ),
  // Piloto: un pin sobre el calor de la cuadra (estudio de calle)
  piloto: () => (
    <g {...S}>
      <circle cx="12" cy="17.5" r="3.6" strokeOpacity=".5" />
      <circle cx="12" cy="17.5" r="6.4" strokeOpacity=".3" strokeWidth="1.2" />
      <path d="M12 16.2s-4.6-4.7-4.6-8a4.6 4.6 0 0 1 9.2 0c0 3.3-4.6 8-4.6 8z" fill="currentColor" fillOpacity=".18" />
      <circle cx="12" cy="8.2" r="1.7" fill="currentColor" stroke="none" />
    </g>
  ),
  // Ver el sitio: brújula
  site: () => (
    <g {...S}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z" fill="currentColor" fillOpacity=".25" />
      <path d="M12 3.5v1.6M12 18.9v1.6M3.5 12h1.6M18.9 12h1.6" />
    </g>
  ),
};

export default function AppIcon({ id }) {
  const Glyph = GLYPHS[id];
  return (
    <span className={`mh-icon mh-icon--${id}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">{Glyph ? <Glyph /> : null}</svg>
    </span>
  );
}

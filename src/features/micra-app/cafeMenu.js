// El menú del café (pedido del usuario, 7 nov 2026): todo lo que tiene que ver
// con café sale de la izquierda al tocar el logo de arriba, y Mi perfil queda
// para la cuenta. Puro: qué secciones y qué entradas ve cada modo. Sin nada del
// equipo: el modo equipo no se anuncia aquí.

/**
 * Las secciones del menú para un modo ('client' | 'barista' | 'owner').
 * Cada entrada: { id, label, sub, icon, to } (una ruta de la app),
 * { …, href } (el sitio, se abre fuera) o { …, action } (algo de la app, p. ej. 'acero').
 * `siteUrl` arma las direcciones del sitio (en la app instalada llevan el dominio).
 */
export function cafeMenu(mode, { siteUrl = (p) => p } = {}) {
  const shop = {
    title: 'Comprar café',
    items: [
      { id: 'tienda', label: 'Tienda', sub: 'Café en grano, molido, AeroPress y termos', icon: 'bag', to: '/micra/tienda' },
      { id: 'origen', label: 'Marcas y fincas', sub: 'De dónde viene tu café', icon: 'bean', to: '/micra/origen' },
    ],
  };
  const learn = (barista) => ({
    title: 'Aprender',
    items: [
      barista
        ? { id: 'aprende', label: 'Aprende', sub: 'Tus lecciones y tu nivel', icon: 'cap', to: '/micra/barista/aprende' }
        : { id: 'escuela', label: 'Escuela', sub: 'Seis lecciones con AeroPress', icon: 'cap', href: siteUrl('/escuela') },
      { id: 'acero', label: 'ACERO.press', sub: 'Recetas y latas de la casa', icon: 'can', action: 'acero' },
    ],
  });
  if (mode === 'barista') {
    return [
      {
        title: 'Tu café de hoy',
        items: [
          { id: 'hoy', label: 'Hoy en el café', sub: 'El precio del café y tus logros', icon: 'today', to: '/micra/barista/hoy' },
          { id: 'reto', label: 'Competencia', sub: 'El reto de la semana', icon: 'trophy', to: '/micra/barista/reto' },
        ],
      },
      learn(true),
      shop,
      {
        title: 'Del campo',
        items: [
          { id: 'finca', label: 'Soy caficultor', sub: 'Crea el perfil de tu finca', icon: 'pin', to: '/micra/finca' },
        ],
      },
    ];
  }
  return [
    {
      title: 'Lo de hoy',
      items: [
        { id: 'hoy', label: 'Café', sub: 'El precio, noticias, recetas y videos', icon: 'today', to: '/micra/cafe' },
        { id: 'reto', label: 'Competencia', sub: 'El reto de la semana', icon: 'trophy', to: '/micra/reto' },
      ],
    },
    shop,
    learn(false),
    {
      title: 'Vende café',
      items: [
        { id: 'barista', label: 'Sé barista', sub: 'Vende café en la calle con Micra', icon: 'thermo', to: '/micra/barista' },
        { id: 'finca', label: 'Soy caficultor', sub: 'Crea el perfil de tu finca', icon: 'pin', to: '/micra/finca' },
      ],
    },
  ];
}

/** La entrada que corresponde a la ruta actual (para marcarla), o null. */
export function activeItem(sections, pathname) {
  const p = String(pathname ?? '').replace(/\/+$/, '');
  for (const s of sections) for (const it of s.items) if (it.to && it.to === p) return it.id;
  return null;
}

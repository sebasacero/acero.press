// Las escuelas de Aprende (6 nov 2026, pedido del usuario): además de la AeroPress
// (las seis lecciones de /escuela), termo, V60 y espresso. Cada una es un camino de
// lecciones; su ícono se desbloquea al terminarlas. Lo visto de estas tres se
// guarda solo en el celular, como lo de /escuela.

export const SCHOOLS_KEY = 'micra_escuelas_v1';

const TERMO = [
  {
    key: 'termo-calentar', title: 'Prepara el termo', mins: 3,
    lead: 'Un termo frío le roba calor al café apenas lo sirves. Antes de llenarlo, caliéntalo por dentro.',
    pointsLabel: 'Paso a paso', numbered: true,
    points: [
      'Llénalo con agua caliente y tápalo.',
      'Espera dos minutos.',
      'Bota el agua y llénalo de una vez con el café recién hecho.',
    ],
    tip: 'Huele el termo vacío: si huele a café viejo o a jabón, ese olor queda en la taza.',
    practice: ['Mide la temperatura del café a la hora con y sin precalentar el termo.'],
  },
  {
    key: 'termo-tanda', title: 'El tinto para el termo', mins: 5,
    lead: 'Para un litro haces café concentrado con la AeroPress y lo completas con agua caliente en el termo.',
    pointsLabel: 'Por litro', numbered: true,
    points: [
      '60 g de café en molienda media (cuatro AeroPress de 15 g).',
      'Cada prensada con 100 ml de agua a unos 90 °C.',
      'Echa el concentrado al termo y completa el litro con agua caliente.',
      'Prueba y anota: más café si queda aguado, más agua si queda fuerte.',
    ],
    tip: 'Pesa siempre: el mismo café y la misma agua dan el mismo tinto todos los días.',
    practice: ['Haz un litro, sírvete una taza y anota cómo te supo.'],
  },
  {
    key: 'termo-tiempo', title: 'Cuánto aguanta', mins: 3,
    lead: 'El café en el termo sigue caliente horas, pero el aroma se va mucho antes.',
    pointsLabel: 'Lo que debes saber',
    points: [
      'Lo mejor es venderlo en las primeras dos horas.',
      'Mejor tandas pequeñas y seguidas que un termo grande desde temprano.',
      'No recalientes café ya hecho: sabe amargo y a quemado.',
      'Para servir, el café debe estar entre 65 y 75 °C.',
    ],
    tip: 'Marca en el termo la hora en que lo llenaste.',
    practice: ['Prueba el mismo tinto recién hecho y a las tres horas.'],
  },
  {
    key: 'termo-limpiar', title: 'Limpieza al final del día', mins: 3,
    lead: 'Los aceites del café se pegan al termo y dañan el siguiente tinto.',
    pointsLabel: 'Cada noche', numbered: true,
    points: [
      'Bota lo que sobró: el café de ayer no se vende.',
      'Lava con agua caliente y una cucharada de bicarbonato.',
      'Enjuaga bien la tapa y el empaque.',
      'Déjalo secar abierto, boca abajo.',
    ],
    tip: 'Una vez por semana deja el bicarbonato con agua caliente toda la noche.',
    practice: ['Lava el termo esta noche y huélelo mañana antes de llenarlo.'],
  },
];

const V60 = [
  {
    key: 'v60-conoce', title: 'Conoce tu V60', mins: 3,
    lead: 'La V60 es un cono con un hueco grande y filtro de papel. El sabor depende de cómo viertes el agua.',
    pointsLabel: 'Lo que necesitas',
    points: ['V60 y filtro de papel', 'Tetera de cuello delgado', 'Balanza con cronómetro', '15 g de café y 250 g de agua'],
    tip: 'Enjuaga el filtro con agua caliente antes de poner el café: le quita el sabor a papel y calienta la V60.',
    practice: ['Arma la V60 con su filtro y enjuágalo.'],
  },
  {
    key: 'v60-receta', title: 'La receta base', mins: 5,
    lead: '15 g de café en molienda media fina y 250 g de agua a unos 93 °C. Termina en dos minutos y medio a tres.',
    pointsLabel: 'Paso a paso', numbered: true,
    points: [
      'Pon el café, nivélalo y pon la balanza en cero.',
      'Florecido: vierte 40 g de agua y espera 30 a 45 segundos.',
      'Vierte en círculos lentos hasta 150 g.',
      'Sigue hasta 250 g antes de los dos minutos.',
      'Deja que baje toda el agua: termina entre 2:30 y 3:00.',
    ],
    tip: 'En el florecido el café se infla: es el gas que suelta. Si no se infla, el café está viejo.',
    practice: ['Prepara la receta con cronómetro y anota a qué hora terminó.'],
  },
  {
    key: 'v60-verter', title: 'Cómo verter', mins: 4,
    lead: 'Un chorro delgado, parejo y siempre a la misma altura.',
    pointsLabel: 'Lo que debes cuidar',
    points: [
      'Vierte en el centro y abre en círculos, sin tocar el papel.',
      'No subas ni bajes la tetera mientras viertes.',
      'Mantén el agua más o menos a la misma altura dentro del cono.',
    ],
    tip: 'Al final, dale un giro suave a la V60 para que la cama de café quede plana.',
    practice: ['Practica solo con agua sobre el filtro vacío hasta que el chorro salga parejo.'],
  },
  {
    key: 'v60-ajusta', title: 'Ajusta el sabor', mins: 4,
    lead: 'La molienda es lo primero que se cambia. Cambia una sola cosa a la vez.',
    pointsLabel: 'Si te sale…',
    points: [
      'Agrio o aguado, y bajó muy rápido: muele más fino.',
      'Amargo o seco, y bajó muy lento: muele más grueso.',
      'Rico pero suave: sube a 16 o 17 g de café.',
    ],
    tip: 'Anota cada receta: café, agua, molienda y tiempo.',
    practice: ['Haz dos tazas con dos moliendas distintas y compáralas.'],
  },
];

const ESPRESSO = [
  {
    key: 'espresso-conoce', title: 'Conoce la máquina', mins: 3,
    lead: 'El espresso es agua caliente a presión por un café muy fino y apretado, en menos de medio minuto.',
    pointsLabel: 'Sus partes',
    points: ['El portafiltro con su canasta', 'El grupo, por donde sale el agua', 'La lanceta del vapor', 'El molino, que muele en el momento'],
    tip: 'Antes de cada café, deja salir un chorrito de agua del grupo (purgar) para limpiarlo.',
    practice: ['Purga el grupo y seca bien la canasta antes de poner el café.'],
  },
  {
    key: 'espresso-receta', title: 'La receta base', mins: 5,
    lead: '18 g de café molido entran y salen 36 g de espresso, en 25 a 30 segundos.',
    pointsLabel: 'Paso a paso', numbered: true,
    points: [
      'Muele 18 g directo en la canasta seca.',
      'Distribuye y apisona (lo ves en la siguiente lección).',
      'Encaja el portafiltro y arranca de una vez, con la taza sobre la balanza.',
      'Para en 36 g y mira el tiempo: entre 25 y 30 segundos.',
    ],
    tip: 'Mira el chorro: debe salir como una cola de ratón, color avellana, sin goteo ni chorro grueso.',
    practice: ['Saca tres espressos seguidos y anota peso y tiempo de cada uno.'],
  },
  {
    key: 'espresso-apisonar', title: 'Distribuir y apisonar', mins: 4,
    lead: 'Si el café queda disparejo, el agua se va por el lado fácil y el espresso sale agrio y amargo a la vez.',
    pointsLabel: 'Paso a paso', numbered: true,
    points: [
      'Golpecitos suaves al portafiltro para que el café se asiente parejo.',
      'Apoya el portafiltro en el borde de la mesa, derecho.',
      'Apisona con fuerza firme y pareja, una sola vez, sin golpear.',
      'Limpia el café del borde antes de encajarlo.',
    ],
    tip: 'Codo arriba y muñeca recta: así apisonas parejo sin dolor.',
    practice: ['Apisona diez veces y revisa que la cama quede plana.'],
  },
  {
    key: 'espresso-leche', title: 'La leche', mins: 5,
    lead: 'Para el perico o el capuchino, la leche se calienta con vapor y se le mete un poco de aire para hacer espuma fina.',
    pointsLabel: 'Paso a paso', numbered: true,
    points: [
      'Leche fría en la jarra, hasta debajo del pico.',
      'Purga la lanceta y métela apenas bajo la superficie.',
      'Al abrir el vapor, deja que entre aire unos segundos: suena como papel rasgándose.',
      'Baja un poco la jarra para que la leche gire sin meter más aire.',
      'Cierra a los 60 °C, cuando la jarra quema al tocarla.',
    ],
    tip: 'Golpea la jarra contra la mesa y gírala: la espuma queda brillante, sin burbujas grandes.',
    practice: ['Vaporiza leche tres veces y mira cuál quedó más brillante.'],
  },
  {
    key: 'espresso-ajusta', title: 'Ajusta el molino', mins: 4,
    lead: 'Con la misma dosis y el mismo peso de salida, el tiempo te dice cómo está la molienda.',
    pointsLabel: 'Si te sale…',
    points: [
      'Menos de 25 segundos (agrio, aguado): muele más fino.',
      'Más de 30 segundos (amargo, pesado): muele más grueso.',
      'Mueve el molino de a poco y bota el primer café después de cada cambio.',
    ],
    tip: 'Ajusta el molino cada mañana: el café cambia con los días y con la humedad.',
    practice: ['Ajusta el molino hasta que tres espressos seguidos caigan en 25 a 30 segundos.'],
  },
];

/** Las cuatro escuelas, en orden. La AeroPress usa las lecciones de /escuela. */
export const SCHOOLS = [
  { id: 'aeropress', name: 'AeroPress', title: 'Barista AeroPress', lessons: null },
  { id: 'termo', name: 'Termo', title: 'Tinto de termo', lessons: TERMO },
  { id: 'v60', name: 'V60', title: 'Barista V60', lessons: V60 },
  { id: 'espresso', name: 'Espresso', title: 'Barista espresso', lessons: ESPRESSO },
];

export const schoolOf = (id) => SCHOOLS.find((s) => s.id === id) ?? SCHOOLS[0];

/** Las lecciones de una escuela (la de AeroPress viene de /escuela). */
export const schoolLessons = (school, aeropressLessons = []) => school.lessons ?? aeropressLessons;

/** Lo visto de una escuela: la AeroPress con la marca de /escuela, las demás con la suya. */
export function seenFor(id, aeropressSeen = [], stored = {}) {
  if (id === 'aeropress') return aeropressSeen;
  return Array.isArray(stored?.[id]) ? stored[id] : [];
}

/** Marca una lección vista en el mapa guardado, sin repetirla. */
export function markSchool(stored = {}, id, key) {
  const prev = Array.isArray(stored?.[id]) ? stored[id] : [];
  if (prev.includes(key)) return stored;
  return { ...stored, [id]: [...prev, key] };
}

/** Cada escuela con cuántas lleva y si su ícono ya se desbloqueó (todas sus lecciones vistas). */
export function gearShelf(aeropressLessons = [], aeropressSeen = [], stored = {}) {
  return SCHOOLS.map((s) => {
    const lessons = schoolLessons(s, aeropressLessons);
    const seen = new Set(seenFor(s.id, aeropressSeen, stored));
    const done = lessons.filter((l) => seen.has(l.key)).length;
    return { id: s.id, name: s.name, done, total: lessons.length, unlocked: lessons.length > 0 && done === lessons.length };
  });
}

export function readSchools(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem(SCHOOLS_KEY) ?? '{}') || {}; } catch { return {}; }
}

export function writeSchools(value, storage = globalThis.localStorage) {
  try { storage?.setItem(SCHOOLS_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
}

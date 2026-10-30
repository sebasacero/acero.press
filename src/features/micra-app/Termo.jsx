// El logo de Micra: el termo rojo con tapa tinta y la «m.» crema
// (icono-micra/termo-rojo-kit). Los colores salen de la paleta fija, no del
// tema, para que sea el mismo de día y de noche, igual que el icono.

export default function Termo({ className = '' }) {
  const s = { stroke: '#1F2452', strokeWidth: 8, strokeLinejoin: 'round', strokeLinecap: 'round' };
  return (
    <svg className={`mapp-termo ${className}`} viewBox="56 14 88 178" aria-hidden="true">
      <g className="mapp-termo-cap">
        <path d="M74 22 L126 22 L129 50 L71 50 Z" fill="#1F2452" {...s} />
        <line x1="78" y1="32" x2="122" y2="32" stroke="#F5EFE4" strokeWidth="3" strokeLinecap="round" opacity=".35" />
      </g>
      <rect x="70" y="48" width="60" height="12" rx="4" fill="#FFFDF8" {...s} />
      <rect x="64" y="58" width="72" height="126" rx="18" fill="#DE1B1B" {...s} />
      <text x="94" y="137" textAnchor="middle" fontFamily="Archivo,Arial,sans-serif" fontWeight="800" fontSize="42" letterSpacing="-2" fill="#F5EFE4">m</text>
      <circle cx="119" cy="131.5" r="5.5" fill="#F5EFE4" />
      <rect x="120" y="68" width="7" height="24" rx="3.5" fill="#fff" opacity=".3" />
      <rect x="120" y="152" width="7" height="24" rx="3.5" fill="#fff" opacity=".3" />
    </svg>
  );
}

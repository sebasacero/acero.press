// Íconos a trazo de la app Micra (24 × 24, línea de 2 px, color del texto).

const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' };

export const IconNear = () => (
  <svg {...base}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></svg>
);
export const IconCup = () => (
  <svg {...base}><path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" /><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" /><path d="M9 3.5c-1 1.3 1 2 0 3.5M13 3.5c-1 1.3 1 2 0 3.5" /></svg>
);
export const IconOut = () => (
  <svg {...base}><path d="M7 17 17 7M9 7h8v8" /></svg>
);
export const IconThermo = () => (
  <svg {...base}><rect x="7" y="7" width="10" height="14" rx="2.5" /><path d="M8 7V5h8v2M7 12h10" /></svg>
);
export const IconList = () => (
  <svg {...base}><path d="M4 6h16M4 12h16M4 18h10" /></svg>
);
export const IconBars = () => (
  <svg {...base}><path d="M5 20v-8M10 20V6M15 20v-9M20 20V9" /></svg>
);
export const IconCheck = () => (
  <svg {...base} width={12} height={12} strokeWidth={2.6}><path d="m5 12.5 4 4L19 7" /></svg>
);

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
export const IconToday = () => (
  <svg {...base}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
);
export const IconClipboard = () => (
  <svg {...base}><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></svg>
);
export const IconCamera = () => (
  <svg {...base}><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.5" /></svg>
);
export const IconHome = () => (
  <svg {...base}><path d="M4 11 12 4.5 20 11v8a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></svg>
);
export const IconCap = () => (
  <svg {...base}><path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z" /><path d="M6.5 11v4.5c3 2.6 8 2.6 11 0V11M21.5 9v5" /></svg>
);
export const IconWallet = () => (
  <svg {...base}><rect x="3.5" y="6" width="17" height="13" rx="2.5" /><path d="M3.5 9.5h17M15.5 14h2" /></svg>
);
export const IconUser = () => (
  <svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>
);
export const IconBack = () => (
  <svg {...base}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
// Los de «Mi perfil»
export const IconQr = () => (
  <svg {...base}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2M20 14v2M14 20h2M18 18h2v2" /></svg>
);
export const IconShare = () => (
  <svg {...base}><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
);
export const IconEye = () => (
  <svg {...base}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconTag = () => (
  <svg {...base}><path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0z" /><circle cx="8" cy="8" r="1.5" /></svg>
);
export const IconCard = () => (
  <svg {...base}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></svg>
);
export const IconTarget = () => (
  <svg {...base}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
);
export const IconShield = () => (
  <svg {...base}><path d="M12 3 19.5 6v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></svg>
);
export const IconHelp = () => (
  <svg {...base}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="6.5" rx="1.6" /><rect x="17" y="13" width="4" height="6.5" rx="1.6" /><path d="M19 19.5c0 1.4-2.2 2.2-5 2.2" /></svg>
);
export const IconLock = () => (
  <svg {...base}><rect x="5" y="10.5" width="14" height="10" rx="2.2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2" /></svg>
);
export const IconVideo = () => (
  <svg {...base}><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="m16 10.5 5-3v9l-5-3z" /></svg>
);
export const IconCan = () => (
  <svg {...base}><path d="M7.5 5.5h9l-.5 15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" /><path d="M7.5 5.5 8.5 3h7l1 2.5M8 9.5h8M8.2 16.5h7.6" /></svg>
);
export const IconHeart = () => (
  <svg {...base}><path d="M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" /></svg>
);
export const IconGift = () => (
  <svg {...base}><rect x="4" y="9" width="16" height="11.5" rx="1.6" /><path d="M3.5 9h17v3.5h-17zM12 9v11.5" /><path d="M12 9C10.5 5.5 6.5 5 6.5 7.2S9.5 9 12 9zM12 9c1.5-3.5 5.5-4 5.5-1.8S14.5 9 12 9z" /></svg>
);
export const IconPin = () => (
  <svg {...base}><path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.4" /></svg>
);
export const IconBag = () => (
  <svg {...base}><path d="M5 8h14l-1.2 12.5H6.2z" /><path d="M9 10V6.5a3 3 0 0 1 6 0V10" /></svg>
);

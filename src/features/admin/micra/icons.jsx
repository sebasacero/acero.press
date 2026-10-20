// Íconos de Micra Studio: 24×24, trazo 1.8, como los de micraIcons.jsx.
// Son glifos genéricos (no logos de marcas).

const I = ({ children, size = 22, ...rest }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
    {children}
  </svg>
);

export const IconBack = (p) => <I {...p}><path d="M15 5l-7 7 7 7" /></I>;
export const IconClose = (p) => <I {...p}><path d="M6 6l12 12M18 6L6 18" /></I>;
export const IconUndo = (p) => <I {...p}><path d="M9 7H4V2" /><path d="M4.5 7A8 8 0 1 1 6 17.5" /></I>;
export const IconText = (p) => <I {...p}><path d="M4 19L9.5 5h1L16 19M6.3 14h7.4" /><path d="M17 11.5c0-1.4 1-2.2 2.3-2.2s2.2.8 2.2 2v6.7M21.5 15c-2.6 0-4.5.5-4.5 2.1 0 1 .8 1.6 1.9 1.6 1.6 0 2.6-1.3 2.6-3" /></I>;
export const IconSticker = (p) => <I {...p}><path d="M20 12.5V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h5.5z" /><path d="M20 12.5L12.5 20v-4.5a3 3 0 0 1 3-3z" /><circle cx="9" cy="9.5" r=".8" fill="currentColor" /><circle cx="14" cy="9.5" r=".8" fill="currentColor" /></I>;
export const IconLayers = (p) => <I {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></I>;
export const IconImage = (p) => <I {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-9 9" /></I>;
export const IconZones = (p) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" /><rect x="7" y="7" width="10" height="10" rx="1" /></I>;
export const IconEye = (p) => <I {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></I>;
export const IconEyeOff = (p) => <I {...p}><path d="M3 3l18 18" /><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></I>;
export const IconTrash = (p) => <I {...p}><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" /></I>;
export const IconCheck = (p) => <I {...p}><path d="M5 12.5l4.5 4.5L19 7" /></I>;
export const IconShare = (p) => <I {...p}><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></I>;
export const IconDownload = (p) => <I {...p}><path d="M12 3v12M7.5 10.5L12 15l4.5-4.5" /><path d="M4 19h16" /></I>;
export const IconChat = (p) => <I {...p}><path d="M4 20l1.4-4.2A8 8 0 1 1 8.6 19z" /><path d="M9 10.5c.3 1.6 2.1 3.4 3.8 3.8l1.2-1.2 2 .9c-.3 1.3-1.4 2-2.6 1.8-2.8-.5-5.2-2.9-5.7-5.7-.2-1.2.5-2.3 1.8-2.6l.9 2z" /></I>;
export const IconCamera = (p) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r=".9" fill="currentColor" /></I>;
export const IconGrid = (p) => <I {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></I>;
export const IconPlay = (p) => <I {...p}><path d="M8 5v14l11-7z" fill="currentColor" /></I>;
export const IconPause = (p) => <I {...p}><path d="M8 5v14M16 5v14" strokeWidth="3" /></I>;
export const IconFlip = (p) => <I {...p}><path d="M20 8h-6l2-3M4 16h6l-2 3" /><path d="M18.5 8A7.5 7.5 0 0 0 5 10M5.5 16A7.5 7.5 0 0 0 19 14" /></I>;
export const IconGallery = (p) => <I {...p}><rect x="3" y="6" width="15" height="14" rx="2.5" /><path d="M7 3h11a3 3 0 0 1 3 3v11" /><path d="M3 16.5l4-4 4 4 2-2 5 5" /></I>;
export const IconPin = (p) => <I {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></I>;
export const IconAt = (p) => <I {...p}><circle cx="12" cy="12" r="3.5" /><path d="M15.5 8.5v5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8" /></I>;
export const IconTag = (p) => <I {...p}><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.5" /></I>;
export const IconPlus = (p) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconMinus = (p) => <I {...p}><path d="M5 12h14" /></I>;
export const IconSize = (p) => <I {...p}><path d="M4 20L20 4M4 20v-6M4 20h6M20 4v6M20 4h-6" /></I>;
export const IconMove = (p) => <I {...p}><path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" /></I>;
export const IconReset = (p) => <I {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></I>;
export const IconStyle = (p) => <I {...p}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.2-1-1.4-1-2.4 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" fill="currentColor" /><circle cx="10" cy="7" r="1" fill="currentColor" /><circle cx="15" cy="7" r="1" fill="currentColor" /></I>;
export const IconCells = (p) => <I {...p}><rect x="3" y="7" width="18" height="10" rx="1" /><path d="M8 7v10M13 7v10M17 7v10" /></I>;
export const IconPen = (p) => <I {...p}><path d="M4 20l4-1L19 8l-3-3L5 16z" /><path d="M14 7l3 3" /></I>;
export const IconRuler = (p) => <I {...p}><path d="M3 17L17 3l4 4L7 21z" /><path d="M7 13l2 2M10 10l2 2M13 7l2 2" /></I>;
export const IconCompact = (p) => <I {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /></I>;
export const IconMoney = (p) => <I {...p}><path d="M12 3v18M16.5 7.5c-.6-1.4-2.3-2.3-4.5-2.3-2.6 0-4.3 1.3-4.3 3.2 0 4.4 9 2.4 9 7 0 1.9-1.9 3.4-4.7 3.4-2.3 0-4.1-1-4.7-2.6" /></I>;
export const IconSend = (p) => <I {...p}><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></I>;

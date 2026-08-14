import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import translations from './translations.js';

const LanguageContext = createContext(null);

export const LANGUAGES = [
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ja', label: 'JA', name: '日本語' },
];

const STORAGE_KEY = 'acero-press-lang';

function detectInitialLang() {
  if (typeof window === 'undefined') return 'es';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && translations[stored]) return stored;
  const browserLang = (navigator.language || 'es').slice(0, 2);
  if (translations[browserLang]) return browserLang;
  return 'es';
}

// Devuelve el valor en translations[lang] para una key tipo "cart.title",
// con fallback a español si falta la traducción en el idioma activo.
function lookup(lang, key) {
  const path = key.split('.');
  let node = translations[lang];
  for (const part of path) {
    node = node?.[part];
    if (node === undefined) break;
  }
  if (node !== undefined) return node;

  // fallback a español
  let fallback = translations.es;
  for (const part of path) fallback = fallback?.[part];
  return fallback ?? key;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (code) => {
    if (translations[code]) setLangState(code);
  };

  const t = useMemo(() => (key) => lookup(lang, key), [lang]);

  const value = { lang, setLang, t };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage debe usarse dentro de <LanguageProvider>');
  return ctx;
}

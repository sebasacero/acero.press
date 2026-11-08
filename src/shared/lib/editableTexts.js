import { useCallback, useEffect, useState } from 'react';
import { loadConfigKeys } from './appConfig.js';
import { useLanguage } from '../../features/i18n/LanguageContext.jsx';

/**
 * Textos de una sección que se pueden cambiar con el lápiz (SectionEditButton).
 * Lee de app_config las llaves `${key}_${idioma}`; si no hay valor guardado, se
 * usa el texto de translations.js. Devuelve [text(key, fallback), reload].
 */
export function useEditableTexts(keys) {
  const { lang } = useLanguage();
  const [values, setValues] = useState({});
  const list = keys.join('|');

  const reload = useCallback(async () => {
    const wanted = list.split('|').map((k) => `${k}_${lang}`);
    // Junto con las demás secciones que piden app_config al abrir (appConfig.js)
    const { error, values } = await loadConfigKeys(wanted);
    if (error) return;
    const next = {};
    Object.entries(values).forEach(([key, value]) => {
      if (value) next[key.slice(0, -(lang.length + 1))] = value;
    });
    setValues(next);
  }, [list, lang]);

  useEffect(() => { reload(); }, [reload]);

  const text = useCallback((key, fallback) => values[key] ?? fallback, [values]);
  return [text, reload];
}

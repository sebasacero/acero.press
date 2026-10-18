import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
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
    const { data, error } = await supabase.from('app_config').select('key, value').in('key', wanted);
    if (error) return;
    const next = {};
    (data ?? []).forEach((row) => {
      if (row.value) next[row.key.slice(0, -(lang.length + 1))] = row.value;
    });
    setValues(next);
  }, [list, lang]);

  useEffect(() => { reload(); }, [reload]);

  const text = useCallback((key, fallback) => values[key] ?? fallback, [values]);
  return [text, reload];
}

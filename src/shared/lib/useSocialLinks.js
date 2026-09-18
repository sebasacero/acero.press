import { useState, useEffect } from 'react';
import { fetchAppConfig } from './appConfig.js';

const FALLBACKS = {
  social_facebook: 'https://www.facebook.com/share/1Duyj9kPXF/?mibextid=wwXIfr',
  social_instagram: 'https://www.instagram.com/aceropress',
  social_tiktok: 'https://tiktok.com/@acero.press',
  social_youtube: 'https://www.youtube.com/channel/UCPbb5qIUVjBZ2896RW2Ko8Q',
};

/**
 * Trae las 4 URLs de redes sociales desde Supabase (editables en /admin →
 * Configuración), con respaldo por si la tabla no responde a tiempo.
 */
export function useSocialLinks() {
  const [links, setLinks] = useState({
    facebook: FALLBACKS.social_facebook,
    instagram: FALLBACKS.social_instagram,
    tiktok: FALLBACKS.social_tiktok,
    youtube: FALLBACKS.social_youtube,
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchAppConfig('social_facebook', FALLBACKS.social_facebook),
      fetchAppConfig('social_instagram', FALLBACKS.social_instagram),
      fetchAppConfig('social_tiktok', FALLBACKS.social_tiktok),
      fetchAppConfig('social_youtube', FALLBACKS.social_youtube),
    ]).then(([facebook, instagram, tiktok, youtube]) => {
      if (active) setLinks({ facebook, instagram, tiktok, youtube });
    });
    return () => {
      active = false;
    };
  }, []);

  return links;
}

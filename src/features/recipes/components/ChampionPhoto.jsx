import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { championOf } from '../data/champions.js';

// Foto del campeón desde el sitio oficial del WAC, con crédito y enlace a la
// final. Si la foto no carga (el WAC la movió), no queda un hueco roto.
// `load` en falso deja el lugar sin pedir la imagen (banners no visibles).
export default function ChampionPhoto({ recipe, className = '', load = true }) {
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  const champ = championOf(recipe.year);
  if (!champ || failed) return null;

  return (
    <figure className={`champ ${className}`}>
      <div className="champ-img">
        {load && (
          <img
            src={champ.photo}
            alt={t('champ.alt').replace('{name}', recipe.name).replace('{year}', recipe.year)}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <figcaption>
        <a href={champ.final} target="_blank" rel="noopener noreferrer">
          {t('champ.photo')}: {champ.credit} ↗
        </a>
      </figcaption>
    </figure>
  );
}

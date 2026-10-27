import { useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { championOf, embedOf } from '../data/champions.js';

// Botón «▶ video» del campeón y su ventana. El reproductor (YouTube sin cookies o
// Vimeo) solo se pide al abrir: el carrusel no carga nada de terceros hasta el clic.
export default function ChampionVideo({ recipe, className = '' }) {
  const { t } = useLanguage();
  const dialog = useRef(null);
  const [open, setOpen] = useState(false);
  const champ = championOf(recipe.year);
  const src = embedOf(champ?.video);
  if (!src) return null;
  const label = t(`champ.videoKind.${champ.videoKind}`);

  const show = () => { setOpen(true); dialog.current?.showModal?.(); };
  const close = () => { dialog.current?.close?.(); setOpen(false); };

  return (
    <>
      <button type="button" className={`champ-play ${className}`} onClick={show}>
        <span className="champ-play-icon" aria-hidden="true">▶</span>
        {label}
      </button>
      <dialog
        ref={dialog}
        className="champ-video"
        aria-label={`${label} · ${recipe.name} ${recipe.year}`}
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      >
        <div className="champ-video-frame">
          {open && (
            <iframe
              src={src}
              title={`${label} · ${recipe.name} ${recipe.year}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
        <div className="champ-video-bar">
          <a href={champ.video} target="_blank" rel="noopener noreferrer">{t('champ.videoBy')}: {champ.videoBy} ↗</a>
          <button type="button" onClick={close}>{t('modal.close')} ✕</button>
        </div>
      </dialog>
    </>
  );
}

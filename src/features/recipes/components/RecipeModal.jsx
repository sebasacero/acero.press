import { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import RecipeKit from './RecipeKit.jsx';
import RecipeSheet from './RecipeSheet.jsx';

export default function RecipeModal({ recipe, pairing, focusKit = false, onClose }) {
  const dialogRef = useRef(null);
  const { t } = useLanguage();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (recipe && !dialog.open) dialog.showModal();
    if (!recipe && dialog.open) dialog.close();
  }, [recipe]);

  if (!recipe) return null;

  return (
    <dialog ref={dialogRef} className="recipe-modal-banner" onClose={onClose}>
      <div className="modal-container">
        <button className="modal-close" onClick={onClose} aria-label={t('modal.close')}>×</button>
        {/* Solo nuestra hoja ilustrada y, al lado, el kit recomendado para comprar. */}
        <div className={`modal-split ${pairing ? '' : 'is-solo'}`}>
          <RecipeSheet recipe={recipe} />
          {pairing && (
            <aside className="modal-kit-col">
              <RecipeKit key={recipe.year} pairing={pairing} recipe={recipe} autoFocus={focusKit} />
            </aside>
          )}
        </div>
      </div>
    </dialog>
  );
}

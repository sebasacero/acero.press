import { LANGUAGES, useLanguage } from './LanguageContext.jsx';

export default function LanguageSwitcher({ variant = 'light' }) {
  const { lang, setLang } = useLanguage();

  const currentIndex = LANGUAGES.findIndex((l) => l.code === lang);
  const current = LANGUAGES[currentIndex >= 0 ? currentIndex : 0];
  const next = LANGUAGES[(currentIndex + 1 + LANGUAGES.length) % LANGUAGES.length];

  const cycleLang = () => setLang(next.code);

  return (
    <div className={`lang-switcher lang-switcher--${variant}`}>
      <button
        type="button"
        className="lang-btn lang-btn--single is-active"
        onClick={cycleLang}
        aria-label={`Idioma / Language / 言語: ${current.name}. ${'Cambiar a'} ${next.name}`}
        title={`${current.name} → ${next.name}`}
      >
        {current.label}
      </button>
    </div>
  );
}

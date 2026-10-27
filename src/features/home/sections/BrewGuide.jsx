import { useLanguage } from '../../i18n/LanguageContext.jsx';
import StepScrolly from './StepScrolly.jsx';

// Aprende: la hoja de instrucciones de AeroPress Go, en diez pasos con su dibujo, contada con el
// scroll: la hoja queda fija en pantalla y cada tramo de scroll pasa al siguiente paso (dibujo
// grande, número y texto). Ocupa una pantalla en vez de la hoja entera. Caliente en rojo y cold
// brew en tinta, como en la hoja. Los diez pasos siguen en la lista (los no activos, transparentes)
// para lectores de pantalla. La Escuela (/escuela) tiene el cronómetro y lo demás.
export default function BrewGuide() {
  const { t } = useLanguage();
  return (
    <StepScrolly
      id="escuela"
      tag={t('brew.tag')}
      badge={t('brew.badge')}
      title={t('brew.title')}
      script={t('brew.script')}
      legend={{ hot: t('brew.hot'), cold: t('brew.cold') }}
      steps={t('brew.steps')}
      labels={{ dots: t('brew.dots'), goStep: t('brew.goStep'), swipe: t('brew.swipe') }}
      source={t('brew.source')}
      ctas={(
        <>
          <a className="essp-btn" href="/escuela#leccion-2">{t('brew.cta')} →</a>
          <a className="essp-btn is-ghost" href="/escuela">{t('brew.cta2')}</a>
        </>
      )}
    />
  );
}

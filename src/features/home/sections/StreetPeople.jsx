import { useLanguage } from '../../i18n/LanguageContext.jsx';

// Las personas de la calle (ilustraciones a tinta, beige y rojo) paradas sobre un andén dibujado.
// Son personajes, no gente del estudio: los datos y fotos del estudio nunca salen en público.
// En celular la fila se desliza de lado, como las fichas de redes; nada se mueve solo.
export const PEOPLE = ['carrito', 'aeropress', 'ruana', 'ruta', 'pareja', 'sombrilla'];
export const personaSrc = (name) => `/image/personas/${name}.webp`;

export default function StreetPeople() {
  const { t } = useLanguage();
  const items = t('people.items');
  return (
    <div className="people" aria-labelledby="people-title">
      <div className="people-head">
        <div className="essp-tag">{t('people.tag')}</div>
        <h3 className="people-title" id="people-title">{t('people.title')}</h3>
        <p className="people-text">{t('people.text')}</p>
      </div>
      <ul className="people-row">
        {PEOPLE.map((name, i) => (
          <li key={name} className={`people-item people-item--${name}`}>
            <img src={personaSrc(name)} alt="" loading="lazy" decoding="async" />
            <span>{items[i]}</span>
          </li>
        ))}
      </ul>
      <p className="people-note">{t('people.note')}</p>
    </div>
  );
}

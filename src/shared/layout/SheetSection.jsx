import { SheetFrame, useClock } from '../../features/esspresale/parts.jsx';
import { useLanguage } from '../../features/i18n/LanguageContext.jsx';
import '../../features/esspresale/esspresale.css';
import './sheet.css';

/**
 * Envuelve una sección del sitio en la hoja de plano de los formatos de redes:
 * marco doble con zonas, cota FIG. arriba y cajetín abajo.
 * tone: 'paper' (tinta sobre papel cuadriculado) | 'photo' (crema sobre fondo oscuro).
 * name: clave en translations (sheet.<name>.label / .maker → celda PREPARA del cajetín).
 */
export default function SheetSection({ fig, name, tone = 'paper', className = '', children }) {
  const { t } = useLanguage();
  const label = t(`sheet.${name}.label`);
  const maker = t(`sheet.${name}.maker`);
  const { time, date } = useClock();
  return (
    <div className={`sheet-sec sheet-sec--${tone} ${className}`}>
      <SheetFrame />
      <div className="sheet-sec-head">
        <span className="sheet-sec-fig">{fig}</span>
        <span className="sheet-sec-label">{label}</span>
        <span className="sheet-sec-loc">{t('location')}</span>
      </div>
      <hr className="essp-dash sheet-sec-dash" />
      <div className="sheet-sec-body">{children}</div>
      <div className="essp-block sheet-sec-block">
        <div><span>{t('essp.block.zone')}</span><b>Chapinero</b></div>
        <div><span>{t('essp.block.time')}</span><b>{time}</b></div>
        <div><span>{t('essp.block.date')}</span><b>{date}</b></div>
        <div><span>{t('essp.block.maker')}</span><b className="is-red">{maker}</b></div>
      </div>
    </div>
  );
}

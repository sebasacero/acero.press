import { useLanguage } from '../../i18n/LanguageContext.jsx';
import MapCanvas from '../../esspresale/MapCanvas.jsx';

// Los dos banners que tenía la portada antes del rediseño, con sus textos de siempre:
// «Pide café en AeroPress a domicilio» (sobre el plano) y «Vive del café con tu AeroPress»
// (sobre la foto de la barra). Pedido del usuario: que esa información se quede.
const MAP_VIEW = (w) => ({ style: 'plano', c: 12, k: 82, ax: 0.75, ay: 0.55, s: Math.max(8, w / 70), heat: 0.7 });

export default function MicraPromos({ wa }) {
  const { t } = useLanguage();
  const p = (kind, key) => t(`micra.promos.${kind}.${key}`);

  return (
    <div className="micra-promos">
      {['order', 'barista'].map((kind) => {
        const isOrder = kind === 'order';
        const title = p(kind, 'title');
        return (
          <article key={kind} className={`micra-promo micra-promo--${kind}`}>
            <div className="micra-promo-bg" aria-hidden="true">
              {isOrder ? <><MapCanvas view={MAP_VIEW} /><div className="essp-paper-fade" /></> : <div className="essp-photo" />}
            </div>
            <div className="micra-promo-in">
              <div className="essp-tag">{p(kind, 'tag')} <span className="essp-new">{p(kind, 'badge')}</span></div>
              <h2 className="essp-title micra-promo-title">
                {title[0]}<br />{title[1]}
                <span className="essp-script">{p(kind, 'script')}</span>
              </h2>
              <div className="essp-loc">{p(kind, 'loc')}</div>
              <p className="essp-lede">{p(kind, 'lede')}</p>
              <div className="essp-ctas">
                {isOrder ? (
                  <>
                    <a className="essp-btn" href="#beans">{p(kind, 'cta')}</a>
                    <a className="essp-btn is-ghost" href="#escuela">{p(kind, 'cta2')}</a>
                  </>
                ) : (
                  <>
                    <a className="essp-btn" href={wa(p(kind, 'waMsg'))} target="_blank" rel="noopener noreferrer">{p(kind, 'cta')}</a>
                    <a className="essp-btn is-ghost" href="/escuela">{p(kind, 'cta2')}</a>
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import SectionEditButton from '../../admin/SectionEditButton.jsx';
import { useEditableTexts } from '../../../shared/lib/editableTexts.js';
import { personaSrc } from './StreetPeople.jsx';

// Las dos puertas: los dos banners de siempre («Pide café en AeroPress a domicilio» y «Vive del
// café con tu AeroPress»), ya no en carrusel sino a la vez, lado a lado (pedido del usuario,
// 10 nov 2026). Los títulos se siguen cambiando con el lápiz (app_config essp_<banner>_*).
const fields = (kind) => [
  { key: `essp_${kind}_title1`, label: 'Título · línea 1' },
  { key: `essp_${kind}_title2`, label: 'Título · línea 2' },
  { key: `essp_${kind}_script`, label: 'Palabra a mano' },
  { key: `essp_${kind}_lede`, label: 'Texto', multiline: true },
];
const BARISTA_HASHES = ['#baristas', '#tinteros'];

/** Agrega `is-on` cuando el elemento entra a la pantalla y lo quita al salir: la animación se repite. */
export function useSeen(threshold = 0.6) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= threshold) setOn(true);
      else if (!e.isIntersecting) setOn(false);
    }, { threshold: [0, threshold] });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, on];
}

function Door({ kind, href, img, focus }) {
  const { t } = useLanguage();
  const [text, reload] = useEditableTexts(['title1', 'title2', 'script', 'lede'].map((f) => `essp_${kind}_${f}`));
  const base = (k) => t(`essp.${kind}.${k}`);
  const d = t(`page.doors.${kind}`);
  const [ref, on] = useSeen(0.9);
  const root = useRef(null);
  useEffect(() => { if (focus) root.current?.scrollIntoView({ block: 'center' }); }, [focus]);
  const order = kind === 'order';
  // «Vive del café.» pierde el punto: aquí el título sigue con «con tu AeroPress»
  const t1 = text(`essp_${kind}_title1`, base('title')[0]), t2 = text(`essp_${kind}_title2`, base('title')[1]).replace(/\.$/, '');
  const script = text(`essp_${kind}_script`, base('script'));
  return (
    <article ref={root} className={`pg-door pg-door--${order ? 'c' : 'b'}${focus ? ' is-focus' : ''}`} data-door={kind}>
      <SectionEditButton section={t(`essp.tabs.${kind}`)} fig={base('tag')} placement="hero" fields={fields(kind)} onSaved={reload} />
      <div className="pg-door-txt">
        <span className="pg-world"><i />{d.world}</span>
        <h3 ref={ref}>
          {t1} {t2}{' '}
          <em className={order ? `pg-escrito${on ? ' is-on' : ''}` : 'pg-grad'}>{script}</em>
        </h3>
        <p>{text(`essp_${kind}_lede`, d.lede)}</p>
        <a className="pg-btn pg-btn--hot pg-btn--live" href={href}>{d.cta}</a>
        <ul>{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </div>
      <img src={img} alt="" loading="lazy" decoding="async" />
    </article>
  );
}

export default function Doors() {
  const { t } = useLanguage();
  // #baristas (el menú, un enlace compartido) y el viejo #tinteros señalan la puerta del barista
  const [barista, setBarista] = useState(() => BARISTA_HASHES.includes(window.location.hash));
  useEffect(() => {
    const onHash = () => setBarista(BARISTA_HASHES.includes(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const title = t('page.doors.title');
  return (
    <section className="pg-doors" id="baristas" aria-labelledby="pg-doors-title">
      <div className="pg-w">
        <div className="pg-aviso">
          <h2 id="pg-doors-title">{title[0]} <em>{title[1]}</em></h2>
          <p>{t('page.doors.text')}</p>
        </div>
        <div className="pg-pair">
          <Door kind="order" href="/micra" img="/image/personas/lata-termo.webp" />
          <Door kind="barista" href="/micra/barista" img={personaSrc('sombrilla')} focus={barista} />
        </div>
      </div>
    </section>
  );
}

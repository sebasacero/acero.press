import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../../cart/context/CartContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { isDevice } from '../../../shared/lib/pairing.js';

const FALLBACK_IMG = '/image/bagsbeans.png';
const money = (n) => `$${Number(n).toLocaleString('es-CO')}`;
const sizeName = (s, t) => (s === '18G' ? t('shop.sachet') : s);
const firstSize = (p) => p.sizes.find((s) => p.prices[s] != null) ?? p.sizes[0];
const coffeeSize = (p) => (p.prices['250G'] != null ? '250G' : firstSize(p));

/**
 * Pestaña "Kit" de la tienda: el cliente arma su combinación de AeroPress
 * (o "ya tengo una"), una bolsa de café en el tamaño que quiera y extras del
 * equipo (filtros, tapas…). "Añadir kit" mete cada pieza al carrito.
 */
export default function KitBuilder({ coffee, gear }) {
  const { addItem, open } = useCart();
  const { t } = useLanguage();
  const devices = useMemo(() => gear.filter(isDevice), [gear]);
  const extras = useMemo(() => gear.filter((p) => !isDevice(p)), [gear]);

  const [deviceId, setDeviceId] = useState(null); // null = ya tengo una
  const [coffeeId, setCoffeeId] = useState(null);
  const [size, setSize] = useState(null);
  const [extraIds, setExtraIds] = useState([]);
  const [added, setAdded] = useState(false);

  // Por defecto: la prensa más económica, el primer café en 250G y el filtro más económico.
  useEffect(() => {
    const cheapest = (list) => [...list].sort((a, b) => a.prices[firstSize(a)] - b.prices[firstSize(b)])[0];
    setDeviceId((id) => id ?? cheapest(devices)?.id ?? null);
    setExtraIds((ids) => (ids.length ? ids : [cheapest(extras.filter((p) => /filtro|filter/i.test(p.name)))?.id].filter(Boolean)));
  }, [devices, extras]);
  useEffect(() => {
    if (!coffeeId && coffee[0]) {
      setCoffeeId(coffee[0].id);
      setSize(coffeeSize(coffee[0]));
    }
  }, [coffee, coffeeId]);

  const device = devices.find((p) => p.id === deviceId) ?? null;
  const bag = coffee.find((p) => p.id === coffeeId) ?? null;
  const pieces = [
    device && { p: device, size: firstSize(device) },
    bag && { p: bag, size },
    ...extras.filter((p) => extraIds.includes(p.id)).map((p) => ({ p, size: firstSize(p) })),
  ].filter((x) => x && x.p.prices[x.size] != null);
  const total = pieces.reduce((sum, x) => sum + x.p.prices[x.size], 0);

  const pickCoffee = (p) => {
    setCoffeeId(p.id);
    setSize((s) => (p.prices[s] != null ? s : coffeeSize(p)));
  };
  const toggleExtra = (id) => setExtraIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const addKit = () => {
    if (!bag || !pieces.length) return;
    pieces.forEach(({ p, size: s }) =>
      addItem({
        name: p.brand ? `${p.name} · ${p.brand}` : p.name,
        price: p.prices[s],
        variant: s,
        qty: 1,
        image: p.image,
        variantId: p.variantIds[s],
      })
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
    open();
  };

  const option = (p, selected, onClick, extra) => (
    <button key={p.id} type="button" className={`kitb-option ${selected ? 'is-on' : ''}`} aria-pressed={selected} onClick={onClick}>
      <img src={p.image || FALLBACK_IMG} alt="" loading="lazy" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
      <span className="kitb-option-text">
        <b>{p.name}</b>
        <small>{extra ?? money(p.prices[firstSize(p)])}</small>
      </span>
    </button>
  );

  return (
    <div className="kitb">
      <section className="kitb-step" aria-labelledby="kitb-device">
        <h3 id="kitb-device"><span>01</span>{t('shop.kitDevice')}</h3>
        <div className="kitb-options">
          {devices.map((p) => option(p, deviceId === p.id, () => setDeviceId(p.id)))}
          <button type="button" className={`kitb-option is-plain ${deviceId === null ? 'is-on' : ''}`} aria-pressed={deviceId === null} onClick={() => setDeviceId(null)}>
            <span className="kitb-option-text"><b>{t('shop.kitHave')}</b><small>{money(0)}</small></span>
          </button>
        </div>
        {devices.length === 0 && <p className="kitb-note">{t('shop.kitNoGear')}</p>}
      </section>

      <section className="kitb-step" aria-labelledby="kitb-coffee">
        <h3 id="kitb-coffee"><span>02</span>{t('shop.kitCoffee')}</h3>
        <div className="kitb-options">
          {coffee.map((p) => option(p, coffeeId === p.id, () => pickCoffee(p), p.region ?? p.variety ?? ''))}
        </div>
        {bag && (
          <div className="shop-card-sizes kitb-sizes" role="group" aria-label={t('product.size')}>
            {bag.sizes.filter((s) => bag.prices[s] != null).map((s) => (
              <button key={s} type="button" className={`shop-size ${size === s ? 'active' : ''}`} aria-pressed={size === s} onClick={() => setSize(s)}>
                {sizeName(s, t)} · {money(bag.prices[s])}
              </button>
            ))}
          </div>
        )}
      </section>

      {extras.length > 0 && (
        <section className="kitb-step" aria-labelledby="kitb-extras">
          <h3 id="kitb-extras"><span>03</span>{t('shop.kitExtras')}</h3>
          <div className="kitb-extras">
            {extras.map((p) => (
              <label key={p.id} className="kitb-extra">
                <input type="checkbox" checked={extraIds.includes(p.id)} onChange={() => toggleExtra(p.id)} />
                <span>{p.name}</span>
                <em>{money(p.prices[firstSize(p)])}</em>
              </label>
            ))}
          </div>
        </section>
      )}

      <div className="kitb-summary" aria-live="polite">
        <ul>
          {pieces.map(({ p, size: s }) => (
            <li key={p.id}><span>{p.name}{p.sizes.length > 1 ? ` · ${sizeName(s, t)}` : ''}</span><b>{money(p.prices[s])}</b></li>
          ))}
        </ul>
        <div className="kitb-total">
          <span>{t('shop.kitTotal')}</span>
          <b>{money(total)}</b>
        </div>
        <button type="button" className={`shop-add kitb-add ${added ? 'added' : ''}`} disabled={!bag} onClick={addKit}>
          {added ? t('shop.kitAdded') : t('shop.kitAdd')}
        </button>
      </div>
    </div>
  );
}

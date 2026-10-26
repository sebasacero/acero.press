import { useState, useEffect, useRef, useMemo } from 'react';
import { useCart } from '../../cart/context/CartContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { fetchCoffeeVarieties, fetchAeropressProducts } from '../../../shared/lib/catalog.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';
import KitBuilder from './KitBuilder.jsx';
import { isDevice } from '../../../shared/lib/pairing.js';

const FALLBACK_IMG = '/image/bagsbeans.png';
const sizeName = (s, t) => (s === '18G' ? t('shop.sachet') : s);
const money = (n) => (n != null ? `$${Number(n).toLocaleString('es-CO')}` : null);

// Dibujos de las tres opciones (trazo, sin fotos que dependan del catálogo)
const CHOICE_ICONS = {
  coffee: <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M13 10h22l3 6v24a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V16z" /><path d="M10 16h28" /><ellipse cx="24" cy="29" rx="4.5" ry="6.5" transform="rotate(25 24 29)" /><path d="M21.5 24.5c2 2.5 3 6 2.5 9.5" /></svg>,
  gear: <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><rect x="16" y="4" width="16" height="6" rx="1.5" /><path d="M18 10h12v22H18z" /><path d="M12 32h24l-3 5H15z" /><path d="M14 44h20" /><path d="M21 16h6M21 21h6M21 26h6" /></svg>,
  kit: <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M6 18h36v22a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" /><path d="M4 12h40v6H4z" /><path d="M24 12v30" /><path d="M24 12c-3-6-10-7-10-3s7 3 10 3c3 0 10 1 10-3s-7-3-10 3" /></svg>,
};

const minPrice = (list) => {
  const all = list.flatMap((p) => Object.values(p.prices).filter((v) => v != null));
  return all.length ? Math.min(...all) : null;
};

/**
 * Tienda: primero la pregunta, «¿qué quieres llevar?», con tres respuestas grandes (Café,
 * AeroPress, Kit) y su precio desde; después las tarjetas de esa opción. En Café, con muchas
 * bolsas, se filtra por variedad y región. Cada tarjeta añade al carrito; la barra de compra
 * trabaja sobre el producto seleccionado con cantidad, "Comprar" y "Comprar con tarjeta".
 */
export default function ProductSection() {
  const { addItem, buyNow, buyNowCard } = useCart();
  const { t } = useLanguage();
  const [coffee, setCoffee] = useState([]);
  const [gear, setGear] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sizes, setSizes] = useState({}); // id → tamaño elegido en su tarjeta
  const [selectedId, setSelectedId] = useState(null);
  const [qty, setQty] = useState(1);
  const [addedId, setAddedId] = useState(null);
  const [tab, setTab] = useState('coffee');
  const [variety, setVariety] = useState('');
  const [region, setRegion] = useState('');
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    let active = true;
    Promise.all([fetchCoffeeVarieties(), fetchAeropressProducts()]).then(([c, g]) => {
      if (!active) return;
      setCoffee(c);
      setGear(g);
      setSelectedId((id) => id ?? c[0]?.id ?? g[0]?.id ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const all = [...coffee, ...gear];

  // Opciones de los filtros: la región depende de la variedad elegida, así nunca queda vacía.
  const uniq = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const varietyOptions = useMemo(() => uniq(coffee.map((p) => p.variety)), [coffee]);
  const regionOptions = useMemo(
    () => uniq(coffee.filter((p) => !variety || p.variety === variety).map((p) => p.region)),
    [coffee, variety]
  );
  const shown = tab === 'gear'
    ? gear
    : coffee.filter((p) => (!variety || p.variety === variety) && (!region || p.region === region));

  const updateEdges = () => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: 0 });
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [tab, variety, region, loading]);
  const slide = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('.shop-card');
    const step = card ? card.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step * Math.max(1, Math.floor(el.clientWidth / step)), behavior: 'smooth' });
  };
  const pickVariety = (v) => {
    setVariety(v);
    if (region && !coffee.some((p) => (!v || p.variety === v) && p.region === region)) setRegion('');
  };
  // Por defecto la bolsa de 250G; el sachet de 18G queda como opción.
  const sizeOf = (p) => sizes[p.id] ?? (p.prices['250G'] != null ? '250G' : p.sizes.find((s) => p.prices[s] != null) ?? p.sizes[0]);
  const itemFor = (p, quantity) => {
    const size = sizeOf(p);
    return {
      name: p.brand ? `${p.name} · ${p.brand}` : p.name,
      price: p.prices[size],
      variant: size,
      qty: quantity,
      image: p.image,
      variantId: p.variantIds[size],
    };
  };

  // «Desde»: el café en su bolsa de 250 g (el sachet no es la compra de la tienda); el kit, como lo
  // arma KitBuilder por defecto: la prensa más barata, la bolsa más barata y los filtros de papel
  const bagFrom = minPrice(coffee.map((p) => ({ prices: { bag: p.prices['250G'] ?? minPrice([p]) } })));
  const devices = gear.filter(isDevice);
  const paper = gear.filter((p) => !isDevice(p) && /papel|paper/i.test(p.name));
  const kitFrom = bagFrom != null ? bagFrom + (minPrice(devices) ?? 0) + (minPrice(paper) ?? 0) : null;
  const choices = [
    { id: 'coffee', from: bagFrom },
    { id: 'gear', from: minPrice(gear) },
    { id: 'kit', from: kitFrom, badge: t('shopx.kit.badge') },
  ];

  const selected = all.find((p) => p.id === selectedId) ?? null;
  const selectedItem = selected ? itemFor(selected, qty) : null;
  const canBuy = selectedItem?.price != null;

  const choose = (p) => {
    if (p.id !== selectedId) setQty(1);
    setSelectedId(p.id);
  };

  const handleAdd = (p) => {
    const item = itemFor(p, p.id === selectedId ? qty : 1);
    if (item.price == null) return;
    addItem(item);
    choose(p);
    setAddedId(p.id);
    setTimeout(() => setAddedId((id) => (id === p.id ? null : id)), 1000);
  };

  const card = (p) => {
    const size = sizeOf(p);
    const price = p.prices[size];
    const isSel = p.id === selectedId;
    const showSizes = p.sizes.length > 1;
    return (
      <article
        key={p.id}
        className={`shop-card ${isSel ? 'is-selected' : ''}`}
        onClick={() => choose(p)}
      >
        <div className="shop-card-media">
          <img
            src={p.image || FALLBACK_IMG}
            alt={`${p.name} - ${size}`}
            loading="lazy"
            onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
          />
        </div>
        {(p.brand || p.region) && (
          <span className="shop-card-brand">{[p.brand, p.region].filter(Boolean).join(' · ')}</span>
        )}
        <h3 className="shop-card-name" title={p.description ?? undefined}>
          {p.name}{showSizes || size ? <span> ({sizeName(size, t)})</span> : null}
        </h3>
        <p className={`shop-card-price ${price == null ? 'is-na' : ''}`}>{money(price) ?? t('shop.unavailable')}</p>

        {showSizes && (
          <div className="shop-card-sizes" role="group" aria-label={t('product.size')}>
            {p.sizes.map((s) => (
              <button
                key={s}
                type="button"
                className={`shop-size ${size === s ? 'active' : ''}`}
                aria-pressed={size === s}
                onClick={(e) => { e.stopPropagation(); setSizes((m) => ({ ...m, [p.id]: s })); choose(p); }}
                title={s === '18G' ? t('shop.sachetHint') : undefined}
              >
                {sizeName(s, t)}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={`shop-add ${addedId === p.id ? 'added' : ''}`}
          disabled={price == null}
          onClick={(e) => { e.stopPropagation(); handleAdd(p); }}
        >
          {addedId === p.id ? t('product.added') : t('product.addToCart')}
        </button>
      </article>
    );
  };

  return (
    <section className="product-section shop" id="beans">
      <SectionEditButton section="Catálogo de café" toolId="catalog" />

      <div className="shop-inner">
        <div className="shop-rule" aria-hidden="true"><span /></div>
        <p className="shop-kicker">{t('shop.kicker')}</p>

        <h2 className="shop-title">{t('shopx.title')}</h2>
        <p className="shop-sub shop-sub--lead">{t('shopx.sub')}</p>

        <div className="shop-choices" role="tablist" aria-label={t('shopx.title')}>
          {choices.map(({ id, from, badge }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} aria-controls="shop-panel"
              className={`shop-choice shop-choice--${id}${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>
              {badge && <span className="shop-choice-badge">{badge}</span>}
              <span className="shop-choice-icon" aria-hidden="true">{CHOICE_ICONS[id]}</span>
              <b>{t(`shopx.${id}.title`)}</b>
              <small>{t(`shopx.${id}.text`)}</small>
              <em>{loading ? '…' : from != null ? `${t('shopx.from')} ${money(from)}` : t('shopx.soon')}</em>
            </button>
          ))}
        </div>

        <div id="shop-panel" role="tabpanel" className="shop-panel">
        {tab === 'coffee' && coffee.length > 4 && (varietyOptions.length > 0 || regionOptions.length > 0) && (
          <div className="shop-filters">
            {varietyOptions.length > 0 && (
              <label className="shop-filter">
                <span>{t('shop.variety')}</span>
                <select value={variety} onChange={(e) => pickVariety(e.target.value)}>
                  <option value="">{t('shop.allVarieties')}</option>
                  {varietyOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            )}
            {regionOptions.length > 0 && (
              <label className="shop-filter">
                <span>{t('shop.region')}</span>
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="">{t('shop.allRegions')}</option>
                  {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            )}
            {(variety || region) && (
              <button type="button" className="shop-filter-clear" onClick={() => { setVariety(''); setRegion(''); }}>
                {t('shop.clear')}
              </button>
            )}
          </div>
        )}

        {loading ? (
          <p className="shop-empty">{t('shop.loading')}</p>
        ) : tab === 'kit' ? (
          <KitBuilder coffee={coffee} gear={gear} />
        ) : tab === 'gear' && gear.length === 0 ? (
          <div className="shop-soon">
            <svg viewBox="0 0 64 96" width="40" height="60" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="14" y="4" width="36" height="10" rx="2" />
              <rect x="18" y="14" width="28" height="44" />
              <path d="M10 58h44l-4 10H14z" />
              <path d="M22 68v8h20v-8" />
              <path d="M8 86h48" />
            </svg>
            <p>{t('shop.gearSoon')}</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="shop-empty">
            {coffee.length === 0 ? t('shop.empty') : t('shop.noMatch')}{' '}
            {coffee.length > 0 && (
              <button type="button" className="shop-filter-clear" onClick={() => { setVariety(''); setRegion(''); }}>{t('shop.clear')}</button>
            )}
          </p>
        ) : (
          <div className={`shop-carousel ${edges.start && edges.end ? 'is-static' : ''}`}>
            <button type="button" className="shop-arrow prev" aria-label={t('shop.prev')} disabled={edges.start} onClick={() => slide(-1)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className="shop-track" ref={trackRef} onScroll={updateEdges}>
              {shown.map(card)}
            </div>
            <button type="button" className="shop-arrow next" aria-label={t('shop.next')} disabled={edges.end} onClick={() => slide(1)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        )}

        {/* Barra de compra del producto seleccionado: los mismos botones de siempre. */}
        {selected && tab !== 'kit' && (
          <div className="shop-buybar" aria-live="polite">
            <div className="shop-buybar-item">
              <img src={selected.image || FALLBACK_IMG} alt="" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
              <div>
                <span className="shop-buybar-label">{t('shop.selected')}</span>
                <strong>{selected.name} · {sizeName(sizeOf(selected), t)}</strong>
                <span className="shop-buybar-price">{money(selectedItem.price && selectedItem.price * qty) ?? t('shop.unavailable')}</span>
              </div>
            </div>

            <div className="shop-buybar-actions">
              <div className="quantity-selector">
                <button className="qty-btn" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span className="qty-number">{qty}</span>
                <button className="qty-btn" aria-label="Increase quantity" onClick={() => setQty((q) => q + 1)}>+</button>
              </div>
              <div className="buy-now-row">
                <button className="btn-buy-shop" disabled={!canBuy} onClick={() => buyNow(selectedItem)}>
                  <svg className="btn-buy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                  </svg>
                  <span className="btn-buy-text">{t('product.buy')}</span>
                </button>
                <button className="btn-buy-shop btn-buy-card" disabled={!canBuy} onClick={() => buyNowCard(selectedItem)}>
                  <svg className="btn-buy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                  </svg>
                  <span className="btn-buy-text">{t('product.buyCard')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        </div>

        <p className="payment-worldwide-note">{t('payment.subtitle')}</p>
      </div>
    </section>
  );
}

import { useState, useEffect } from 'react';
import { useCart } from '../../cart/context/CartContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { fetchCoffeeVarieties, fetchAeropressProducts } from '../../../shared/lib/catalog.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';

const FALLBACK_IMG = '/image/bagsbeans.png';
const money = (n) => (n != null ? `$${Number(n).toLocaleString('es-CO')}` : null);

/**
 * Tienda: rejilla de bolsas de café + equipo AeroPress.
 * Cada tarjeta añade al carrito; la barra de compra (abajo) trabaja sobre el
 * producto seleccionado con cantidad, "Comprar" y "Comprar con tarjeta".
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
  const sizeOf = (p) => sizes[p.id] ?? p.sizes.find((s) => p.prices[s] != null) ?? p.sizes[0];
  const itemFor = (p, quantity) => {
    const size = sizeOf(p);
    return {
      name: p.name,
      price: p.prices[size],
      variant: size,
      qty: quantity,
      image: p.image,
      variantId: p.variantIds[size],
    };
  };

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
        <h3 className="shop-card-name">
          {p.name}{showSizes || size ? <span> ({size})</span> : null}
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
              >
                {s}
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
      <div className="product-banner">
        <div className="banner-text">{t('banners.beans')}</div>
      </div>

      <div className="shop-inner">
        <div className="shop-rule" aria-hidden="true"><span /></div>
        <p className="shop-kicker">{t('shop.kicker')}</p>

        <h2 className="shop-title">{t('shop.coffeeTitle')}</h2>
        {loading ? (
          <p className="shop-empty">{t('shop.loading')}</p>
        ) : coffee.length === 0 ? (
          <p className="shop-empty">{t('shop.empty')}</p>
        ) : (
          <div className="shop-grid">{coffee.map(card)}</div>
        )}

        <div className="shop-gear" id="aeropress">
          <h2 className="shop-title">{t('shop.gearTitle')}</h2>
          <p className="shop-sub">{t('shop.gearSub')}</p>
          {!loading && gear.length === 0 ? (
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
          ) : (
            <div className="shop-grid">{gear.map(card)}</div>
          )}
        </div>

        {/* Barra de compra del producto seleccionado: los mismos botones de siempre. */}
        {selected && (
          <div className="shop-buybar" aria-live="polite">
            <div className="shop-buybar-item">
              <img src={selected.image || FALLBACK_IMG} alt="" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
              <div>
                <span className="shop-buybar-label">{t('shop.selected')}</span>
                <strong>{selected.name} · {sizeOf(selected)}</strong>
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

        <p className="payment-worldwide-note">{t('payment.subtitle')}</p>
        <div className="shop-links">
          <a href="#">{t('product.morePayment')}</a>
          <a href="#" className="store-info-link">{t('product.viewStore')}</a>
        </div>
      </div>
    </section>
  );
}

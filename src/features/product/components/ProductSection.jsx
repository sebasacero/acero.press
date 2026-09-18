import { useState, useEffect } from 'react';
import { useCart } from '../../cart/context/CartContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { fetchCoffeeVarieties } from '../../../shared/lib/catalog.js';

const SIZES = ['250G', '500G', '1KG'];

export default function ProductSection() {
  const { addItem, buyNow, buyNowCard } = useCart();
  const { t } = useLanguage();
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [varietyIndex, setVarietyIndex] = useState(0);
  const [size, setSize] = useState(SIZES[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCoffeeVarieties().then((data) => {
      if (active) {
        setVarieties(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const variety = varieties[varietyIndex];
  const product = variety
    ? {
        name: variety.name,
        price: variety.prices[size],
        image: variety.image,
        variantId: variety.variantIds[size],
      }
    : null;

  if (loading) {
    return (
      <section className="product-section" id="beans">
        <div className="product-banner">
          <div className="banner-text">{t('banners.beans')}</div>
        </div>
        <p style={{ padding: '2rem' }}>Cargando variedades…</p>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="product-section" id="beans">
        <div className="product-banner">
          <div className="banner-text">{t('banners.beans')}</div>
        </div>
        <p style={{ padding: '2rem' }}>No hay variedades disponibles por ahora.</p>
      </section>
    );
  }

  const changeVariety = (dir) => {
    setVarietyIndex((i) => (i + dir + varieties.length) % varieties.length);
  };

  const handleAdd = () => {
    addItem({
      name: product.name,
      price: product.price,
      variant: size,
      qty,
      image: product.image,
      variantId: product.variantId,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1000);
  };

  const handleBuyNow = () => {
    buyNow({
      name: product.name,
      price: product.price,
      variant: size,
      qty,
      variantId: product.variantId,
    });
  };

  const handleBuyNowCard = () => {
    buyNowCard({
      name: product.name,
      price: product.price,
      variant: size,
      qty,
      image: product.image,
      variantId: product.variantId,
    });
  };

  return (
    <section className="product-section" id="beans">
      <div className="product-banner">
        <div className="banner-text">{t('banners.beans')}</div>
      </div>

      <div className="product-container">
        <div className="product-gallery">
          <div className="image-wrapper">
            <button className="nav-btn prev" aria-label="Variedad anterior" onClick={() => changeVariety(-1)}>
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <img
              key={product.image}
              src={product.image}
              alt={`${product.name} - ${size}`}
              onError={(e) => { e.currentTarget.src = '/image/bagsbeans.png'; }}
            />
            <button className="nav-btn next" aria-label="Siguiente variedad" onClick={() => changeVariety(1)}>
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
          <div className="gallery-dots">
            {varieties.map((v, i) => (
              <span
                key={v.id}
                className={`dot ${i === varietyIndex ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={v.name}
                onClick={() => setVarietyIndex(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVarietyIndex(i); }}
              ></span>
            ))}
          </div>
        </div>

        <div className="product-info">
          <h1 className="product-title">{product.name}</h1>
          <p className="product-price">{product.price.toLocaleString('es-CO')}</p>

          <div className="selector-group">
            <p className="selector-label">{t('product.size')}</p>
            <div className="size-options">
              {SIZES.map((s) => (
                <button
                  key={s}
                  className={`size-btn ${size === s ? 'active' : ''}`}
                  onClick={() => setSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="purchase-actions">
            <div className="quantity-selector">
              <button className="qty-btn" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <span className="qty-number">{qty}</span>
              <button className="qty-btn" aria-label="Increase quantity" onClick={() => setQty((q) => q + 1)}>+</button>
            </div>

            <button className={`btn-add-cart ${added ? 'added' : ''}`} onClick={handleAdd}>
              {added ? (
                t('product.added')
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                  {t('product.addToCart')}
                </>
              )}
            </button>
          </div>

          <div className="buy-now-row">
            <button className="btn-buy-shop" onClick={handleBuyNow}>
              <svg className="btn-buy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              <span className="btn-buy-text">{t('product.buy')}</span>
            </button>
            <button className="btn-buy-shop btn-buy-card" onClick={handleBuyNowCard}>
              <svg className="btn-buy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              <span className="btn-buy-text">{t('product.buyCard')}</span>
            </button>
          </div>

          <p className="payment-worldwide-note">{t('payment.subtitle')}</p>

          <div className="payment-options-link">
            <a href="#">{t('product.morePayment')}</a>
          </div>
          <div className="pickup-status">
            <div className="status-message"></div>
            <a href="#" className="store-info-link">{t('product.viewStore')}</a>
          </div>
        </div>
      </div>
    </section>
  );
}


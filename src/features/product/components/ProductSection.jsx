import { useState } from 'react';
import { useCart } from '../../cart/context/CartContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const SIZES = ['250G', '500G', '1KG'];

// 6 variedades de café. Cada una tiene su propia imagen y su propio precio
// por presentación (250G / 500G / 1KG). Las flechas de la galería cambian
// de variedad; los botones de tamaño cambian de presentación. El precio y
// la imagen reaccionan a ambas selecciones.
const VARIETIES = [
  {
    id: 'bourbon-rosado',
    name: 'Bourbon Rosado',
    image: '/image/bagsbeans-bourbon-rosado.png',
    prices: { '250G': 18000, '500G': 30000, '1KG': 55000 },
  },
  {
    id: 'castillo',
    name: 'Castillo',
    image: '/image/bagsbeans-castillo.png',
    prices: { '250G': 20000, '500G': 34000, '1KG': 60000 },
  },
  {
    id: 'colombia',
    name: 'Colombia ',
    image: '/image/bagsbeans-colombia.png',
    prices: { '250G': 17000, '500G': 28000, '1KG': 50000 },
  },
  {
    id: 'chiroso',
    name: 'chiroso',
    image: '/image/bagsbeans-chiroso.png',
    prices: { '250G': 16000, '500G': 27000, '1KG': 48000 },
  },
  {
    id: 'aji',
    name: 'Bourbon Aji',
    image: '/image/bagsbeans-aji.png',
    prices: { '250G': 22000, '500G': 38000, '1KG': 68000 },
  },
  {
    id: 'geisha',
    name: 'Geisha',
    image: '/image/bagsbeans-geisha.png',
    prices: { '250G': 32000, '500G': 58000, '1KG': 105000 },
  },
];

export default function ProductSection() {
  const { addItem, buyNow } = useCart();
  const { t } = useLanguage();
  const [varietyIndex, setVarietyIndex] = useState(0);
  const [size, setSize] = useState(SIZES[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variety = VARIETIES[varietyIndex];
  const product = {
    name: variety.name,
    price: variety.prices[size],
    image: variety.image,
  };

  const changeVariety = (dir) => {
    setVarietyIndex((i) => (i + dir + VARIETIES.length) % VARIETIES.length);
  };

  const handleAdd = () => {
    addItem({ name: product.name, price: product.price, variant: size, qty, image: product.image });
    setAdded(true);
    setTimeout(() => setAdded(false), 1000);
  };

  const handleBuyNow = () => {
    buyNow({ name: product.name, price: product.price, variant: size, qty });
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
            {VARIETIES.map((v, i) => (
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

          <button className="btn-buy-shop" onClick={handleBuyNow}>
            {t('product.buy')} <span className="shop-logo"></span>
          </button>

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


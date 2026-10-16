import { useState, useRef, useEffect } from 'react';
import { useCart } from '../../cart/context/CartContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const FALLBACK_IMG = '/image/bagsbeans.png';
const money = (n) => `$${Number(n).toLocaleString('es-CO')}`;

/**
 * "Pregúntale al barista": chat con el barista de IA (/api/barista).
 * Recomienda cafés y equipo del catálogo real (con botón para añadir),
 * adapta recetas campeonas o imagina nuevas.
 */
export default function BaristaChat({ onOpenRecipe }) {
  const { t, lang } = useLanguage();
  const { addItem } = useCart();
  const [messages, setMessages] = useState([]); // { role, content, products?, recipe_year? }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(null);
  const logRef = useRef(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const ask = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/barista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || t('barista.error'));
      setMessages((m) => [...m, { role: 'assistant', content: data.reply, products: data.products ?? [], recipe_year: data.recipe_year || 0 }]);
    } catch (err) {
      setError(err.message || t('barista.error'));
      setMessages((m) => m.slice(0, -1));
      setInput(q);
    } finally {
      setBusy(false);
    }
  };

  const add = (p, key) => {
    addItem({ name: p.brand ? `${p.name} · ${p.brand}` : p.name, price: p.price, variant: p.size, qty: 1, image: p.image, variantId: p.variantId });
    setAdded(key);
    setTimeout(() => setAdded((k) => (k === key ? null : k)), 1200);
  };

  const suggestions = t('barista.suggestions');

  return (
    <section className="barista" aria-label={t('barista.title')}>
      <div className="barista-head">
        <div className="barista-cota"><span>{t('barista.fig')}</span><span className="barista-live"><i aria-hidden="true" />{t('barista.live')}</span></div>
        <h3 className="barista-title">{t('barista.title')}</h3>
        <p className="barista-sub">{t('barista.sub')}</p>
      </div>

      <div className="barista-log" ref={logRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="barista-empty">
            <p>{t('barista.hello')}</p>
            <div className="barista-chips">
              {Array.isArray(suggestions) && suggestions.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} disabled={busy}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`barista-msg is-${m.role}`}>
            {m.role === 'assistant' && <span className="barista-who">{t('barista.who')}</span>}
            <p>{m.content}</p>
            {m.products?.length > 0 && (
              <div className="barista-products">
                {m.products.map((p) => {
                  const key = `${i}-${p.slug}`;
                  return (
                    <div key={key} className="barista-product">
                      <img src={p.image || FALLBACK_IMG} alt="" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
                      <div className="barista-product-info">
                        <strong>{p.name}{p.brand ? <em> · {p.brand}</em> : null}</strong>
                        <span className="barista-product-why">{p.why}</span>
                        <span className="barista-product-price">{money(p.price)} · {p.size}</span>
                      </div>
                      <button type="button" className={added === key ? 'added' : ''} onClick={() => add(p, key)}>
                        {added === key ? t('product.added') : t('barista.add')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {m.recipe_year > 0 && (
              <button type="button" className="barista-recipe-link" onClick={() => onOpenRecipe(m.recipe_year)}>
                {t('barista.openRecipe').replace('{year}', m.recipe_year)} →
              </button>
            )}
          </div>
        ))}

        {busy && (
          <div className="barista-msg is-assistant is-typing" aria-label={t('barista.thinking')}>
            <span className="barista-who">{t('barista.who')}</span>
            <p><span className="barista-dots"><i /><i /><i /></span> {t('barista.thinking')}</p>
          </div>
        )}
      </div>

      {error && <p className="barista-error">{error}</p>}

      <form className="barista-form" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={600}
          placeholder={t('barista.placeholder')}
          aria-label={t('barista.placeholder')}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>{t('barista.send')}</button>
      </form>
      <p className="barista-foot">{t('barista.foot')}</p>
    </section>
  );
}

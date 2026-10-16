import { useState, useRef, useEffect, useCallback } from 'react';
import { useCart } from '../../cart/context/CartContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const FALLBACK_IMG = '/image/bagsbeans.png';
const money = (n) => `$${Number(n).toLocaleString('es-CO')}`;
const SPEECH_LANG = { es: 'es-CO', en: 'en-US', ja: 'ja-JP' };
const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * Chat con el barista de IA (/api/barista): la conversación arriba (se
 * difumina hacia arriba al hacer scroll) y un solo campo para escribir o
 * dictar por voz. `request` ({ text, id }) le hace una pregunta desde fuera,
 * p. ej. desde una tarjeta de receta.
 */
export default function BaristaChat({ onOpenRecipe, request }) {
  const { t, lang } = useLanguage();
  const { addItem } = useCart();
  const [messages, setMessages] = useState([]); // { role, content, products?, recipe_year? }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(null);
  const [listening, setListening] = useState(false);
  const logRef = useRef(null);
  const boxRef = useRef(null);
  const rootRef = useRef(null);
  const recRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // El campo crece con el texto (hasta ~5 líneas).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input]);

  const ask = useCallback(async (text) => {
    const q = text.trim();
    if (!q) return;
    recRef.current?.stop();
    const next = [...messagesRef.current, { role: 'user', content: q }];
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
  }, [lang, t]);

  // Pregunta enviada desde fuera (botón de una tarjeta de receta).
  useEffect(() => {
    if (!request?.text) return;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ask(request.text);
  }, [request, ask]);

  useEffect(() => () => recRef.current?.abort(), []);

  const toggleVoice = () => {
    if (listening) return recRef.current?.stop();
    const rec = new SpeechRecognition();
    rec.lang = SPEECH_LANG[lang] ?? 'es-CO';
    rec.interimResults = true;
    rec.continuous = false;
    const base = input ? `${input.trimEnd()} ` : '';
    rec.onresult = (e) => {
      const said = Array.from(e.results).map((r) => r[0].transcript).join('');
      setInput(base + said);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError(t('barista.micDenied'));
    };
    rec.onend = () => { setListening(false); boxRef.current?.focus(); };
    recRef.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  };

  const add = (p, key) => {
    addItem({ name: p.brand ? `${p.name} · ${p.brand}` : p.name, price: p.price, variant: p.size, qty: 1, image: p.image, variantId: p.variantId });
    setAdded(key);
    setTimeout(() => setAdded((k) => (k === key ? null : k)), 1200);
  };

  const submit = (e) => { e.preventDefault(); if (!busy) ask(input); };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  };

  return (
    <section className="barista" ref={rootRef} aria-label={t('barista.title')}>
      <div className="barista-log" ref={logRef} aria-live="polite">
        <div className="barista-msg is-assistant">
          <div className="barista-bubble">
            <span className="barista-who">{t('barista.who')}</span>
            <p>{t('barista.hello')}</p>
          </div>
        </div>

        {messages.map((m, i) => (
          <div key={i} className={`barista-msg is-${m.role}`}>
            <div className="barista-bubble">
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
          </div>
        ))}

        {busy && (
          <div className="barista-msg is-assistant">
            <div className="barista-bubble">
              <span className="barista-who">{t('barista.who')}</span>
              <p className="is-typing"><span className="barista-dots"><i /><i /><i /></span> {t('barista.thinking')}</p>
            </div>
          </div>
        )}
      </div>

      {error && <p className="barista-error" role="alert">{error}</p>}

      <form className={`barista-composer ${listening ? 'is-listening' : ''}`} onSubmit={submit}>
        <textarea
          ref={boxRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={600}
          placeholder={listening ? t('barista.listening') : t('barista.placeholder')}
          aria-label={t('barista.placeholder')}
        />
        {SpeechRecognition && (
          <button type="button" className="barista-mic" onClick={toggleVoice} disabled={busy}
            aria-pressed={listening} aria-label={listening ? t('barista.stopVoice') : t('barista.voice')} title={listening ? t('barista.stopVoice') : t('barista.voice')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <line x1="12" y1="18" x2="12" y2="21" />
            </svg>
          </button>
        )}
        <button type="submit" className="barista-send" disabled={busy || !input.trim()} aria-label={t('barista.send')} title={t('barista.send')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </form>
      <p className="barista-foot">{t('barista.foot')}</p>
    </section>
  );
}

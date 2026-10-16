import { useEffect, useRef, useState } from 'react';
import { fetchSalesCounts, fetchRecentSales } from '../../shared/lib/salesCounter.js';
import { fetchAppConfig } from '../../shared/lib/appConfig.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

// Respaldo por si Supabase no responde a tiempo — la meta real y editable
// vive en app_config (clave 'sales_goal'), configurable desde /admin → Configuración.
const FALLBACK_SALES_GOAL = 5000000;

const POLL_MS = 45000;
const DIGIT_COUNT = 7; // hasta 9.999.999

const money = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const RTF_LOCALE = { es: 'es-CO', en: 'en-US', ja: 'ja-JP' };

function timeAgo(ts, lang) {
  const diffSec = Math.round((ts - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(RTF_LOCALE[lang] || 'es-CO', { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

export default function SalesFloatButton() {
  const { t, lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [counts, setCounts] = useState({ coffee_bag: { qty: 0, amount: 0 }, aeropress_equipment: { qty: 0, amount: 0 }, total: 0 });
  const [sales, setSales] = useState([]);
  const [goal, setGoal] = useState(FALLBACK_SALES_GOAL);
  const dialogRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    fetchAppConfig('sales_goal', String(FALLBACK_SALES_GOAL)).then((v) => setGoal(Number(v) || FALLBACK_SALES_GOAL));
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchSalesCounts().then((c) => active && setCounts(c));
      fetchRecentSales(20).then((s) => active && setSales(s));
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
    // Como un chat: se abre en el último mensaje.
    if (isOpen) requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }));
  }, [isOpen, sales.length]);

  const total = counts.total;
  const progress = Math.min(100, (total / goal) * 100);
  const remaining = Math.max(0, goal - total);
  const digits = String(Math.min(9999999, Math.floor(total))).padStart(DIGIT_COUNT, '0').split('');
  const filledSegments = Math.round((progress / 100) * 20);

  return (
    <>
      <button
        type="button"
        className="sales-float"
        style={{ '--sales-pct': progress }}
        onClick={() => setIsOpen(true)}
        aria-label={t('sales.title')}
      >
        <span className="sales-float-ring" />
        <span className="sales-float-inner">
          <span className="sales-float-pct">{Math.round(progress)}%</span>
          <span className="sales-float-label">{t('sales.floatLabel')}</span>
        </span>
      </button>

      <dialog ref={dialogRef} className="sales-modal-banner sales-wa" onClose={() => setIsOpen(false)} aria-label={t('sales.title')}>
        <div className="sales-wa-shell">
          <header className="sales-wa-head">
            <span className="sales-wa-avatar" style={{ '--sales-pct': progress }} aria-hidden="true">
              <span>{Math.round(progress)}%</span>
            </span>
            <div className="sales-wa-title">
              <strong>{t('sales.title')}</strong>
              <span><i className="sales-wa-live" aria-hidden="true" />{t('sales.live')}</span>
            </div>
            <button type="button" className="sales-wa-close" onClick={() => setIsOpen(false)} aria-label={t('sales.close')}>×</button>
          </header>

          <div className="sales-wa-log" ref={logRef}>
            <div className="barista-day"><span>{t('barista.today')}</span></div>

            <div className="barista-msg is-assistant">
              <div className="barista-bubble sales-wa-bubble">
                <span className="barista-who">ACERO.PRESS</span>
                <p>{t('sales.subtitle')}</p>
                <div className="sales-fig-label">{t('sales.goal')} · {money(goal)}</div>
                <div className="sales-odo-row">
                  <div className="sales-odo">
                    {digits.map((d, i) => (
                      <span className="sales-digit" key={i}>{d}</span>
                    ))}
                  </div>
                  <span className="sales-odo-sep">/</span>
                  <span className="sales-odo-target">{money(goal)}</span>
                </div>
                <div className="sales-seg-bar">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className={`sales-seg ${i < filledSegments ? 'filled' : ''}`}></div>
                  ))}
                </div>
                <div className="sales-progress-caption">{t('sales.remaining')}: {money(remaining)}</div>
              </div>
            </div>

            <div className="barista-msg is-assistant">
              <div className="barista-bubble sales-wa-bubble">
                <div className="sales-wa-stats">
                  <div><span>{t('sales.bagSales')}</span><strong>{counts.coffee_bag.qty}</strong><em>{money(counts.coffee_bag.amount)}</em></div>
                  <div><span>{t('sales.prepSales')}</span><strong>{counts.aeropress_equipment.qty}</strong><em>{money(counts.aeropress_equipment.amount)}</em></div>
                </div>
              </div>
            </div>

            {sales.length === 0 ? (
              <div className="barista-msg is-assistant">
                <div className="barista-bubble"><p>{t('sales.empty')}</p></div>
              </div>
            ) : (
              [...sales].reverse().map((s) => (
                <div key={s.id} className="barista-msg is-assistant">
                  <div className={`barista-bubble sales-wa-sale sales-history-${s.type}`}>
                    <span className="sales-wa-sale-row">
                      <span className="sales-history-dot" aria-hidden="true" />
                      <span className="sales-history-label">{s.label}</span>
                      <strong className="sales-history-amount">+{money(s.amount)}</strong>
                    </span>
                    <span className="barista-time">{timeAgo(s.at, lang)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <footer className="sales-wa-foot">{t('sales.readOnly')}</footer>
        </div>
      </dialog>
    </>
  );
}

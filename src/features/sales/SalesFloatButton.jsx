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
  }, [isOpen]);

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

      <dialog ref={dialogRef} className="sales-modal-banner" onClose={() => setIsOpen(false)}>
        <div className="modal-container">
          <button className="modal-close" onClick={() => setIsOpen(false)} aria-label={t('sales.close')}>×</button>

          <div className="sales-modal-header">
            <span className="hero-badge sales-badge">{Math.round(progress)}%</span>
            <h2 className="hero-title" style={{ color: 'var(--cream)' }}>{t('sales.title')}</h2>
            <p className="hero-subtitle">{t('sales.subtitle')}</p>
          </div>

          <div className="modal-body">
            <div className="sales-odo-panel">
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

            <div className="modal-specs-bar sales-specs-bar">
              <div className="m-spec">
                <span className="m-label">{t('sales.bagSales')}</span>
                <span className="m-val">{counts.coffee_bag.qty}</span>
              </div>
              <div className="m-spec">
                <span className="m-label">{t('sales.prepSales')}</span>
                <span className="m-val">{counts.aeropress_equipment.qty}</span>
              </div>
              <div className="m-spec">
                <span className="m-label">{t('sales.bagLabel')}</span>
                <span className="m-val">{money(counts.coffee_bag.amount)}</span>
              </div>
              <div className="m-spec">
                <span className="m-label">{t('sales.prepLabel')}</span>
                <span className="m-val">{money(counts.aeropress_equipment.amount)}</span>
              </div>
            </div>

            <section className="modal-block sales-history">
              <h4>{t('sales.historyTitle')}</h4>
              {sales.length === 0 ? (
                <p>{t('sales.empty')}</p>
              ) : (
                <ul className="sales-history-list">
                  {sales.map((s) => (
                    <li key={s.id} className={`sales-history-item sales-history-${s.type}`}>
                      <span className="sales-history-dot" />
                      <span className="sales-history-label">{s.label}</span>
                      <span className="sales-history-time">{timeAgo(s.at, lang)}</span>
                      <span className="sales-history-amount">+{money(s.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </dialog>
    </>
  );
}

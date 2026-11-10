import { useEffect, useMemo, useRef } from 'react';
import { cafeMenu, activeItem } from './cafeMenu.js';
import platform from './platform.js';
import Termo from './Termo.jsx';
import { IconBag, IconBean, IconCap, IconCan, IconToday, IconTrophy, IconThermo, IconPin, IconChevron } from './icons.jsx';

const ICONS = { bag: IconBag, bean: IconBean, cap: IconCap, can: IconCan, today: IconToday, trophy: IconTrophy, thermo: IconThermo, pin: IconPin };

/**
 * El menú del café: sale de la izquierda al tocar el logo de arriba (pedido del
 * usuario, 7 nov 2026). Las entradas salen de cafeMenu.js; Escape, el velo o la
 * X lo cierran y el foco vuelve al logo.
 */
export default function CafeDrawer({ mode, go, onClose, onAcero, pathname }) {
  const sections = useMemo(() => cafeMenu(mode, { siteUrl: platform.siteUrl }), [mode]);
  const current = activeItem(sections, pathname);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.querySelector('[data-testid="brand-menu"]')?.focus();
    };
  }, [onClose]);

  const pick = (it) => {
    onClose();
    if (it.to) go(it.to);
    else if (it.action === 'acero') onAcero();
  };

  return (
    <div className="mapp-drawerwrap" role="dialog" aria-modal="true" aria-label="El café en Micra" data-testid="cafe-drawer">
      <button type="button" className="mapp-drawer-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <nav className="mapp-drawer" aria-label="El café">
        <div className="mapp-drawer-head">
          <span className="mapp-brand-mark"><Termo /></span>
          <span className="mapp-brand-word">micra<i>.</i></span>
          <button type="button" ref={closeRef} className="mapp-drawer-x" onClick={onClose} aria-label="Cerrar el menú">×</button>
        </div>
        <p className="mapp-drawer-kicker">Todo el café</p>
        {sections.map((s) => (
          <section key={s.title} className="mapp-drawer-sec" aria-label={s.title}>
            <h2>{s.title}</h2>
            <ul>
              {s.items.map((it) => {
                const Icon = ICONS[it.icon] ?? IconBean;
                const inner = (
                  <>
                    <span className="mapp-drawer-ic" aria-hidden="true"><Icon /></span>
                    <span className="mapp-drawer-txt"><b>{it.label}</b><small>{it.sub}</small></span>
                    <IconChevron />
                  </>
                );
                return (
                  <li key={it.id}>
                    {it.href
                      ? <a className="mapp-drawer-item" href={it.href} target="_blank" rel="noopener noreferrer" data-testid={`drawer-${it.id}`} onClick={onClose}>{inner}</a>
                      : <button type="button" className={`mapp-drawer-item${current === it.id ? ' on' : ''}`} aria-current={current === it.id ? 'page' : undefined} onClick={() => pick(it)} data-testid={`drawer-${it.id}`}>{inner}</button>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  );
}

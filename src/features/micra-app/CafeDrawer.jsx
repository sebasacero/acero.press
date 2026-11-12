import { useEffect, useMemo, useRef } from 'react';
import { cafeMenu, activeItem } from './cafeMenu.js';
import platform from './platform.js';
import { requestWant } from './want.js';
import { IconBag, IconBean, IconCap, IconCan, IconToday, IconTrophy, IconThermo, IconPin, IconUser } from './icons.jsx';

const ICONS = { bag: IconBag, bean: IconBean, cap: IconCap, can: IconCan, today: IconToday, trophy: IconTrophy, thermo: IconThermo, pin: IconPin };

// Cada entrada lleva su ícono de línea en un tono de la escala térmica (como una lista de proyectos)
const TONES = ['var(--t-4)', 'var(--t-2)', 'var(--t-5)', 'var(--t-3)', '#2B7A4B', 'var(--t-1)', '#B7791F', 'var(--t-4)'];

/**
 * El menú del café: sale de la izquierda al tocar el logo de arriba (pedido del
 * usuario, 7 nov 2026). Rediseñado el 12 nov 2026 (pedido del usuario, con una lista
 * de referencia): hoja de papel sin tarjetas, una línea por entrada con su ícono de
 * color, la actual en una píldora gris, y abajo flotando la cuenta y la acción principal.
 * Las entradas salen de cafeMenu.js; Escape, el velo o la X lo cierran y el foco vuelve al logo.
 */
export default function CafeDrawer({ mode, go, onClose, onAcero, pathname, me = null }) {
  const sections = useMemo(() => cafeMenu(mode, { siteUrl: platform.siteUrl }), [mode]);
  const current = activeItem(sections, pathname);
  const closeRef = useRef(null);
  const barista = mode === 'barista';

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
  const main = () => {
    onClose();
    if (barista) go('/micra/barista');
    else { go('/micra'); requestWant(); }
  };
  let n = 0;

  return (
    <div className="mapp-drawerwrap" role="dialog" aria-modal="true" aria-label="El café en Micra" data-testid="cafe-drawer">
      <button type="button" className="mapp-drawer-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <nav className="mapp-drawer" aria-label="El café">
        <div className="mapp-drawer-head">
          <span className="mapp-drawer-word">micra<i>.</i></span>
          <button type="button" ref={closeRef} className="mapp-drawer-x" onClick={onClose} aria-label="Cerrar el menú">×</button>
        </div>
        <div className="mapp-drawer-scroll">
          {sections.map((s) => (
            <section key={s.title} className="mapp-drawer-sec" aria-label={s.title}>
              <h2>{s.title}</h2>
              <ul>
                {s.items.map((it) => {
                  const Icon = ICONS[it.icon] ?? IconBean;
                  const tone = TONES[n++ % TONES.length];
                  const inner = (
                    <>
                      <span className="mapp-drawer-ic" style={{ color: tone }} aria-hidden="true"><Icon /></span>
                      <span className="mapp-drawer-txt"><b>{it.label}</b></span>
                    </>
                  );
                  return (
                    <li key={it.id}>
                      {it.href
                        ? <a className="mapp-drawer-item" href={it.href} target="_blank" rel="noopener noreferrer" title={it.sub} data-testid={`drawer-${it.id}`} onClick={onClose}>{inner}</a>
                        : <button type="button" className={`mapp-drawer-item${current === it.id ? ' on' : ''}`} aria-current={current === it.id ? 'page' : undefined} title={it.sub} onClick={() => pick(it)} data-testid={`drawer-${it.id}`}>{inner}</button>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <div className="mapp-drawer-foot">
          <button type="button" className="mapp-drawer-me" onClick={() => { onClose(); go(barista ? '/micra/barista/cuenta' : '/micra/perfil'); }} aria-label={barista ? 'Mi cuenta' : 'Mi perfil'} data-testid="drawer-me">
            {me ? <span>{me}</span> : <IconUser />}
          </button>
          <button type="button" className="mapp-drawer-main" onClick={main} data-testid="drawer-main">
            <span aria-hidden="true">＋</span>{barista ? 'Ir a vender' : 'Quiero un café'}
          </button>
        </div>
      </nav>
    </div>
  );
}

import WhatsAppButton from '../../shared/layout/WhatsAppButton.jsx';
import { useAdminAuth } from './useAdminAuth.js';
import { useAdminUI } from './AdminUIContext.jsx';

function EspresaleQuickButton() {
  const { openTool } = useAdminUI();
  return (
    <button
      type="button"
      className="wa-float espresale-float"
      onClick={() => openTool('espresale')}
      aria-label="Venta rápida — Espresale"
    >
      <span className="wa-float-pulse espresale-float-pulse" aria-hidden="true"></span>
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#fff" stroke="#fff" />
      </svg>
      <span className="espresale-float-tip">Venta rápida</span>
    </button>
  );
}

/**
 * Apenas tu sesión (owner) está activa, el botón flotante cambia solo —
 * ya no es una opción manual del dock. Cualquier otra persona (cliente,
 * o si no has iniciado sesión) siempre ve el botón normal de WhatsApp.
 */
export default function ActiveFloatWidget() {
  const { isAdmin, adminInfo } = useAdminAuth();

  if (isAdmin && adminInfo?.role === 'owner') {
    return <EspresaleQuickButton />;
  }
  return <WhatsAppButton />;
}

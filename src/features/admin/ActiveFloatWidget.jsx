import { useState, useEffect } from 'react';
import WhatsAppButton from '../../shared/layout/WhatsAppButton.jsx';
import { fetchAppConfig } from '../../shared/lib/appConfig.js';
import { useAdminAuth } from './useAdminAuth.js';
import { useAdminUI } from './AdminUIContext.jsx';

function EspresaleQuickButton() {
  const { openTool } = useAdminUI();
  return (
    <button className="wa-float espresale-float" onClick={() => openTool('espresale')} aria-label="Espresale">
      <span style={{ fontSize: 22 }}>⚡</span>
    </button>
  );
}

export default function ActiveFloatWidget() {
  const [widget, setWidget] = useState('whatsapp');
  const { isAdmin, adminInfo } = useAdminAuth();

  useEffect(() => {
    fetchAppConfig('active_float_widget', 'whatsapp').then(setWidget);
  }, []);

  if (widget === 'espresale') {
    // Este botón reemplaza el de WhatsApp solo para ti (owner) — para
    // cualquier otra persona simplemente no aparece nada en esa esquina.
    if (isAdmin && adminInfo?.role === 'owner') return <EspresaleQuickButton />;
    return null;
  }

  return <WhatsAppButton />;
}

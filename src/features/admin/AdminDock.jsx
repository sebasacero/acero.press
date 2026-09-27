import { useState, useEffect } from 'react';
import { useAdminAuth } from './useAdminAuth.js';
import { useAdminUI } from './AdminUIContext.jsx';
import { ADMIN_TOOLS } from './adminTools.js';
import { supabase } from '../../shared/lib/supabaseClient.js';
import './admin.css';

const FLOAT_WIDGET_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp (clientes)' },
  { value: 'espresale', label: 'Acceso rápido a Espresale (solo para ti)' },
];

export default function AdminDock() {
  const { isAdmin, adminInfo } = useAdminAuth();
  const { openTool } = useAdminUI();
  const [expanded, setExpanded] = useState(false);
  const [floatWidget, setFloatWidget] = useState('whatsapp');

  useEffect(() => {
    if (!expanded) return;
    supabase
      .from('app_config')
      .select('value')
      .eq('key', 'active_float_widget')
      .maybeSingle()
      .then(({ data }) => data && setFloatWidget(data.value));
  }, [expanded]);

  // Solo tu cuenta (role: owner) ve este control. Un futuro empleado
  // (role: staff/cashier) sigue entrando a /admin normalmente, pero no ve
  // este dock flotando sobre el sitio en vivo.
  if (!isAdmin || adminInfo?.role !== 'owner') return null;

  const changeFloatWidget = async (value) => {
    setFloatWidget(value);
    await supabase
      .from('app_config')
      .upsert({ key: 'active_float_widget', value, updated_at: new Date().toISOString() });
  };

  return (
    <div className="admin-dock">
      {expanded && (
        <div className="admin-dock-menu">
          <div className="admin-dock-menu-title">Panel AceroPress</div>
          {ADMIN_TOOLS.map((t) => (
            <button
              key={t.id}
              className="admin-dock-item"
              onClick={() => { openTool(t.id); setExpanded(false); }}
            >
              {t.label}
            </button>
          ))}

          <div className="admin-dock-divider" />
          <div className="admin-dock-menu-title">Botón flotante público</div>
          {FLOAT_WIDGET_OPTIONS.map((opt) => (
            <label key={opt.value} className="admin-dock-radio">
              <input
                type="radio"
                name="float-widget"
                checked={floatWidget === opt.value}
                onChange={() => changeFloatWidget(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}

      <button
        className="admin-dock-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-label="Panel de administración"
      >
        ⚙
      </button>
    </div>
  );
}

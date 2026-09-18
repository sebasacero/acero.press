import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

const FIELDS = [
  {
    section: 'General',
    items: [
      { key: 'whatsapp_number', label: 'Número de WhatsApp', hint: 'Código de país + número, sin "+" ni espacios. Ej: 573001234567' },
      { key: 'sales_goal', label: 'Meta de ventas del odómetro (COP)', hint: 'Número sin puntos ni símbolo de peso. Ej: 5000000' },
    ],
  },
  {
    section: 'Redes sociales',
    items: [
      { key: 'social_facebook', label: 'Facebook' },
      { key: 'social_instagram', label: 'Instagram' },
      { key: 'social_tiktok', label: 'TikTok' },
      { key: 'social_youtube', label: 'YouTube' },
    ],
  },
  {
    section: 'Texto del marquee (separa cada frase con | )',
    items: [
      { key: 'marquee_es', label: 'Español', textarea: true },
      { key: 'marquee_en', label: 'English', textarea: true },
      { key: 'marquee_ja', label: '日本語', textarea: true },
    ],
  },
];

export default function SettingsPage() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('key, value');
    const map = {};
    (data ?? []).forEach((row) => (map[row.key] = row.value));
    setConfig(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (key) => {
    setSavingKey(key);
    setSavedKey(null);
    await supabase
      .from('app_config')
      .upsert({ key, value: config[key] ?? '', updated_at: new Date().toISOString() });
    setSavingKey(null);
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
  };

  if (loading) return <p className="admin-loading">Cargando configuración…</p>;

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Configuración</h1>
      <p className="admin-page-sub">
        Estos valores son públicos (los lee cualquier visitante del sitio) — úsalo solo para
        datos que de todas formas terminan siendo visibles, nunca para llaves secretas. Las
        llaves de Stripe, Wompi y Supabase siguen viviendo en variables de entorno del servidor.
      </p>

      {FIELDS.map((group) => (
        <div key={group.section} className="admin-settings-section">
          <h3>{group.section}</h3>
          <div className="admin-settings-grid">
            {group.items.map((f) => (
              <div key={f.key} className="admin-card admin-settings-card">
                <div className="admin-card-header">
                  <h3>{f.label}</h3>
                </div>
                {f.hint && <p className="admin-page-sub" style={{ marginBottom: '.6rem' }}>{f.hint}</p>}
                <div style={{ display: 'flex', gap: '.5rem', alignItems: f.textarea ? 'flex-start' : 'center' }}>
                  {f.textarea ? (
                    <textarea
                      className="admin-settings-textarea"
                      value={config[f.key] || ''}
                      onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type="text"
                      className="admin-price-input"
                      style={{ width: '100%' }}
                      value={config[f.key] || ''}
                      onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                    />
                  )}
                  <button
                    className="admin-btn-primary admin-btn-sm"
                    disabled={savingKey === f.key}
                    onClick={() => save(f.key)}
                  >
                    {savingKey === f.key ? 'Guardando…' : savedKey === f.key ? '✓ Guardado' : 'Guardar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

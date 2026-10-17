import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

const ROLE_LABEL = { cliente: 'Pedir café', barista: 'Ser barista' };

// Números colombianos de 10 dígitos sin indicativo → se les antepone el 57.
const waNumber = (phone) => (phone.length === 10 && phone.startsWith('3') ? `57${phone}` : phone);

/** Lista de espera de la app Esspresale (formulario de la sección App del sitio). */
export default function AppWaitlistPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('app_waitlist')
      .select('id, role, name, phone, zone, has_aeropress, lang, created_at')
      .order('created_at', { ascending: false });
    setError(err ? 'No se pudo cargar la lista. Revisa que la tabla app_waitlist exista en Supabase.' : '');
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    cliente: rows.filter((r) => r.role === 'cliente').length,
    barista: rows.filter((r) => r.role === 'barista').length,
    withAeropress: rows.filter((r) => r.role === 'barista' && r.has_aeropress).length,
  }), [rows]);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.role === filter);

  const remove = async (row) => {
    if (!confirm(`¿Quitar a ${row.name} de la lista?`)) return;
    await supabase.from('app_waitlist').delete().eq('id', row.id);
    await load();
  };

  if (loading) return <p className="admin-loading">Cargando lista de espera…</p>;

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Lista de espera · App</h1>
      <p className="admin-page-sub">
        Personas que se apuntaron desde la sección App del sitio. Escríbeles por WhatsApp cuando Esspresale abra en su zona.
      </p>
      {error && <p className="admin-fineprint" style={{ color: '#de1b1b' }}>{error}</p>}

      <div className="admin-kpi-grid">
        <div className="admin-kpi-card"><span className="admin-kpi-label">Quieren pedir café</span><span className="admin-kpi-num">{counts.cliente}</span></div>
        <div className="admin-kpi-card"><span className="admin-kpi-label">Quieren ser baristas</span><span className="admin-kpi-num">{counts.barista}</span></div>
        <div className="admin-kpi-card"><span className="admin-kpi-label">Baristas con AeroPress</span><span className="admin-kpi-num">{counts.withAeropress}</span></div>
      </div>

      <div className="admin-panel">
        <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[['all', 'Todos'], ['cliente', ROLE_LABEL.cliente], ['barista', ROLE_LABEL.barista]].map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'admin-btn-primary admin-btn-sm' : 'admin-btn-ghost admin-btn-sm'} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="admin-loading">Todavía no hay nadie en esta lista.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr><th>Fecha</th><th>Camino</th><th>Nombre</th><th>WhatsApp</th><th>Barrio</th><th>AeroPress</th><th></th></tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.created_at).toLocaleDateString('es-CO')}</td>
                    <td><span className={`admin-chip ${r.role === 'barista' ? 'chip-red' : 'chip-green'}`}>{ROLE_LABEL[r.role]}</span></td>
                    <td>{r.name}</td>
                    <td><a href={`https://wa.me/${waNumber(r.phone)}`} target="_blank" rel="noopener noreferrer">{r.phone}</a></td>
                    <td>{r.zone || '—'}</td>
                    <td>{r.role === 'barista' ? (r.has_aeropress === null ? '—' : r.has_aeropress ? 'Sí' : 'No') : ''}</td>
                    <td><button type="button" className="admin-btn-ghost admin-btn-sm" onClick={() => remove(r)}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

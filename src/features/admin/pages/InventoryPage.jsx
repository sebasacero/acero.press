import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

export default function InventoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(null); // variantId en edición

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('variant_id, stock_qty, low_stock_threshold, product_variants(label, product_id, products(name))')
      .order('stock_qty', { ascending: true });
    if (error) console.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyMovement = async (variantId, changeQty, reason) => {
    if (!changeQty) return;
    await supabase.from('inventory_movements').insert({
      variant_id: variantId,
      change_qty: changeQty,
      reason,
    });
    const row = rows.find((r) => r.variant_id === variantId);
    const newQty = Math.max(0, (row?.stock_qty ?? 0) + changeQty);
    await supabase.from('inventory').update({ stock_qty: newQty, updated_at: new Date().toISOString() }).eq('variant_id', variantId);
    setAdjusting(null);
    await load();
  };

  if (loading) return <p className="admin-loading">Cargando inventario…</p>;

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Inventario</h1>
      <p className="admin-page-sub">Ordenado por menor stock primero. Cada ajuste queda registrado con su motivo.</p>

      <table className="admin-table admin-table-wide">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Presentación</th>
            <th>Stock</th>
            <th>Estado</th>
            <th>Ajustar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isLow = r.stock_qty <= r.low_stock_threshold;
            return (
              <tr key={r.variant_id} className={isLow ? 'is-low-stock' : ''}>
                <td>{r.product_variants?.products?.name}</td>
                <td>{r.product_variants?.label}</td>
                <td className="admin-stock-num">{r.stock_qty}</td>
                <td>
                  <span className={`admin-chip ${isLow ? 'chip-red' : 'chip-green'}`}>
                    {isLow ? 'Bajo' : 'OK'}
                  </span>
                </td>
                <td>
                  {adjusting === r.variant_id ? (
                    <AdjustForm
                      onConfirm={(qty, reason) => applyMovement(r.variant_id, qty, reason)}
                      onCancel={() => setAdjusting(null)}
                    />
                  ) : (
                    <button className="admin-btn-ghost" onClick={() => setAdjusting(r.variant_id)}>
                      Ajustar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdjustForm({ onConfirm, onCancel }) {
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('restock');

  return (
    <div className="admin-adjust-form">
      <input
        type="number"
        placeholder="+10 / -3"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className="admin-adjust-input"
      />
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="admin-adjust-select">
        <option value="restock">Reposición</option>
        <option value="adjustment">Ajuste</option>
        <option value="waste">Merma</option>
      </select>
      <button className="admin-btn-primary admin-btn-sm" onClick={() => onConfirm(Number(qty), reason)}>
        Guardar
      </button>
      <button className="admin-btn-ghost admin-btn-sm" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}

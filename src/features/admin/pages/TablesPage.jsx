import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [activeTableId, setActiveTableId] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null); // { id, items: [...] }
  const [loading, setLoading] = useState(true);
  const [newTableLabel, setNewTableLabel] = useState('');

  const loadTables = useCallback(async () => {
    const { data } = await supabase.from('tables').select('*').order('label');
    setTables(data ?? []);
  }, []);

  const loadCatalog = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, product_variants(id, label, price, active)')
      .eq('active', true);
    setCatalog(data ?? []);
  }, []);

  useEffect(() => {
    Promise.all([loadTables(), loadCatalog()]).then(() => setLoading(false));
  }, [loadTables, loadCatalog]);

  const openTable = async (table) => {
    setActiveTableId(table.id);
    let { data: order } = await supabase
      .from('orders')
      .select('id, total, order_items(id, product_name_snapshot, variant_label_snapshot, qty, unit_price, variant_id)')
      .eq('table_id', table.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (!order) {
      const { data: newOrder } = await supabase
        .from('orders')
        .insert({ source: 'table', table_id: table.id, status: 'pending', total: 0 })
        .select('id, total, order_items(id, product_name_snapshot, variant_label_snapshot, qty, unit_price, variant_id)')
        .single();
      order = newOrder;
      await supabase.from('tables').update({ status: 'occupied' }).eq('id', table.id);
      await loadTables();
    }
    setActiveOrder(order);
  };

  const addItemToOrder = async (variant, productName) => {
    if (!activeOrder) return;
    await supabase.from('order_items').insert({
      order_id: activeOrder.id,
      variant_id: variant.id,
      product_name_snapshot: productName,
      variant_label_snapshot: variant.label,
      unit_price: variant.price,
      qty: 1,
      subtotal: variant.price,
    });
    await refreshActiveOrder();
  };

  const refreshActiveOrder = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, total, order_items(id, product_name_snapshot, variant_label_snapshot, qty, unit_price, variant_id)')
      .eq('id', activeOrder.id)
      .single();
    setActiveOrder(data);
  };

  const removeItem = async (itemId) => {
    await supabase.from('order_items').delete().eq('id', itemId);
    await refreshActiveOrder();
  };

  const closeTab = async () => {
    if (!activeOrder) return;
    const total = activeOrder.order_items.reduce((s, i) => s + i.unit_price * i.qty, 0);

    // Descuenta inventario por cada item (venta real, igual que al confirmar un pedido)
    for (const item of activeOrder.order_items) {
      if (!item.variant_id) continue;
      await supabase.from('inventory_movements').insert({
        variant_id: item.variant_id,
        change_qty: -item.qty,
        reason: 'sale',
        reference_order_id: activeOrder.id,
      });
      const { data: inv } = await supabase
        .from('inventory')
        .select('stock_qty')
        .eq('variant_id', item.variant_id)
        .maybeSingle();
      if (inv) {
        await supabase
          .from('inventory')
          .update({ stock_qty: Math.max(0, inv.stock_qty - item.qty) })
          .eq('variant_id', item.variant_id);
      }
    }

    await supabase
      .from('orders')
      .update({ status: 'completed', total, closed_at: new Date().toISOString() })
      .eq('id', activeOrder.id);
    await supabase.from('tables').update({ status: 'free' }).eq('id', activeTableId);

    setActiveTableId(null);
    setActiveOrder(null);
    await loadTables();
  };

  const createTable = async () => {
    const label = newTableLabel.trim() || `Mesa ${tables.length + 1}`;
    await supabase.from('tables').insert({ label, status: 'free' });
    setNewTableLabel('');
    await loadTables();
  };

  if (loading) return <p className="admin-loading">Cargando mesas…</p>;

  const total = activeOrder?.order_items.reduce((s, i) => s + i.unit_price * i.qty, 0) ?? 0;

  return (
    <div className="admin-page admin-pos">
      <h1 className="admin-page-title">Mesas / POS</h1>

      <div className="admin-pos-layout">
        <div className="admin-pos-tables">
          <div className="admin-new-table">
            <input
              type="text"
              placeholder="Nombre de la mesa (opcional)"
              value={newTableLabel}
              onChange={(e) => setNewTableLabel(e.target.value)}
            />
            <button className="admin-btn-primary admin-btn-sm" onClick={createTable}>
              + Mesa
            </button>
          </div>

          <div className="admin-table-grid">
            {tables.map((t) => (
              <button
                key={t.id}
                className={`admin-table-tile status-${t.status} ${activeTableId === t.id ? 'active' : ''}`}
                onClick={() => openTable(t)}
              >
                {t.label}
                <span className="admin-table-tile-status">
                  {t.status === 'free' ? 'Libre' : t.status === 'occupied' ? 'Ocupada' : 'Cerrada'}
                </span>
              </button>
            ))}
            {tables.length === 0 && <p className="admin-loading">Aún no hay mesas creadas.</p>}
          </div>
        </div>

        {activeOrder && (
          <div className="admin-pos-tab">
            <h3>Cuenta — {tables.find((t) => t.id === activeTableId)?.label}</h3>

            <ul className="admin-order-items">
              {activeOrder.order_items.map((it) => (
                <li key={it.id}>
                  {it.qty}× {it.product_name_snapshot} ({it.variant_label_snapshot}) —{' '}
                  {(it.unit_price * it.qty).toLocaleString('es-CO')}
                  <button className="admin-remove-item" onClick={() => removeItem(it.id)}>
                    ×
                  </button>
                </li>
              ))}
              {activeOrder.order_items.length === 0 && <li>Sin productos aún.</li>}
            </ul>

            <div className="admin-pos-add">
              <p className="admin-page-sub" style={{ margin: '.8rem 0 .4rem' }}>Agregar producto</p>
              <div className="admin-pos-catalog">
                {catalog.map((p) =>
                  p.product_variants
                    .filter((v) => v.active)
                    .map((v) => (
                      <button
                        key={v.id}
                        className="admin-pos-item-btn"
                        onClick={() => addItemToOrder(v, p.name)}
                      >
                        {p.name} · {v.label}
                        <span>${Number(v.price).toLocaleString('es-CO')}</span>
                      </button>
                    ))
                )}
              </div>
            </div>

            <div className="admin-pos-total">
              <strong>Total: ${total.toLocaleString('es-CO')}</strong>
              <button className="admin-btn-primary" onClick={closeTab}>
                Cerrar cuenta
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

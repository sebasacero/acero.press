import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

const STATUS_LABEL = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const SOURCE_LABEL = {
  web: 'Web',
  whatsapp: 'WhatsApp',
  pos: 'POS',
  table: 'Mesa',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('id, source, status, total, customer_phone, created_at, order_items(id, product_name_snapshot, variant_label_snapshot, qty, unit_price, variant_id)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error } = await query;
    if (error) console.error(error.message);
    setOrders(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Confirmar: pasa el pedido a 'confirmed' y descuenta inventario (venta real).
  const confirmOrder = async (order) => {
    setBusyId(order.id);
    for (const item of order.order_items) {
      if (!item.variant_id) continue;
      await supabase.from('inventory_movements').insert({
        variant_id: item.variant_id,
        change_qty: -item.qty,
        reason: 'sale',
        reference_order_id: order.id,
      });
      const { data: inv } = await supabase
        .from('inventory')
        .select('stock_qty')
        .eq('variant_id', item.variant_id)
        .maybeSingle();
      if (inv) {
        await supabase
          .from('inventory')
          .update({ stock_qty: Math.max(0, inv.stock_qty - item.qty), updated_at: new Date().toISOString() })
          .eq('variant_id', item.variant_id);
      }
    }
    await supabase
      .from('orders')
      .update({ status: 'confirmed', closed_at: new Date().toISOString() })
      .eq('id', order.id);
    setBusyId(null);
    await load();
  };

  const cancelOrder = async (orderId) => {
    setBusyId(orderId);
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    setBusyId(null);
    await load();
  };

  const completeOrder = async (orderId) => {
    setBusyId(orderId);
    await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
    setBusyId(null);
    await load();
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Pedidos</h1>
      <p className="admin-page-sub">
        Confirmar un pedido descuenta el inventario automáticamente (se registra como venta).
      </p>

      <div className="admin-tabs">
        {['pending', 'confirmed', 'completed', 'cancelled', 'all'].map((f) => (
          <button
            key={f}
            className={`admin-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Todos' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="admin-loading">Cargando pedidos…</p>
      ) : orders.length === 0 ? (
        <p className="admin-loading">No hay pedidos en este estado.</p>
      ) : (
        <div className="admin-orders-list">
          {orders.map((o) => (
            <div key={o.id} className="admin-order-card">
              <div className="admin-order-head">
                <div>
                  <span className={`admin-chip chip-source-${o.source}`}>{SOURCE_LABEL[o.source]}</span>
                  <span className={`admin-chip chip-status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                </div>
                <span className="admin-order-date">
                  {new Date(o.created_at).toLocaleString('es-CO')}
                </span>
              </div>

              <ul className="admin-order-items">
                {o.order_items.map((it) => (
                  <li key={it.id}>
                    {it.qty}× {it.product_name_snapshot}
                    {it.variant_label_snapshot ? ` (${it.variant_label_snapshot})` : ''} —{' '}
                    {(it.unit_price * it.qty).toLocaleString('es-CO')}
                  </li>
                ))}
              </ul>

              <div className="admin-order-foot">
                <strong>Total: ${Number(o.total).toLocaleString('es-CO')}</strong>
                <div className="admin-order-actions">
                  {o.status === 'pending' && (
                    <>
                      <button
                        className="admin-btn-primary admin-btn-sm"
                        disabled={busyId === o.id}
                        onClick={() => confirmOrder(o)}
                      >
                        Confirmar
                      </button>
                      <button
                        className="admin-btn-ghost admin-btn-sm"
                        disabled={busyId === o.id}
                        onClick={() => cancelOrder(o.id)}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {o.status === 'confirmed' && (
                    <button
                      className="admin-btn-primary admin-btn-sm"
                      disabled={busyId === o.id}
                      onClick={() => completeOrder(o.id)}
                    >
                      Marcar entregado
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

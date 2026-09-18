import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

const money = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO');

// clamp a un rango 0–100
const clamp100 = (n) => Math.max(0, Math.min(100, n));

function computeHealth(metric, value, cfg) {
  if (value === null || value === undefined) return 50; // sin datos suficientes: neutral
  switch (metric) {
    case 'sales_velocity':
    case 'revenue_growth':
      return clamp100(50 + value); // 0% cambio = 50, +50% = 100, -50% = 0
    case 'inventory_turnover':
      return clamp100((value / (cfg.threshold * 2)) * 100);
    case 'repeat_customer_rate':
      return clamp100((value / (cfg.threshold * 2)) * 100);
    case 'low_stock_penalty':
      return clamp100(100 - (value / cfg.threshold) * 100);
    default:
      return 50;
  }
}

function isAlert(metric, value, cfg) {
  if (value === null || value === undefined) return false;
  if (metric === 'low_stock_penalty') return value >= cfg.threshold;
  if (metric === 'inventory_turnover' || metric === 'repeat_customer_rate') return value < cfg.threshold;
  return value < cfg.threshold; // sales_velocity / revenue_growth: por debajo del umbral (usualmente 0)
}

function buildRecommendations(metrics, configByMetric) {
  const recs = [];
  const m = metrics;

  if (isAlert('sales_velocity', m.sales_velocity_pct, configByMetric.sales_velocity)) {
    recs.push(
      `Las ventas cayeron ${Math.abs(m.sales_velocity_pct)}% en los últimos 30 días frente a los 30 anteriores. Considera una promoción o descuento por tiempo limitado en tus productos de mayor rotación.`
    );
  } else if (m.sales_velocity_pct > 10) {
    recs.push(`Buen momento: las ventas crecieron ${m.sales_velocity_pct}% en 30 días. Vale la pena asegurar stock suficiente para no perder el impulso.`);
  }

  if (isAlert('inventory_turnover', m.inventory_turnover, configByMetric.inventory_turnover)) {
    recs.push('La rotación de inventario está baja: tienes más stock del que se está vendiendo. Evalúa reducir compras o lanzar una oferta para mover inventario estancado.');
  }

  if (isAlert('repeat_customer_rate', m.repeat_rate_pct, configByMetric.repeat_customer_rate)) {
    recs.push(
      `Solo ${m.repeat_rate_pct ?? 0}% de tus clientes ha comprado más de una vez. Impulsa la suscripción al envío mensual y las ofertas por correo para aumentar la recompra.`
    );
  }

  if (isAlert('revenue_growth', m.revenue_growth_pct, configByMetric.revenue_growth)) {
    recs.push(`Los ingresos de este mes van por debajo del mes pasado (${m.revenue_growth_pct}%). Revisa si algún canal de venta bajó su actividad.`);
  }

  if (isAlert('low_stock_penalty', m.low_stock_count, configByMetric.low_stock_penalty)) {
    recs.push(`Tienes ${m.low_stock_count} presentaciones con stock bajo. Repón pronto para no perder ventas por falta de inventario.`);
  }

  if (m.top_products?.length) {
    recs.push(`Tu producto más vendido es "${m.top_products[0].name}" — considera destacarlo en la página principal o crear un combo alrededor de él.`);
  }

  if (recs.length === 0) {
    recs.push('Todas las métricas están en rango saludable. Sigue monitoreando semana a semana.');
  }
  return recs;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  const [metrics, setMetrics] = useState(null);
  const [algoConfig, setAlgoConfig] = useState([]);
  const [editingAlgo, setEditingAlgo] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiModel, setAiModel] = useState(null);
  const [aiAt, setAiAt] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [savingAlgo, setSavingAlgo] = useState(false);
  const [algoError, setAlgoError] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const since7 = new Date();
    since7.setDate(since7.getDate() - 7);

    const [
      { data: orders7 },
      { data: items7 },
      { data: inv },
      { count: productsCount },
      { count: variantsCount },
      { count: customersCount },
      { count: offersCount },
      { count: monthlyCount },
      { data: recent },
      { data: tablesData },
      { data: metricsData, error: metricsError },
      { data: cfgData },
    ] = await Promise.all([
      supabase.from('orders').select('id, total, status, created_at').gte('created_at', since7.toISOString()),
      supabase
        .from('order_items')
        .select('product_name_snapshot, qty, orders!inner(status, created_at)')
        .gte('orders.created_at', since7.toISOString())
        .in('orders.status', ['confirmed', 'completed']),
      supabase.from('inventory').select('stock_qty, low_stock_threshold, product_variants(label, products(name))'),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('product_variants').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('subscribed_offers', true),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('monthly_subscription', true),
      supabase
        .from('orders')
        .select('id, source, status, total, created_at, order_items(product_name_snapshot, qty)')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('tables').select('id, status'),
      supabase.rpc('compute_growth_metrics'),
      supabase.from('growth_algorithm_config').select('*').order('weight', { ascending: false }),
    ]);

    const confirmed7 = (orders7 ?? []).filter((o) => o.status !== 'cancelled');
    const revenue7 = confirmed7.reduce((s, o) => s + Number(o.total), 0);
    const pendingCount = (orders7 ?? []).filter((o) => o.status === 'pending').length;

    const grouped = {};
    (items7 ?? []).forEach((i) => {
      grouped[i.product_name_snapshot] = (grouped[i.product_name_snapshot] || 0) + i.qty;
    });
    const top = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));

    setKpis({
      revenue7,
      ordersCount7: (orders7 ?? []).length,
      pendingCount,
      productsCount: productsCount ?? 0,
      variantsCount: variantsCount ?? 0,
      customersCount: customersCount ?? 0,
      offersCount: offersCount ?? 0,
      monthlyCount: monthlyCount ?? 0,
      tablesOccupied: (tablesData ?? []).filter((t) => t.status === 'occupied').length,
      tablesTotal: (tablesData ?? []).length,
    });
    setTopProducts(top);
    setLowStock((inv ?? []).filter((r) => r.stock_qty <= r.low_stock_threshold).slice(0, 8));
    setRecentOrders(recent ?? []);
    setAlgoConfig(cfgData ?? []);
    if (!metricsError) setMetrics(metricsData);
    else {
      console.error(metricsError);
      setAlgoError('No se pudieron calcular las métricas del algoritmo.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    supabase
      .from('growth_ai_insights')
      .select('insight, model, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAiInsight(data.insight);
          setAiModel(data.model);
          setAiAt(data.created_at);
        }
      });
  }, [loadAll]);

  const runAiAgent = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/growth-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics }),
      });
      if (!res.ok) throw new Error('not-configured');
      const data = await res.json();
      setAiInsight(data.insight);
      setAiModel(data.model);
      setAiAt(new Date().toISOString());
    } catch (err) {
      setAiError(
        err.message === 'not-configured'
          ? 'El agente de IA aún no está configurado (falta ANTHROPIC_API_KEY en el servidor).'
          : 'No se pudo completar el análisis. Intenta de nuevo.'
      );
    }
    setAiLoading(false);
  };

  const saveAlgoConfig = async (metric, field, value) => {
    setSavingAlgo(true);
    await supabase
      .from('growth_algorithm_config')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('metric', metric);
    setAlgoConfig((prev) => prev.map((c) => (c.metric === metric ? { ...c, [field]: value } : c)));
    setSavingAlgo(false);
  };

  if (loading || !kpis) return <p className="admin-loading">Calculando métricas…</p>;

  const maxQty = Math.max(1, ...topProducts.map((p) => p.qty));

  // --- Cálculo del puntaje de crecimiento ---
  const configByMetric = {};
  algoConfig.forEach((c) => (configByMetric[c.metric] = c));
  let score = null;
  let recommendations = [];
  if (metrics && algoConfig.length > 0) {
    const totalWeight = algoConfig.reduce((s, c) => s + Number(c.weight), 0) || 1;
    const valueByMetric = {
      sales_velocity: metrics.sales_velocity_pct,
      inventory_turnover: metrics.inventory_turnover,
      repeat_customer_rate: metrics.repeat_rate_pct,
      revenue_growth: metrics.revenue_growth_pct,
      low_stock_penalty: metrics.low_stock_count,
    };
    let weighted = 0;
    algoConfig.forEach((c) => {
      const health = computeHealth(c.metric, valueByMetric[c.metric], c);
      weighted += health * (Number(c.weight) / totalWeight);
    });
    score = Math.round(weighted);
    recommendations = buildRecommendations(
      { ...metrics, sales_velocity_pct: metrics.sales_velocity_pct ?? 0, revenue_growth_pct: metrics.revenue_growth_pct ?? 0 },
      configByMetric
    );
  }

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Dashboard</h1>
      <p className="admin-page-sub">Toda la base de datos de AceroPress, en un solo lugar — datos en vivo de Supabase.</p>

      {/* === KPIs generales === */}
      <div className="admin-kpi-grid admin-kpi-grid-wide">
        <div className="admin-kpi-card">
          <span className="admin-kpi-label">Ingresos (7d)</span>
          <span className="admin-kpi-num">{money(kpis.revenue7)}</span>
        </div>
        <div className="admin-kpi-card">
          <span className="admin-kpi-label">Pedidos (7d)</span>
          <span className="admin-kpi-num">{kpis.ordersCount7}</span>
        </div>
        <div className="admin-kpi-card">
          <span className="admin-kpi-label">Pendientes por confirmar</span>
          <span className="admin-kpi-num">{kpis.pendingCount}</span>
        </div>
        <div className="admin-kpi-card">
          <span className="admin-kpi-label">Clientes registrados</span>
          <span className="admin-kpi-num">{kpis.customersCount}</span>
        </div>
        <div className="admin-kpi-card">
          <span className="admin-kpi-label">Suscritos a ofertas</span>
          <span className="admin-kpi-num">{kpis.offersCount}</span>
        </div>
        <div className="admin-kpi-card">
          <span className="admin-kpi-label">Suscripción mensual</span>
          <span className="admin-kpi-num">{kpis.monthlyCount}</span>
        </div>
        <div className="admin-kpi-card">
          <span className="admin-kpi-label">Productos / variantes</span>
          <span className="admin-kpi-num">{kpis.productsCount} / {kpis.variantsCount}</span>
        </div>
        <div className="admin-kpi-card">
          <span className="admin-kpi-label">Mesas ocupadas</span>
          <span className="admin-kpi-num">{kpis.tablesOccupied} / {kpis.tablesTotal}</span>
        </div>
      </div>

      {/* === Algoritmo de crecimiento === */}
      <div className="admin-panel admin-growth-panel">
        <div className="admin-growth-header">
          <div>
            <h3>Algoritmo de crecimiento</h3>
            <p className="admin-page-sub" style={{ margin: 0 }}>
              Puntaje calculado a partir de 5 métricas reales del negocio, con pesos configurables.
            </p>
          </div>
          <button className="admin-btn-ghost admin-btn-sm" onClick={() => setEditingAlgo((v) => !v)}>
            {editingAlgo ? 'Cerrar edición' : 'Editar algoritmo'}
          </button>
        </div>

        <div className="admin-ai-agent">
          <button className="admin-btn-primary admin-btn-sm" disabled={aiLoading} onClick={runAiAgent}>
            {aiLoading ? 'Analizando con IA…' : '🤖 Analizar con IA (tendencias de mercado)'}
          </button>
          {aiError && <p className="cart-payment-error">{aiError}</p>}
          {aiInsight && (
            <div className="admin-ai-insight">
              <div className="admin-ai-insight-head">
                <span>Análisis de IA ({aiModel})</span>
                <span>{new Date(aiAt).toLocaleString('es-CO')}</span>
              </div>
              <p style={{ whiteSpace: 'pre-line' }}>{aiInsight}</p>
            </div>
          )}
        </div>

        {algoError && <p className="cart-payment-error">{algoError}</p>}

        {metrics && (
          <div className="admin-growth-body">
            <div className="admin-growth-score">
              <div className="admin-growth-gauge" style={{ '--score': score }}>
                <span>{score}</span>
                <small>/ 100</small>
              </div>
            </div>

            <div className="admin-growth-metrics">
              {algoConfig.map((c) => {
                const valueByMetric = {
                  sales_velocity: metrics.sales_velocity_pct,
                  inventory_turnover: metrics.inventory_turnover,
                  repeat_customer_rate: metrics.repeat_rate_pct,
                  revenue_growth: metrics.revenue_growth_pct,
                  low_stock_penalty: metrics.low_stock_count,
                }[c.metric];
                const alert = isAlert(c.metric, valueByMetric, c);
                return (
                  <div key={c.metric} className={`admin-growth-metric-row ${alert ? 'is-alert' : ''}`}>
                    <span className="admin-growth-metric-label">{c.label}</span>
                    <span className="admin-growth-metric-value">
                      {valueByMetric === null || valueByMetric === undefined ? 'Sin datos' : valueByMetric}
                      {['sales_velocity', 'revenue_growth', 'repeat_customer_rate'].includes(c.metric) ? '%' : ''}
                    </span>
                    <span className="admin-growth-metric-weight">peso {c.weight}</span>

                    {editingAlgo && (
                      <div className="admin-growth-edit-row">
                        <label>
                          Peso
                          <input
                            type="number"
                            defaultValue={c.weight}
                            disabled={savingAlgo}
                            onBlur={(e) => saveAlgoConfig(c.metric, 'weight', Number(e.target.value))}
                          />
                        </label>
                        <label>
                          Umbral
                          <input
                            type="number"
                            defaultValue={c.threshold}
                            disabled={savingAlgo}
                            onBlur={(e) => saveAlgoConfig(c.metric, 'threshold', Number(e.target.value))}
                          />
                        </label>
                        <span className="admin-growth-desc">{c.description}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="admin-growth-recs">
              <h4>Recomendaciones</h4>
              <ul>
                {recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* === Ranking + stock bajo === */}
      <div className="admin-panel-row">
        <div className="admin-panel">
          <h3>Más vendidos (7d)</h3>
          {topProducts.length === 0 ? (
            <p className="admin-loading">Sin ventas confirmadas todavía.</p>
          ) : (
            topProducts.map((p) => (
              <div key={p.name} className="admin-rank-row">
                <span>{p.name}</span>
                <div className="admin-rank-track">
                  <div className="admin-rank-fill" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                </div>
                <span>{p.qty}</span>
              </div>
            ))
          )}
        </div>

        <div className="admin-panel">
          <h3>Stock bajo</h3>
          {lowStock.length === 0 ? (
            <p className="admin-loading">Todo el inventario está en buen nivel.</p>
          ) : (
            <table className="admin-table">
              <tbody>
                {lowStock.map((r, i) => (
                  <tr key={i}>
                    <td>{r.product_variants?.products?.name}</td>
                    <td>{r.product_variants?.label}</td>
                    <td className="admin-stock-num">{r.stock_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* === Pedidos recientes (todas las fuentes) === */}
      <div className="admin-panel" style={{ marginTop: '1.2rem' }}>
        <h3>Pedidos recientes</h3>
        <table className="admin-table admin-table-wide">
          <thead>
            <tr><th>Fecha</th><th>Fuente</th><th>Estado</th><th>Productos</th><th>Total</th></tr>
          </thead>
          <tbody>
            {recentOrders.map((o) => (
              <tr key={o.id}>
                <td>{new Date(o.created_at).toLocaleString('es-CO')}</td>
                <td>{o.source}</td>
                <td><span className={`admin-chip chip-status-${o.status}`}>{o.status}</span></td>
                <td>{o.order_items.map((it) => `${it.qty}× ${it.product_name_snapshot}`).join(', ')}</td>
                <td>{money(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import MiniMarkdown from '../MiniMarkdown.jsx';

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

const METRIC_VALUE = (metrics) => ({
  sales_velocity: metrics.sales_velocity_pct,
  inventory_turnover: metrics.inventory_turnover,
  repeat_customer_rate: metrics.repeat_rate_pct,
  revenue_growth: metrics.revenue_growth_pct,
  low_stock_penalty: metrics.low_stock_count,
});
const PCT_METRICS = ['sales_velocity', 'revenue_growth', 'repeat_customer_rate'];
const STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmado', completed: 'Completado', cancelled: 'Cancelado' };
const SOURCE_LABEL = { web: 'Web', whatsapp: 'WhatsApp', pos: 'POS', table: 'Mesas', web_card: 'Tarjeta web', esspresale: 'Esspresale' };
const DAY_MS = 86_400_000;
const bogotaDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const shortMoney = (n) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : money(n));

/** Reactor central del HUD: un anillo por métrica (largo = salud) y el índice en el centro. */
function Reactor({ score, rings }) {
  const size = 280;
  const c = size / 2;
  const ticks = Array.from({ length: 72 });
  return (
    <svg className="hud-reactor" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Índice de crecimiento ${score ?? 'sin datos'} de 100`}>
      <circle cx={c} cy={c} r={134} className="hud-ring-faint" />
      {ticks.map((_, i) => {
        const a = (i / ticks.length) * Math.PI * 2;
        const long = i % 6 === 0;
        const r1 = 134;
        const r2 = long ? 124 : 129;
        return (
          <line key={i} x1={c + r1 * Math.sin(a)} y1={c - r1 * Math.cos(a)} x2={c + r2 * Math.sin(a)} y2={c - r2 * Math.cos(a)} className={long ? 'hud-tick hud-tick-long' : 'hud-tick'} />
        );
      })}
      <circle cx={c} cy={c} r={116} className="hud-ring-spin" />
      {rings.map((ring, i) => {
        const r = 100 - i * 13;
        const len = 2 * Math.PI * r;
        const on = (Math.max(2, ring.health) / 100) * len * 0.75;
        return (
          <g key={ring.metric} transform={`rotate(135 ${c} ${c})`}>
            <circle cx={c} cy={c} r={r} className="hud-arc-track" strokeDasharray={`${len * 0.75} ${len}`} />
            <circle cx={c} cy={c} r={r} className={`hud-arc ${ring.alert ? 'is-alert' : ''}`} strokeDasharray={`${on} ${len}`}>
              <title>{`${ring.label}: salud ${Math.round(ring.health)}/100`}</title>
            </circle>
          </g>
        );
      })}
      <circle cx={c} cy={c} r={34} className="hud-core" />
      <text x={c} y={c + 4} textAnchor="middle" className="hud-score">{score ?? '—'}</text>
      <text x={c} y={c + 22} textAnchor="middle" className="hud-score-sub">/ 100</text>
    </svg>
  );
}

/** Ingresos por día (30 días): barras con tooltip al pasar el mouse o tocar. */
function RevenueBars({ days }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const W = 600;
  const H = 150;
  const bw = W / days.length;
  const h = hover !== null ? days[hover] : null;
  return (
    <div className="hud-chart">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="hud-bars" role="img" aria-label="Ingresos por día, últimos 30 días" onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={H - f * H} y2={H - f * H} className="hud-gridline" />
        ))}
        {days.map((d, i) => {
          const bh = d.revenue > 0 ? Math.max(3, (d.revenue / max) * (H - 6)) : 0;
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={i * bw} y="0" width={bw} height={H} fill="transparent" />
              {bh > 0 && <rect x={i * bw + 1.5} y={H - bh} width={bw - 3} height={bh} rx="2" className={`hud-bar ${d.isToday ? 'is-today' : ''} ${hover === i ? 'is-hover' : ''}`} />}
              {d.revenue === 0 && <rect x={i * bw + 1.5} y={H - 2} width={bw - 3} height="2" className="hud-bar-zero" />}
            </g>
          );
        })}
        <text x="0" y={H + 14} className="hud-axis">{days[0]?.label}</text>
        <text x={W} y={H + 14} textAnchor="end" className="hud-axis">HOY</text>
        <text x={W - 2} y="10" textAnchor="end" className="hud-axis">{shortMoney(max)}</text>
      </svg>
      <div className="hud-chart-readout" aria-live="polite">
        {h ? (
          <>
            <span>{h.label}</span>
            <strong>{money(h.revenue)}</strong>
            <span>{h.count} pedido{h.count === 1 ? '' : 's'}</span>
          </>
        ) : (
          <span>Pasa el cursor sobre un día</span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [days30, setDays30] = useState([]);
  const [channels, setChannels] = useState([]);
  const [ig, setIg] = useState(null); // { followers, delta, posts: [...] } o null si aún no hay datos
  const [metrics, setMetrics] = useState(null);
  const [algoConfig, setAlgoConfig] = useState([]);
  const [editingAlgo, setEditingAlgo] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiModel, setAiModel] = useState(null);
  const [aiAt, setAiAt] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiSources, setAiSources] = useState([]);
  const [savingAlgo, setSavingAlgo] = useState(false);
  const [algoError, setAlgoError] = useState(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const now = Date.now();
    const since7 = new Date(now - 7 * DAY_MS).toISOString();
    const since30 = new Date(now - 30 * DAY_MS).toISOString();

    const [
      { data: orders30 },
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
      igDaily,
      igMedia,
    ] = await Promise.all([
      supabase.from('orders').select('id, total, status, source, created_at, closed_at').gte('created_at', since30),
      supabase
        .from('order_items')
        .select('product_name_snapshot, qty, orders!inner(status, created_at)')
        .gte('orders.created_at', since7)
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
      // Instagram: tablas nuevas; si aún no existen, el panel simplemente no se muestra.
      supabase.from('ig_account_daily').select('day, followers_count').order('day', { ascending: false }).limit(8),
      supabase.from('ig_media').select('id, media_product, caption, posted_at, reach, like_count, saved').order('posted_at', { ascending: false }).limit(5),
    ]);

    const all30 = orders30 ?? [];
    const sold30 = all30.filter((o) => o.status === 'confirmed' || o.status === 'completed');
    const inLast = (o, from, to = now) => {
      const t = new Date(o.closed_at || o.created_at).getTime();
      return t >= from && t < to;
    };
    const sum = (rows) => rows.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const todayKey = bogotaDay(now);
    const sold7 = sold30.filter((o) => inLast(o, now - 7 * DAY_MS));
    const soldPrev7 = sold30.filter((o) => inLast(o, now - 14 * DAY_MS, now - 7 * DAY_MS));
    const revenue7 = sum(sold7);
    const revenuePrev7 = sum(soldPrev7);

    // Serie diaria (30 días, en hora de Bogotá)
    const byDay = new Map();
    for (let i = 29; i >= 0; i--) {
      const key = bogotaDay(now - i * DAY_MS);
      byDay.set(key, {
        key,
        label: new Date(now - i * DAY_MS).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' }),
        revenue: 0,
        count: 0,
        isToday: key === todayKey,
      });
    }
    sold30.forEach((o) => {
      const d = byDay.get(bogotaDay(o.closed_at || o.created_at));
      if (d) { d.revenue += Number(o.total || 0); d.count += 1; }
    });

    // Canales (30 días)
    const ch = {};
    sold30.forEach((o) => { ch[o.source] = (ch[o.source] || 0) + Number(o.total || 0); });
    const channelRows = Object.entries(ch).map(([k, v]) => ({ key: k, label: SOURCE_LABEL[k] || k, revenue: v })).sort((a, b) => b.revenue - a.revenue);

    const grouped = {};
    (items7 ?? []).forEach((i) => { grouped[i.product_name_snapshot] = (grouped[i.product_name_snapshot] || 0) + i.qty; });
    const top = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));

    setKpis({
      revenueToday: byDay.get(todayKey)?.revenue ?? 0,
      ordersToday: byDay.get(todayKey)?.count ?? 0,
      revenue7,
      delta7: revenuePrev7 > 0 ? Math.round(((revenue7 - revenuePrev7) / revenuePrev7) * 100) : null,
      ordersCount7: all30.filter((o) => inLast(o, now - 7 * DAY_MS)).length,
      avgTicket: sold30.length ? sum(sold30) / sold30.length : 0,
      pendingCount: all30.filter((o) => o.status === 'pending').length,
      productsCount: productsCount ?? 0,
      variantsCount: variantsCount ?? 0,
      customersCount: customersCount ?? 0,
      offersCount: offersCount ?? 0,
      monthlyCount: monthlyCount ?? 0,
      tablesOccupied: (tablesData ?? []).filter((t) => t.status === 'occupied').length,
      tablesTotal: (tablesData ?? []).length,
    });
    setDays30([...byDay.values()]);
    setChannels(channelRows);
    setTopProducts(top);
    setLowStock((inv ?? []).filter((r) => r.stock_qty <= r.low_stock_threshold).slice(0, 8));
    setRecentOrders(recent ?? []);
    setAlgoConfig(cfgData ?? []);

    const followers = igDaily.data ?? [];
    if (!igDaily.error && followers.length) {
      const last = followers[0]?.followers_count ?? null;
      const prev = followers[followers.length - 1]?.followers_count ?? null;
      setIg({ followers: last, delta: last !== null && prev !== null ? last - prev : null, since: followers[followers.length - 1]?.day, posts: igMedia.error ? [] : igMedia.data ?? [] });
    } else {
      setIg(null);
    }

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
      .select('insight, model, created_at, sources')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAiInsight(data.insight);
          setAiModel(data.model);
          setAiAt(data.created_at);
          setAiSources(data.sources ?? []);
        }
      });
  }, [loadAll]);

  // El servidor junta los datos reales (ventas, Esspresale, inventario,
  // Instagram) con tu sesión y Claude los cruza con tendencias de la web.
  const runAiAgent = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/growth-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ question: aiQuestion.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error === 'not-configured'
          ? 'El asistente aún no está configurado: falta ANTHROPIC_API_KEY en Vercel.'
          : data.error || 'No se pudo completar el análisis. Intenta de nuevo.');
      }
      setAiInsight(data.insight);
      setAiModel(data.model);
      setAiSources(data.sources ?? []);
      setAiAt(new Date().toISOString());
    } catch (err) {
      setAiError(err.message);
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

  if (loading || !kpis) {
    return (
      <div className="admin-page esp dash">
        <p className="dash-booting">INICIANDO SISTEMAS · CALCULANDO MÉTRICAS…</p>
      </div>
    );
  }

  const maxQty = Math.max(1, ...topProducts.map((p) => p.qty));
  const maxChannel = Math.max(1, ...channels.map((c) => c.revenue));

  // --- Índice de crecimiento (mismo algoritmo de siempre) ---
  const configByMetric = {};
  algoConfig.forEach((c) => (configByMetric[c.metric] = c));
  let score = null;
  let recommendations = [];
  let rings = [];
  if (metrics && algoConfig.length > 0) {
    const totalWeight = algoConfig.reduce((s, c) => s + Number(c.weight), 0) || 1;
    const values = METRIC_VALUE(metrics);
    let weighted = 0;
    rings = algoConfig.map((c) => {
      const health = computeHealth(c.metric, values[c.metric], c);
      weighted += health * (Number(c.weight) / totalWeight);
      return { metric: c.metric, label: c.label, health, alert: isAlert(c.metric, values[c.metric], c), value: values[c.metric], cfg: c };
    });
    score = Math.round(weighted);
    recommendations = buildRecommendations(
      { ...metrics, sales_velocity_pct: metrics.sales_velocity_pct ?? 0, revenue_growth_pct: metrics.revenue_growth_pct ?? 0 },
      configByMetric
    );
  }
  const alerts = rings.filter((r) => r.alert).length;
  const status = score === null ? 'SIN DATOS' : score >= 70 ? 'ÓPTIMO' : score >= 45 ? 'ESTABLE' : 'ATENCIÓN';
  const clockStr = clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Bogota' });

  return (
    <div className="admin-page esp dash">
      <header className="esp-head">
        <div className="esp-cota">
          <span>FIG. 00 — DASHBOARD / OPERACIÓN EN VIVO</span>
          <span className="esp-badge">BOGOTÁ · {clockStr}</span>
        </div>
        <h1 className="esp-title">Dashboard.</h1>
        <p className="esp-sub">Toda la operación de AceroPress con datos en vivo de Supabase: ventas, inventario, clientes y redes.</p>
      </header>

      {/* === KPIs === */}
      <div className="dash-kpis">
        <div className="dash-kpi dash-kpi-hero">
          <span className="dash-kpi-label">Ingresos hoy</span>
          <strong className="dash-kpi-num">{money(kpis.revenueToday)}</strong>
          <span className="dash-kpi-foot">{kpis.ordersToday} venta{kpis.ordersToday === 1 ? '' : 's'}</span>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Ingresos 7 días</span>
          <strong className="dash-kpi-num">{money(kpis.revenue7)}</strong>
          <span className={`dash-kpi-foot ${kpis.delta7 < 0 ? 'is-down' : ''}`}>
            {kpis.delta7 === null ? 'Sin semana anterior para comparar' : `${kpis.delta7 >= 0 ? '▲' : '▼'} ${Math.abs(kpis.delta7)}% vs. semana anterior`}
          </span>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Ticket prom. 30 d</span>
          <strong className="dash-kpi-num">{money(kpis.avgTicket)}</strong>
          <span className="dash-kpi-foot">{kpis.ordersCount7} pedidos en 7 días</span>
        </div>
        <div className={`dash-kpi ${kpis.pendingCount ? 'is-warn' : ''}`}>
          <span className="dash-kpi-label">Por confirmar</span>
          <strong className="dash-kpi-num">{kpis.pendingCount}</strong>
          <span className="dash-kpi-foot">pedidos pendientes</span>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Clientes</span>
          <strong className="dash-kpi-num">{kpis.customersCount}</strong>
          <span className="dash-kpi-foot">{kpis.offersCount} en ofertas · {kpis.monthlyCount} mensual</span>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Mesas</span>
          <strong className="dash-kpi-num">{kpis.tablesOccupied}/{kpis.tablesTotal}</strong>
          <span className="dash-kpi-foot">{kpis.productsCount} productos · {kpis.variantsCount} variantes</span>
        </div>
      </div>

      {/* === HUD del agente de crecimiento === */}
      <section className="hud" aria-label="Agente de crecimiento">
        <div className="hud-top">
          <div className="hud-id">
            <span className="hud-live" aria-hidden="true" />
            <strong>A.C.E.R.O.</strong>
            <span>AGENTE DE CRECIMIENTO · EN LÍNEA</span>
          </div>
          <div className="hud-top-right">
            <span>ESTADO: <b className={score !== null && score < 45 ? 'is-alert' : ''}>{status}</b></span>
            <span>ALERTAS: <b className={alerts ? 'is-alert' : ''}>{alerts}</b></span>
            <button type="button" className="hud-btn" onClick={() => setEditingAlgo((v) => !v)}>
              {editingAlgo ? 'CERRAR CALIBRACIÓN' : 'CALIBRAR'}
            </button>
            <button type="button" className="hud-btn" onClick={loadAll}>ACTUALIZAR</button>
          </div>
        </div>

        {algoError && <p className="hud-error">{algoError}</p>}

        <div className="hud-grid">
          <div className="hud-cell hud-core-cell">
            <div className="hud-cell-head"><span>ÍNDICE DE CRECIMIENTO</span><span>5 SENSORES</span></div>
            <Reactor score={score} rings={rings} />
            <p className="hud-caption">Cada anillo es una métrica: más largo = más sano. Rojo = bajo el umbral.</p>
          </div>

          <div className="hud-cell">
            <div className="hud-cell-head"><span>TELEMETRÍA</span><span>PESO</span></div>
            <ul className="hud-telemetry">
              {rings.map((r, i) => (
                <li key={r.metric} className={r.alert ? 'is-alert' : ''}>
                  <div className="hud-tel-row">
                    <span className="hud-tel-idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className="hud-tel-label">{r.label}</span>
                    <span className="hud-tel-value">
                      {r.value === null || r.value === undefined ? 'SIN DATOS' : `${r.value}${PCT_METRICS.includes(r.metric) ? '%' : ''}`}
                    </span>
                    <span className="hud-tel-weight">{r.cfg.weight}</span>
                  </div>
                  <div className="hud-meter" aria-hidden="true"><span style={{ width: `${Math.round(r.health)}%` }} /></div>
                  {r.alert && <span className="hud-tel-flag">▲ BAJO EL UMBRAL ({r.cfg.threshold})</span>}
                  {editingAlgo && (
                    <div className="hud-calibrate">
                      <label>
                        PESO
                        <input type="number" defaultValue={r.cfg.weight} disabled={savingAlgo} onBlur={(e) => saveAlgoConfig(r.metric, 'weight', Number(e.target.value))} />
                      </label>
                      <label>
                        UMBRAL
                        <input type="number" defaultValue={r.cfg.threshold} disabled={savingAlgo} onBlur={(e) => saveAlgoConfig(r.metric, 'threshold', Number(e.target.value))} />
                      </label>
                      {r.cfg.description && <span>{r.cfg.description}</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="hud-cell">
            <div className="hud-cell-head"><span>DIAGNÓSTICO</span><span>REGLAS</span></div>
            <ol className="hud-console">
              {recommendations.map((r, i) => (
                <li key={i}><span className="hud-prompt">›</span>{r}</li>
              ))}
            </ol>
          </div>

          <div className="hud-cell hud-wide">
            <div className="hud-cell-head"><span>INGRESOS · ÚLTIMOS 30 DÍAS</span><span>{money(days30.reduce((s, d) => s + d.revenue, 0))}</span></div>
            <RevenueBars days={days30} />
          </div>

          <div className="hud-cell">
            <div className="hud-cell-head"><span>CANALES · 30 DÍAS</span><span>COP</span></div>
            {channels.length === 0 ? (
              <p className="hud-muted">Sin ventas confirmadas en 30 días.</p>
            ) : (
              <ul className="hud-channels">
                {channels.map((c) => (
                  <li key={c.key}>
                    <span className="hud-ch-label">{c.label}</span>
                    <div className="hud-meter"><span style={{ width: `${(c.revenue / maxChannel) * 100}%` }} /></div>
                    <span className="hud-ch-value">{shortMoney(c.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="hud-cell-head hud-sub-head"><span>INSTAGRAM</span><span>{ig ? 'CONECTADO' : 'SIN CONECTAR'}</span></div>
            {ig ? (
              <div className="hud-ig">
                <strong>{ig.followers?.toLocaleString('es-CO') ?? '—'}</strong>
                <span>seguidores{ig.delta !== null ? ` · ${ig.delta >= 0 ? '+' : ''}${ig.delta} desde ${ig.since}` : ''}</span>
                {ig.posts[0] && <span className="hud-muted">Último post: {ig.posts[0].reach?.toLocaleString('es-CO') ?? '—'} de alcance · {ig.posts[0].saved ?? 0} guardados</span>}
              </div>
            ) : (
              <p className="hud-muted">Conecta Instagram en Panel → Instagram para ver seguidores y alcance aquí.</p>
            )}
          </div>

          <div className="hud-cell hud-wide hud-terminal">
            <div className="hud-cell-head">
              <span>CANAL DIRECTO CON EL AGENTE · CLAUDE + DATOS REALES + TENDENCIAS WEB</span>
              <span>{aiAt ? `ÚLTIMO: ${new Date(aiAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'SIN ANÁLISIS'}</span>
            </div>
            <div className="hud-ask">
              <span className="hud-prompt" aria-hidden="true">›</span>
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !aiLoading) runAiAgent(); }}
                placeholder="Pregunta algo… ej. ¿qué publico esta semana para vender más cold brew?"
                aria-label="Pregunta para el agente"
              />
              <button type="button" className="hud-btn hud-btn-primary" disabled={aiLoading} onClick={runAiAgent}>
                {aiLoading ? 'PROCESANDO…' : aiQuestion.trim() ? 'EJECUTAR' : 'ANÁLISIS SEMANAL'}
              </button>
            </div>
            {aiLoading && <p className="hud-scan">Cruzando ventas, inventario, Instagram y tendencias de la web… (hasta 2 min)</p>}
            {aiError && <p className="hud-error">{aiError}</p>}
            {aiInsight && (
              <div className="hud-insight">
                <MiniMarkdown text={aiInsight} />
                {aiSources.length > 0 && (
                  <details className="hud-sources">
                    <summary>FUENTES ({aiSources.length})</summary>
                    <ul>
                      {aiSources.map((src) => (
                        <li key={src.url}><a href={src.url} target="_blank" rel="noopener noreferrer">{src.title || src.url}</a></li>
                      ))}
                    </ul>
                  </details>
                )}
                {aiModel && <p className="hud-muted">Modelo: {aiModel}</p>}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* === Ranking + stock bajo === */}
      <div className="dash-row">
        <section className="dash-sheet">
          <div className="esp-cota"><span>FIG. 01 — MÁS VENDIDOS · 7 DÍAS</span><span>UNIDADES</span></div>
          {topProducts.length === 0 ? (
            <p className="esp-muted">Sin ventas confirmadas todavía.</p>
          ) : (
            <ul className="dash-rank">
              {topProducts.map((p, i) => (
                <li key={p.name}>
                  <span className="dash-rank-idx">{String(i + 1).padStart(2, '0')}</span>
                  <span className="dash-rank-name">{p.name}</span>
                  <div className="dash-rank-track"><span style={{ width: `${(p.qty / maxQty) * 100}%` }} /></div>
                  <strong>{p.qty}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-sheet">
          <div className="esp-cota"><span>FIG. 02 — STOCK BAJO</span><span className={lowStock.length ? 'esp-badge' : ''}>{lowStock.length} {lowStock.length === 1 ? 'ALERTA' : 'ALERTAS'}</span></div>
          {lowStock.length === 0 ? (
            <p className="esp-muted">Todo el inventario está en buen nivel.</p>
          ) : (
            <table className="dash-table">
              <tbody>
                {lowStock.map((r, i) => (
                  <tr key={i}>
                    <td>{r.product_variants?.products?.name}</td>
                    <td>{r.product_variants?.label}</td>
                    <td className="dash-num is-alert">{r.stock_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* === Pedidos recientes === */}
      <section className="dash-sheet">
        <div className="esp-cota"><span>FIG. 03 — PEDIDOS RECIENTES · TODAS LAS FUENTES</span><span>{recentOrders.length}</span></div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr><th>Fecha</th><th>Fuente</th><th>Estado</th><th>Productos</th><th className="dash-num">Total</th></tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id}>
                  <td>{new Date(o.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{SOURCE_LABEL[o.source] || o.source}</td>
                  <td><span className={`dash-status dash-status-${o.status}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
                  <td>{o.order_items.map((it) => `${it.qty}× ${it.product_name_snapshot}`).join(', ')}</td>
                  <td className="dash-num">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { ADMIN_GROUPS, ADMIN_TOOLS, toolById } from './adminTools.js';
import './admin.css';

const LAST_TOOL_KEY = 'acero_admin_last';

export function readLastTool(fallback = 'espresale') {
  try {
    const id = localStorage.getItem(LAST_TOOL_KEY);
    return ADMIN_TOOLS.some((t) => t.id === id) ? id : fallback;
  } catch {
    return fallback;
  }
}

/** Contadores en vivo para la navegación: lo que pide atención sin tener que entrar. */
function useAdminSignals() {
  const [signals, setSignals] = useState({ pending: null, occupied: null, lowStock: null });
  const load = useCallback(async () => {
    const [pending, occupied, inv] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('tables').select('id', { count: 'exact', head: true }).eq('status', 'occupied'),
      supabase.from('inventory').select('stock_qty, low_stock_threshold'),
    ]);
    setSignals({
      pending: pending.error ? null : pending.count ?? 0,
      occupied: occupied.error ? null : occupied.count ?? 0,
      lowStock: inv.error ? null : (inv.data ?? []).filter((r) => r.stock_qty <= r.low_stock_threshold).length,
    });
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);
  return [signals, load];
}

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function CommandPalette({ items, onClose }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const results = useMemo(() => {
    const n = norm(q.trim());
    return n ? items.filter((it) => norm(`${it.label} ${it.hint ?? ''} ${it.group ?? ''}`).includes(n)) : items;
  }, [q, items]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setIdx(0); }, [q]);

  const run = (it) => { onClose(); it.run(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && results[idx]) { e.preventDefault(); run(results[idx]); }
  };

  return (
    <div className="ax-palette-backdrop" onClick={onClose}>
      <div className="ax-palette" role="dialog" aria-modal="true" aria-label="Buscar en el panel" onClick={(e) => e.stopPropagation()}>
        <div className="ax-palette-input">
          <span aria-hidden="true">›</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ir a… o hacer… (ej. pedidos, stock, vender)"
            aria-label="Buscar"
            role="combobox"
            aria-expanded="true"
            aria-controls="ax-palette-list"
            aria-activedescendant={results[idx] ? `ax-opt-${results[idx].key}` : undefined}
          />
          <kbd>ESC</kbd>
        </div>
        <ul id="ax-palette-list" className="ax-palette-list" role="listbox">
          {results.length === 0 && <li className="ax-palette-empty">Sin resultados.</li>}
          {results.map((it, i) => (
            <li key={it.key} id={`ax-opt-${it.key}`} role="option" aria-selected={i === idx}>
              <button type="button" className={`ax-palette-item ${i === idx ? 'is-active' : ''}`} onMouseEnter={() => setIdx(i)} onClick={() => run(it)}>
                <span className="ax-palette-kind">{it.kind}</span>
                <span className="ax-palette-label">{it.label}</span>
                {it.hint && <span className="ax-palette-hint">{it.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="ax-palette-foot"><span>↑↓ navegar</span><span>↵ abrir</span><span>⌘K / Ctrl K en cualquier momento</span></div>
      </div>
    </div>
  );
}

/**
 * Marco del panel de administración (el flotante sobre el sitio y /admin).
 * activeTool / onSelect: herramienta activa. onExit: volver al sitio o salir.
 */
export default function AdminShell({ activeTool, onSelect, onExit, exitLabel = '← Volver al sitio', userLabel, overlay = false }) {
  const [signals, reloadSignals] = useAdminSignals();
  const [menuOpen, setMenuOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const tool = toolById(activeTool);
  // Elegir algo siempre cierra el menú (también si es la sección actual).
  const select = useCallback((id) => { setMenuOpen(false); onSelect(id); }, [onSelect]);
  const group = ADMIN_GROUPS.find((g) => g.id === tool.group);
  const Active = tool.Component;

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LAST_TOOL_KEY, tool.id); } catch { /* sin almacenamiento */ }
    reloadSignals();
  }, [tool.id, reloadSignals]);

  // Teclado: ⌘K / Ctrl+K abre la paleta; Esc cierra la paleta, luego el menú, luego el panel flotante.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      } else if (e.key === 'Escape') {
        if (palette) setPalette(false);
        else if (menuOpen) setMenuOpen(false);
        else if (overlay && !document.querySelector('.bp-drawer-backdrop')) onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [palette, menuOpen, overlay, onExit]);

  const badge = (t) => {
    const n = t.signal ? signals[t.signal] : null;
    if (!n) return null;
    const warn = t.signal === 'pending' || t.signal === 'lowStock';
    return <span className={`ax-badge ${warn ? 'is-warn' : ''}`} aria-label={`${n} pendientes`}>{n}</span>;
  };

  const alerts = [
    signals.pending > 0 && { key: 'pending', text: `${signals.pending} por confirmar`, to: 'orders' },
    signals.lowStock > 0 && { key: 'low', text: `${signals.lowStock} con stock bajo`, to: 'inventory' },
  ].filter(Boolean);

  const paletteItems = useMemo(() => [
    ...ADMIN_TOOLS.map((t) => ({
      key: `go-${t.id}`, kind: 'IR A', label: t.label, hint: t.desc,
      group: ADMIN_GROUPS.find((g) => g.id === t.group)?.label, run: () => select(t.id),
    })),
    { key: 'act-sale', kind: 'ACCIÓN', label: 'Registrar una venta', hint: 'Micra · venta en barra', run: () => select('espresale') },
    { key: 'act-pending', kind: 'ACCIÓN', label: 'Confirmar pedidos pendientes', hint: 'Pedidos', run: () => select('orders') },
    { key: 'act-stock', kind: 'ACCIÓN', label: 'Reponer stock bajo', hint: 'Inventario', run: () => select('inventory') },
    { key: 'act-agent', kind: 'ACCIÓN', label: 'Preguntarle al agente', hint: 'Agente · canal directo', run: () => select('dashboard') },
    { key: 'act-ig', kind: 'ACCIÓN', label: 'Renovar token de Instagram', hint: 'Instagram', run: () => select('instagram') },
    { key: 'act-exit', kind: 'SALIR', label: exitLabel.replace('← ', ''), run: onExit },
  ], [select, onExit, exitLabel]);

  const clockStr = clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' });
  let n = 0;

  return (
    <div className={`ax-shell admin-shell ${overlay ? 'ax-overlay' : ''}`}>
      <aside className={`ax-side ${menuOpen ? 'is-open' : ''}`} aria-label="Navegación del panel">
        <div className="ax-brand">
          <span className="ax-brand-name">ACERO<em>.press</em></span>
          <span className="ax-brand-sub"><i className="ax-live" aria-hidden="true" /> PANEL · {clockStr}</span>
        </div>

        <button type="button" className="ax-search" onClick={() => setPalette(true)}>
          <span>Buscar o ir a…</span>
          <kbd>⌘K</kbd>
        </button>

        <nav className="ax-nav">
          {ADMIN_GROUPS.map((g, gi) => (
            <div key={g.id} className="ax-group">
              <div className="ax-group-head">
                <span>{String(gi + 1).padStart(2, '0')}</span>
                {g.label}
              </div>
              {ADMIN_TOOLS.filter((t) => t.group === g.id).map((t) => {
                n += 1;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`ax-item ${t.id === tool.id ? 'is-active' : ''}`}
                    aria-current={t.id === tool.id ? 'page' : undefined}
                    onClick={() => select(t.id)}
                  >
                    <span className="ax-item-fig">{String(n).padStart(2, '0')}</span>
                    <span className="ax-item-label">{t.label}</span>
                    {badge(t)}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="ax-foot">
          {userLabel && <span className="ax-user">{userLabel}</span>}
          <button type="button" className="ax-exit" onClick={onExit}>{exitLabel}</button>
        </div>
      </aside>
      {menuOpen && <div className="ax-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <div className="ax-body">
        <header className="ax-top">
          <button type="button" className="ax-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <span /><span /><span />
          </button>
          <div className="ax-crumb">
            <span className="ax-crumb-group">{group?.label}</span>
            <span className="ax-crumb-sep">/</span>
            <strong>{tool.label}</strong>
            <span className="ax-crumb-desc">{tool.desc}</span>
          </div>
          <div className="ax-top-right">
            {alerts.map((a) => (
              <button key={a.key} type="button" className="ax-alert" onClick={() => select(a.to)}>
                <i aria-hidden="true" />{a.text}
              </button>
            ))}
            <button type="button" className="ax-icon-btn" onClick={() => setPalette(true)} aria-label="Buscar (Ctrl K)">⌘K</button>
            {overlay && <button type="button" className="ax-icon-btn ax-close" onClick={onExit} aria-label="Cerrar panel">×</button>}
          </div>
        </header>
        <main className="admin-main ax-main" key={tool.id}>
          <Active />
        </main>
      </div>

      {palette && <CommandPalette items={paletteItems} onClose={() => setPalette(false)} />}
    </div>
  );
}

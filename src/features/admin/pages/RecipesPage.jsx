import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { shapeProducts } from '../../../shared/lib/productShape.js';
import { autoPairAll } from '../../../shared/lib/pairing.js';
import recipes from '../../recipes/data/recipes.js';

const COFFEE_ORDER = ['250G', '500G', '1KG'];
// 250G, 500G, 1KG primero; el resto, por precio.
const rank = (v) => (COFFEE_ORDER.includes(v.label) ? COFFEE_ORDER.indexOf(v.label) : COFFEE_ORDER.length);
const sizesOf = (p) =>
  [...(p?.product_variants ?? [])]
    .filter((v) => v.active)
    .sort((a, b) => rank(a) - rank(b) || Number(a.price) - Number(b.price))
    .map((v) => v.label);
const label = (p) => (p.brand ? `${p.name} · ${p.brand}` : p.name) + (p.active ? '' : ' (oculto)');
const SOURCE = {
  manual: { text: 'MANUAL', hint: 'Lo elegiste tú: el agente no lo cambia.' },
  agent: { text: 'AGENTE', hint: 'Lo ajustó el agente con ventas y mercado.' },
  auto: { text: 'AUTOMÁTICO', hint: 'Regla de la página: misma variedad > perfil > proceso > origen.' },
};

/**
 * Recetas que venden. Cada receta campeona tiene un café y un kit:
 * manual (lo eliges aquí) > agente (lo ajusta con datos) > automático (regla sin IA).
 */
export default function RecipesPage() {
  const [products, setProducts] = useState([]);
  const [rows, setRows] = useState({}); // año → fila guardada (manual o agente)
  const [drafts, setDrafts] = useState({}); // año → edición en curso
  const [missingTable, setMissingTable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingYear, setSavingYear] = useState(null);
  const [msg, setMsg] = useState({});
  const [agent, setAgent] = useState({ busy: false, result: null, error: null });

  const load = useCallback(async () => {
    const [prod, pair] = await Promise.all([
      supabase.from('products').select('id, slug, name, brand, description, variety, region, category, active, image_url, product_variants(id, label, price, active)').order('name'),
      supabase.from('recipe_pairings').select('*'),
    ]);
    setProducts(prod.data ?? []);
    if (pair.error) {
      setMissingTable(true);
    } else {
      setRows(Object.fromEntries((pair.data ?? []).map((r) => [r.recipe_year, { ...r, note: r.note ?? '', kit_ids: r.kit_ids ?? [], source: r.source ?? 'manual' }])));
      setDrafts({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const coffees = products.filter((p) => p.category === 'coffee_bag');
  const gear = products.filter((p) => p.category !== 'coffee_bag');
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  // Lo que diría la regla automática para cada receta (con los productos activos).
  const auto = useMemo(() => {
    const active = shapeProducts(products.filter((p) => p.active));
    return autoPairAll(recipes, active.filter((p) => p.category === 'coffee_bag'), active.filter((p) => p.category !== 'coffee_bag'));
  }, [products]);

  const baseOf = (year) => {
    if (rows[year]) return rows[year];
    const a = auto[year];
    return a
      ? { coffee_id: a.coffee.uuid, coffee_size: a.size, kit_ids: a.extras.map((x) => x.uuid), note: a.note ?? '', source: 'auto' }
      : { coffee_id: '', coffee_size: '250G', kit_ids: [], note: '', source: 'auto' };
  };
  const draftOf = (year) => drafts[year] ?? baseOf(year);
  const edit = (year, patch) => setDrafts((d) => ({ ...d, [year]: { ...draftOf(year), ...patch } }));
  const isDirty = (year) => !!drafts[year] && JSON.stringify(drafts[year]) !== JSON.stringify(baseOf(year));

  const note = (year, err, text) => setMsg((m) => ({ ...m, [year]: { err, text } }));

  const save = async (year) => {
    const d = draftOf(year);
    if (!d.coffee_id) return note(year, true, 'Elige un café.');
    setSavingYear(year);
    const { error } = await supabase.from('recipe_pairings').upsert({
      recipe_year: year,
      coffee_id: d.coffee_id,
      coffee_size: d.coffee_size,
      kit_ids: d.kit_ids,
      note: d.note.trim() || null,
      source: 'manual',
      updated_at: new Date().toISOString(),
    });
    setSavingYear(null);
    if (error) return note(year, true, error.message);
    setRows((r) => ({ ...r, [year]: { ...d, note: d.note.trim(), source: 'manual' } }));
    setDrafts((dr) => { const n = { ...dr }; delete n[year]; return n; });
    note(year, false, 'Guardado como manual: ya se ve en la tienda.');
  };

  const backToAuto = async (year) => {
    setSavingYear(year);
    const { error } = await supabase.from('recipe_pairings').delete().eq('recipe_year', year);
    setSavingYear(null);
    if (error) return note(year, true, error.message);
    setRows((r) => { const n = { ...r }; delete n[year]; return n; });
    setDrafts((dr) => { const n = { ...dr }; delete n[year]; return n; });
    note(year, false, 'De vuelta a la regla automática.');
  };

  const runAgent = async () => {
    setAgent({ busy: true, result: null, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/growth-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ action: 'pairings' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error === 'not-configured' ? 'El agente aún no está configurado: falta ANTHROPIC_API_KEY en Vercel.' : data.error || 'El agente no pudo revisar los kits.');
      }
      setAgent({ busy: false, result: data, error: null });
      await load();
    } catch (err) {
      setAgent({ busy: false, result: null, error: err.message });
    }
  };

  if (loading) return <p className="admin-loading">Cargando recetas…</p>;

  const counts = { manual: 0, agent: 0, auto: 0 };
  recipes.forEach((r) => { counts[rows[r.year]?.source ?? 'auto'] += 1; });

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Recetas</h1>
      <p className="admin-page-sub">
        Cada receta campeona sale en la tienda con un café y un kit (“Prepárala con…” y “Añadir kit”).
      </p>

      {missingTable ? (
        <p className="rp-warn">
          Falta la tabla <code>recipe_pairings</code> en Supabase. Mientras tanto la tienda usa solo la regla automática.
        </p>
      ) : (
        <section className="rp-algo">
          <div className="rp-algo-text">
            <span className="rp-algo-fig">ALGORITMO DE KITS</span>
            <p>
              <b>1. Manual</b> — lo que eliges aquí manda siempre. <b>2. Agente</b> — lo ajusta con ventas, inventario y tendencias del mercado.
              {' '}<b>3. Automático</b> — regla de la página, sin IA: misma variedad &gt; perfil de sabor &gt; proceso &gt; origen, repartiendo entre cafés.
            </p>
            <div className="rp-algo-counts">
              {Object.entries(counts).map(([k, n]) => <span key={k} className={`rp-badge is-${k}`}>{SOURCE[k].text} · {n}</span>)}
            </div>
          </div>
          <div className="rp-algo-actions">
            <button type="button" className="rp-agent-btn" onClick={runAgent} disabled={agent.busy || coffees.length === 0}>
              {agent.busy ? 'El agente está revisando…' : 'Ajustar kits con el agente'}
            </button>
            <span className="rp-algo-hint">Usa ventas de 90 días, inventario y búsqueda web. Tarda 1–2 min.</span>
          </div>
          {agent.error && <p className="rp-err rp-agent-out">{agent.error}</p>}
          {agent.result && (
            <div className="rp-agent-out">
              <p>{agent.result.summary || 'Sin cambios.'}</p>
              {agent.result.applied?.length > 0 && (
                <ul>{agent.result.applied.map((a) => <li key={a.year}><b>{a.year}</b> → {a.coffee} {a.size}{a.kit.length ? ` + ${a.kit.join(', ')}` : ''} — {a.reason}</li>)}</ul>
              )}
              {agent.result.reverted?.length > 0 && <p>Volvieron a automático: {agent.result.reverted.join(', ')}.</p>}
              {agent.result.skipped?.length > 0 && <p className="rp-algo-hint">Descartados: {agent.result.skipped.map((s) => `${s.year} (${s.why})`).join(', ')}.</p>}
            </div>
          )}
        </section>
      )}

      <div className="rp-list">
        {recipes.map((r) => {
          const d = draftOf(r.year);
          const source = rows[r.year]?.source ?? 'auto';
          const coffee = byId[d.coffee_id];
          const sizes = sizesOf(coffee);
          const dirty = isDirty(r.year);
          return (
            <article key={r.year} className={`rp-row is-${source}`}>
              <header className="rp-head">
                <span className="rp-year">{r.year}</span>
                <div className="rp-who">
                  <strong>{r.flag} {r.name}</strong>
                  <span>{r.dose} · {r.temp} · {r.position === 'Inverted' ? 'Invertido' : 'Normal'}</span>
                </div>
                <span className={`rp-badge is-${dirty ? 'manual' : source}`} title={SOURCE[source].hint}>
                  {dirty ? 'SIN GUARDAR' : SOURCE[source].text}
                </span>
              </header>
              <p className="rp-orig"><b>Café original:</b> {r.coffee.es}</p>

              <div className="rp-fields">
                <label className="rp-field">
                  <span>Café recomendado</span>
                  <select
                    value={d.coffee_id}
                    disabled={missingTable}
                    onChange={(e) => {
                      const s = sizesOf(byId[e.target.value]);
                      // La nota automática habla del café anterior: al cambiarlo, se limpia.
                      const autoNote = auto[r.year]?.note;
                      edit(r.year, {
                        coffee_id: e.target.value,
                        coffee_size: s.includes(d.coffee_size) ? d.coffee_size : s[0] ?? '250G',
                        ...(autoNote && d.note === autoNote ? { note: '' } : {}),
                      });
                    }}
                  >
                    {!d.coffee_id && <option value="">— Elige un café —</option>}
                    {coffees.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
                  </select>
                </label>
                <label className="rp-field rp-size">
                  <span>Tamaño</span>
                  <select value={d.coffee_size} disabled={!coffee || missingTable} onChange={(e) => edit(r.year, { coffee_size: e.target.value })}>
                    {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="rp-field rp-note">
                  <span>Por qué este café (se muestra al cliente)</span>
                  <input
                    value={d.note}
                    disabled={!coffee || missingTable}
                    maxLength={160}
                    onChange={(e) => edit(r.year, { note: e.target.value })}
                    placeholder="Ej. Frutal y de acidez brillante, como el Kenia que usó el campeón."
                  />
                </label>
              </div>

              {gear.length > 0 && (
                <div className="rp-extras">
                  <span>Extras del kit</span>
                  <div>
                    {gear.map((p) => {
                      const on = d.kit_ids.includes(p.id);
                      return (
                        <button key={p.id} type="button" className={on ? 'is-on' : ''} aria-pressed={on} disabled={!coffee || missingTable}
                          onClick={() => edit(r.year, { kit_ids: on ? d.kit_ids.filter((x) => x !== p.id) : [...d.kit_ids, p.id] })}>
                          {on ? '✓ ' : '+ '}{label(p)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <footer className="rp-foot">
                {msg[r.year] && <span className={msg[r.year].err ? 'rp-err' : 'rp-ok'}>{msg[r.year].text}</span>}
                {rows[r.year] && !missingTable && (
                  <button type="button" className="admin-btn-ghost" disabled={savingYear === r.year} onClick={() => backToAuto(r.year)}>
                    Volver a automático
                  </button>
                )}
                <button type="button" className="admin-btn-ghost" disabled={!dirty || savingYear === r.year || missingTable} onClick={() => save(r.year)}>
                  {savingYear === r.year ? 'Guardando…' : 'Guardar como manual'}
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      {gear.length === 0 && (
        <p className="admin-page-sub">Para que los kits incluyan filtros o AeroPress, créalos en Catálogo con la categoría “Equipo AeroPress”: la regla los agrega sola.</p>
      )}
    </div>
  );
}

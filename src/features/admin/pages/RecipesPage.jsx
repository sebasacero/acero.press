import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
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
const blank = { coffee_id: '', coffee_size: '250G', kit_ids: [], note: '' };

/**
 * Recetas que venden: para cada receta campeona eliges el café que la
 * acompaña en la tienda y los extras del kit (filtros, AeroPress…).
 */
export default function RecipesPage() {
  const [products, setProducts] = useState([]);
  const [rows, setRows] = useState({}); // año → { ...guardado }
  const [drafts, setDrafts] = useState({}); // año → { ...editado }
  const [missingTable, setMissingTable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingYear, setSavingYear] = useState(null);
  const [msg, setMsg] = useState({});

  const load = useCallback(async () => {
    const [prod, pair] = await Promise.all([
      supabase.from('products').select('id, name, brand, category, active, image_url, product_variants(label, price, active)').order('name'),
      supabase.from('recipe_pairings').select('recipe_year, coffee_id, coffee_size, kit_ids, note'),
    ]);
    setProducts(prod.data ?? []);
    if (pair.error) {
      setMissingTable(/recipe_pairings|does not exist|schema cache/i.test(pair.error.message));
    } else {
      const map = Object.fromEntries((pair.data ?? []).map((r) => [r.recipe_year, { ...blank, ...r, note: r.note ?? '', kit_ids: r.kit_ids ?? [] }]));
      setRows(map);
      setDrafts(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const coffees = products.filter((p) => p.category === 'coffee_bag');
  const gear = products.filter((p) => p.category !== 'coffee_bag');
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const draftOf = (year) => drafts[year] ?? blank;
  const edit = (year, patch) => setDrafts((d) => ({ ...d, [year]: { ...draftOf(year), ...patch } }));
  const isDirty = (year) => JSON.stringify(draftOf(year)) !== JSON.stringify(rows[year] ?? blank);

  const save = async (year) => {
    const d = draftOf(year);
    setSavingYear(year);
    setMsg((m) => ({ ...m, [year]: null }));
    const { error } = d.coffee_id
      ? await supabase.from('recipe_pairings').upsert({
          recipe_year: year,
          coffee_id: d.coffee_id,
          coffee_size: d.coffee_size,
          kit_ids: d.kit_ids,
          note: d.note.trim() || null,
          updated_at: new Date().toISOString(),
        })
      : await supabase.from('recipe_pairings').delete().eq('recipe_year', year);
    setSavingYear(null);
    if (error) return setMsg((m) => ({ ...m, [year]: { err: true, text: error.message } }));
    const saved = d.coffee_id ? { ...d, note: d.note.trim() } : undefined;
    setRows((r) => { const n = { ...r }; if (saved) n[year] = saved; else delete n[year]; return n; });
    setDrafts((dr) => { const n = { ...dr }; if (saved) n[year] = saved; else delete n[year]; return n; });
    setMsg((m) => ({ ...m, [year]: { err: false, text: d.coffee_id ? 'Guardado: ya se ve en la tienda.' : 'Sin kit.' } }));
  };

  if (loading) return <p className="admin-loading">Cargando recetas…</p>;

  const paired = Object.keys(rows).length;

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Recetas</h1>
      <p className="admin-page-sub">
        Elige el café que acompaña cada receta campeona y qué va en su kit. En la tienda aparece como “Prepárala con…” y el botón “Añadir kit”.
        {' '}<strong>{paired} de {recipes.length}</strong> recetas con kit.
      </p>

      {missingTable && (
        <p className="rp-warn">
          Falta crear la tabla <code>recipe_pairings</code> en Supabase. Aplica la migración
          {' '}<code>supabase/migrations/20261016150000_recipe_pairings.sql</code> y recarga esta pantalla.
        </p>
      )}

      <div className="rp-list">
        {recipes.map((r) => {
          const d = draftOf(r.year);
          const coffee = byId[d.coffee_id];
          const sizes = sizesOf(coffee);
          const dirty = isDirty(r.year);
          return (
            <article key={r.year} className={`rp-row ${rows[r.year] ? 'is-paired' : ''}`}>
              <header className="rp-head">
                <span className="rp-year">{r.year}</span>
                <div className="rp-who">
                  <strong>{r.flag} {r.name}</strong>
                  <span>{r.dose} · {r.temp} · {r.position === 'Inverted' ? 'Invertido' : 'Normal'}</span>
                </div>
              </header>
              <p className="rp-orig"><b>Café original:</b> {r.coffee.es}</p>

              <div className="rp-fields">
                <label className="rp-field">
                  <span>Café recomendado</span>
                  <select
                    value={d.coffee_id}
                    disabled={missingTable}
                    onChange={(e) => {
                      const next = byId[e.target.value];
                      const s = sizesOf(next);
                      edit(r.year, { coffee_id: e.target.value, coffee_size: s.includes(d.coffee_size) ? d.coffee_size : s[0] ?? '250G' });
                    }}
                  >
                    <option value="">— Sin kit —</option>
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
                <button type="button" className="admin-btn-ghost" disabled={!dirty || savingYear === r.year || missingTable} onClick={() => save(r.year)}>
                  {savingYear === r.year ? 'Guardando…' : 'Guardar'}
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      {gear.length === 0 && (
        <p className="admin-page-sub">Para agregar filtros o AeroPress al kit, créalos primero en Catálogo con la categoría “Equipo AeroPress”.</p>
      )}
    </div>
  );
}

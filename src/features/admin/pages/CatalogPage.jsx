import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import ProductEditor, { CATEGORIES, HOUSE_BRAND } from '../ProductEditor.jsx';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | producto
  const [cat, setCat] = useState('all');
  const [brand, setBrand] = useState('all');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, brand, description, category, image_url, active, product_variants(id, label, price, active)')
      .order('name');
    if (error) console.error(error.message);
    setProducts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const visible = products.filter((p) =>
    (cat === 'all' || p.category === cat) &&
    (brand === 'all' || (brand === HOUSE_BRAND ? !p.brand : p.brand === brand)) &&
    (!q.trim() || norm(`${p.name} ${p.brand ?? HOUSE_BRAND}`).includes(norm(q.trim())))
  );

  const updateVariantPrice = async (variantId, price) => {
    setSavingId(variantId);
    await supabase.from('product_variants').update({ price }).eq('id', variantId);
    setSavingId(null);
  };

  const toggleVariantActive = async (variantId, active) => {
    setSavingId(variantId);
    await supabase.from('product_variants').update({ active: !active }).eq('id', variantId);
    await load();
    setSavingId(null);
  };

  const toggleProductActive = async (productId, active) => {
    await supabase.from('products').update({ active: !active }).eq('id', productId);
    await load();
  };

  if (loading) return <p className="admin-loading">Cargando catálogo…</p>;

  return (
    <div className="admin-page">
      <div className="cat-head">
        <div>
          <h1 className="admin-page-title">Catálogo</h1>
          <p className="admin-page-sub">Productos propios y de marcas aliadas. Los precios se guardan al salir del campo.</p>
        </div>
        <button type="button" className="cat-new" onClick={() => setEditing('new')}>+ Nuevo producto</button>
      </div>

      <div className="cat-filters">
        <div className="cat-chips" role="group" aria-label="Categoría">
          {[{ id: 'all', label: 'Todo' }, ...CATEGORIES].map((c) => (
            <button key={c.id} type="button" className={cat === c.id ? 'is-on' : ''} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              {c.label}
              <span>{c.id === 'all' ? products.length : products.filter((p) => p.category === c.id).length}</span>
            </button>
          ))}
        </div>
        <select className="cat-select" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Marca">
          <option value="all">Todas las marcas</option>
          <option value={HOUSE_BRAND}>{HOUSE_BRAND} (propia)</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <input className="cat-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o marca…" aria-label="Buscar" />
      </div>

      {visible.length === 0 && (
        <p className="admin-page-sub">
          {products.length === 0 ? 'Aún no hay productos.' : 'Nada coincide con el filtro.'}{' '}
          <button type="button" className="admin-btn-ghost" onClick={() => setEditing('new')}>Crear uno</button>
        </p>
      )}

      <div className="admin-catalog-grid">
        {visible.map((p) => (
          <div key={p.id} className={`admin-card ${!p.active ? 'is-inactive' : ''}`}>
            <div className="cat-card-top">
              <div className="cat-thumb">{p.image_url ? <img src={p.image_url} alt="" /> : <span>—</span>}</div>
              <div className="cat-card-meta">
                <span className={`cat-brand ${p.brand ? 'is-ally' : ''}`}>{p.brand ?? HOUSE_BRAND}</span>
                <h3>{p.name}</h3>
                <span className="cat-tag">{CATEGORIES.find((c) => c.id === p.category)?.label ?? p.category}</span>
              </div>
            </div>
            <div className="admin-card-header">
              <button type="button" className="admin-btn-ghost" onClick={() => setEditing(p)}>Editar</button>
              <label className="admin-switch">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={() => toggleProductActive(p.id, p.active)}
                />
                <span>{p.active ? 'Activo' : 'Oculto'}</span>
              </label>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Presentación</th>
                  <th>Precio (COP)</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {[...p.product_variants]
                  .sort((a, b) => Number(a.price) - Number(b.price))
                  .map((v) => (
                    <tr key={v.id} className={!v.active ? 'is-inactive' : ''}>
                      <td>{v.label}</td>
                      <td>
                        <input
                          type="number"
                          className="admin-price-input"
                          defaultValue={v.price}
                          disabled={savingId === v.id}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val !== Number(v.price)) updateVariantPrice(v.id, val);
                          }}
                        />
                      </td>
                      <td>
                        <button
                          className="admin-btn-ghost"
                          onClick={() => toggleVariantActive(v.id, v.active)}
                        >
                          {v.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          brands={brands}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}

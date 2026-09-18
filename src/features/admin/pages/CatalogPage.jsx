import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, category, image_url, active, product_variants(id, label, price, active)')
      .order('name');
    if (error) console.error(error.message);
    setProducts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      <h1 className="admin-page-title">Catálogo</h1>
      <p className="admin-page-sub">Precios y disponibilidad de cada variedad. Los cambios se guardan al salir del campo.</p>

      <div className="admin-catalog-grid">
        {products.map((p) => (
          <div key={p.id} className={`admin-card ${!p.active ? 'is-inactive' : ''}`}>
            <div className="admin-card-header">
              <h3>{p.name}</h3>
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
                {p.product_variants
                  .sort((a, b) => a.label.localeCompare(b.label))
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
    </div>
  );
}

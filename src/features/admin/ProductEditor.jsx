import { useState, useCallback } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import EditDrawer from './EditDrawer.jsx';

export const CATEGORIES = [
  { id: 'coffee_bag', label: 'Café en bolsa', hint: 'Sale en "Selección de bolsas de café".' },
  { id: 'aeropress_equipment', label: 'Equipo AeroPress', hint: 'Sale en "Equipo AeroPress".' },
];
export const HOUSE_BRAND = 'Acero.press';
const COFFEE_SIZES = ['250G', '500G', '1KG'];

const slugify = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

let tmpId = 0;
const newRow = (label = '', price = '') => ({ key: `new-${++tmpId}`, id: null, label, price, active: true });

/**
 * Crear o editar un producto del catálogo (propio o de una marca aliada).
 * product = null → nuevo. brands: marcas ya usadas, para sugerirlas.
 */
export default function ProductEditor({ product, brands = [], varieties = [], regions = [], onClose, onSaved }) {
  const isNew = !product;
  const [form, setForm] = useState(() => ({
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    category: product?.category ?? 'coffee_bag',
    description: product?.description ?? '',
    variety: product?.variety ?? '',
    region: product?.region ?? '',
    image_url: product?.image_url ?? '',
  }));
  const [variants, setVariants] = useState(() =>
    product
      ? [...product.product_variants]
          .sort((a, b) => Number(a.price) - Number(b.price))
          .map((v) => ({ key: v.id, id: v.id, label: v.label, price: String(v.price), active: v.active }))
      : COFFEE_SIZES.map((s) => newRow(s))
  );
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState({ saving: false, error: null });
  const [dirty, setDirty] = useState(false);

  const set = (k, v) => { setDirty(true); setForm((f) => ({ ...f, [k]: v })); };
  const setVariant = (key, patch) => { setDirty(true); setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v))); };

  // En un producto nuevo sin precios aún, las presentaciones sugeridas siguen a la categoría.
  const chooseCategory = (id) => {
    set('category', id);
    if (isNew && variants.every((v) => !v.id && v.price === '')) {
      setVariants(id === 'coffee_bag' ? COFFEE_SIZES.map((s) => newRow(s)) : [newRow('UNIDAD')]);
    }
  };

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Cerrar de todos modos?')) return;
    onClose();
  }, [dirty, onClose]);

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    setStatus({ saving: false, error: null });
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `products/${slugify(form.brand || HOUSE_BRAND)}-${slugify(form.name || 'producto')}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('marketing').upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) return setStatus({ saving: false, error: `No se subió la imagen: ${error.message}` });
    set('image_url', supabase.storage.from('marketing').getPublicUrl(path).data.publicUrl);
  };

  const live = variants.filter((v) => v.label.trim() || v.price !== '');
  const problems = [
    !form.name.trim() && 'Falta el nombre.',
    live.length === 0 && 'Agrega al menos una presentación con precio.',
    live.some((v) => !v.label.trim()) && 'Cada presentación necesita un nombre (ej. 250G).',
    live.some((v) => !(Number(v.price) > 0)) && 'Cada presentación necesita un precio mayor a 0.',
    new Set(live.map((v) => v.label.trim().toUpperCase())).size !== live.length && 'Hay presentaciones repetidas.',
  ].filter(Boolean);

  const save = async () => {
    if (problems.length) return setStatus({ saving: false, error: problems[0] });
    setStatus({ saving: true, error: null });
    const fields = {
      name: form.name.trim(),
      brand: form.brand.trim() && form.brand.trim().toLowerCase() !== HOUSE_BRAND.toLowerCase() ? form.brand.trim() : null,
      category: form.category,
      description: form.description.trim() || null,
      variety: form.category === 'coffee_bag' ? form.variety.trim() || null : null,
      region: form.category === 'coffee_bag' ? form.region.trim() || null : null,
      image_url: form.image_url.trim() || null,
    };

    let productId = product?.id;
    if (isNew) {
      // El slug sale de marca + nombre; si ya existe, se le agrega un número.
      const base = slugify([fields.brand, fields.name].filter(Boolean).join(' ')) || `producto-${Date.now()}`;
      for (let n = 1; n <= 20 && !productId; n++) {
        const { data, error } = await supabase
          .from('products')
          .insert({ ...fields, slug: n === 1 ? base : `${base}-${n}`, active: true })
          .select('id')
          .single();
        if (data) productId = data.id;
        else if (error?.code !== '23505') return setStatus({ saving: false, error: `No se creó: ${error?.message}` });
      }
      if (!productId) return setStatus({ saving: false, error: 'No se pudo generar un identificador único.' });
    } else {
      const { error } = await supabase.from('products').update(fields).eq('id', productId);
      if (error) return setStatus({ saving: false, error: `No se guardó: ${error.message}` });
    }

    // Presentaciones: se actualizan las existentes y se crean las nuevas (con su fila de inventario en 0).
    for (const v of live) {
      const row = { label: v.label.trim().toUpperCase(), price: Number(v.price), active: v.active };
      if (v.id) {
        const { error } = await supabase.from('product_variants').update(row).eq('id', v.id);
        if (error) return setStatus({ saving: false, error: `Presentación ${row.label}: ${error.message}` });
      } else {
        const { data, error } = await supabase
          .from('product_variants')
          .insert({ ...row, product_id: productId })
          .select('id')
          .single();
        if (error) return setStatus({ saving: false, error: `Presentación ${row.label}: ${error.message}` });
        await supabase.from('inventory').insert({ variant_id: data.id, stock_qty: 0 });
      }
    }
    setStatus({ saving: false, error: null });
    onSaved();
  };

  const category = CATEGORIES.find((c) => c.id === form.category);

  return (
    <EditDrawer
      fig={isNew ? 'FIG. — NUEVO PRODUCTO' : 'FIG. — PRODUCTO'}
      title={isNew ? 'Nuevo producto' : form.name || 'Producto'}
      onClose={requestClose}
      wide
      footer={
        <>
          <span className="bp-drawer-status">
            {status.error ? <span className="bp-error">{status.error}</span> : problems[0] ?? (dirty ? 'Cambios sin guardar' : 'Sin cambios')}
          </span>
          <button type="button" className="bp-btn bp-btn-ghost" onClick={requestClose}>Cancelar</button>
          <button type="button" className="bp-btn bp-btn-primary" disabled={status.saving || uploading || problems.length > 0} onClick={save}>
            {status.saving ? 'Guardando…' : isNew ? 'Crear producto' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="pe-top">
        <div className="pe-image">
          {form.image_url ? <img src={form.image_url} alt="" /> : <span>SIN FOTO</span>}
        </div>
        <div className="pe-top-fields">
          <label className="bp-field">
            <span className="bp-field-label">Nombre <em>*</em></span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Geisha, AeroPress Go" />
          </label>
          <label className="bp-field">
            <span className="bp-field-label">Marca</span>
            <input value={form.brand} onChange={(e) => set('brand', e.target.value)} list="pe-brands" placeholder={`${HOUSE_BRAND} (propia)`} />
            <datalist id="pe-brands">
              {brands.map((b) => <option key={b} value={b} />)}
            </datalist>
            <span className="bp-field-hint">Vacío = producto propio. Para una alianza escribe la marca; se muestra en la tienda.</span>
          </label>
        </div>
      </div>

      <div className="bp-field">
        <span className="bp-field-label">Foto</span>
        <div className="pe-image-row">
          <label className="bp-btn bp-btn-ghost pe-upload">
            {uploading ? 'Subiendo…' : 'Subir foto'}
            <input type="file" accept="image/*" hidden onChange={(e) => uploadImage(e.target.files?.[0])} />
          </label>
          <input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="…o pega la URL de la imagen" />
        </div>
        <span className="bp-field-hint">Cuadrada (1:1) se ve mejor en la tienda.</span>
      </div>

      <div className="bp-field">
        <span className="bp-field-label">Categoría</span>
        <div className="pe-seg" role="radiogroup">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={form.category === c.id}
              className={form.category === c.id ? 'is-on' : ''} onClick={() => chooseCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        {category && <span className="bp-field-hint">{category.hint}</span>}
      </div>

      {form.category === 'coffee_bag' && (
        <div className="pe-two">
          <label className="bp-field">
            <span className="bp-field-label">Variedad</span>
            <input value={form.variety} onChange={(e) => set('variety', e.target.value)} list="pe-varieties" placeholder="Ej. Geisha, Caturra" />
            <datalist id="pe-varieties">{varieties.map((v) => <option key={v} value={v} />)}</datalist>
          </label>
          <label className="bp-field">
            <span className="bp-field-label">Región</span>
            <input value={form.region} onChange={(e) => set('region', e.target.value)} list="pe-regions" placeholder="Ej. Huila, Nariño" />
            <datalist id="pe-regions">{regions.map((r) => <option key={r} value={r} />)}</datalist>
          </label>
          <span className="bp-field-hint pe-two-hint">Con esto el cliente filtra por variedad y región en la tienda. Escríbelas igual en cada producto para que se agrupen.</span>
        </div>
      )}

      <label className="bp-field">
        <span className="bp-field-label">Descripción</span>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
          placeholder="Origen, proceso, notas de cata o detalles del equipo (opcional)." />
      </label>

      <div className="bp-section-label">Presentaciones y precios (COP)</div>
      <div className="pe-variants">
        {variants.map((v) => (
          <div key={v.key} className={`pe-variant ${!v.active ? 'is-off' : ''}`}>
            <input aria-label="Presentación" value={v.label} onChange={(e) => setVariant(v.key, { label: e.target.value })} placeholder="250G, UNIDAD…" />
            <input aria-label="Precio" type="number" min="0" step="500" value={v.price} onChange={(e) => setVariant(v.key, { price: e.target.value })} placeholder="Precio" />
            {v.id ? (
              <button type="button" className="pe-mini" onClick={() => setVariant(v.key, { active: !v.active })}>
                {v.active ? 'Ocultar' : 'Mostrar'}
              </button>
            ) : (
              <button type="button" className="pe-mini" aria-label="Quitar"
                onClick={() => { setDirty(true); setVariants((vs) => vs.filter((x) => x.key !== v.key)); }}>
                Quitar
              </button>
            )}
          </div>
        ))}
        <div className="pe-variant-add">
          <button type="button" className="bp-btn bp-btn-ghost" onClick={() => { setDirty(true); setVariants((vs) => [...vs, newRow()]); }}>
            + Presentación
          </button>
          <span className="bp-field-hint">Las presentaciones ya vendidas no se borran: se ocultan, para no perder el historial de pedidos.</span>
        </div>
      </div>
    </EditDrawer>
  );
}

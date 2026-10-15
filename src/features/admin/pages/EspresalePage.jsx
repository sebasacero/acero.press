import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { fetchBogotaWeather } from '../../../shared/lib/weather.js';
import { drawEspresaleCard, parseRecipe, FORMATS } from '../espresaleCard.js';
import { publishToInstagram as igPublish, recordEspresaleSale } from '../../../shared/lib/instagram.js';

const PAY_METHODS = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
  { id: 'card', label: 'Tarjeta' },
];
const money = (n) => '$' + Math.round(n).toLocaleString('es-CO');
// Formato de la tarjeta → tipo de publicación en Instagram
const IG_KIND = { feed: 'image', story: 'story' };

const slug = (s) => String(s || 'tarjeta').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

/** Número de WhatsApp: si escriben un celular colombiano de 10 dígitos, le agrega el 57. */
function waDigits(phone) {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 && d.startsWith('3') ? `57${d}` : d;
}

function StepHead({ n, title, done, hint }) {
  return (
    <div className="esp-step-head">
      <span className={`esp-step-num ${done ? 'is-done' : ''}`}>{done ? '✓' : n}</span>
      <div>
        <h3 className="esp-step-title">{title}</h3>
        {hint && <p className="esp-step-hint">{hint}</p>}
      </div>
    </div>
  );
}

export default function EspresalePage() {
  const [varieties, setVarieties] = useState(null);
  const [selected, setSelected] = useState(null);
  const [phone, setPhone] = useState('');
  const [format, setFormat] = useState('feed');
  const [showZones, setShowZones] = useState(true);
  const [weather, setWeather] = useState({ tempC: null, condition: '', icon: '' });
  const [now, setNow] = useState(() => new Date());
  const canvasRef = useRef(null);

  // Tarjeta: guardado en Publicaciones
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState(null);
  const [notice, setNotice] = useState(null);

  // Cámara: foto (fondo de la tarjeta) o video (para Reels)
  const [captured, setCaptured] = useState(null); // { file, type, url }
  const [photoImg, setPhotoImg] = useState(null);
  const [usePhoto, setUsePhoto] = useState(true);
  const [capturedSaving, setCapturedSaving] = useState(false);
  const [capturedSavedUrl, setCapturedSavedUrl] = useState(null);
  const [igPublishing, setIgPublishing] = useState(false);
  const [igResult, setIgResult] = useState(null);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Venta (paso 05) y publicación de la tarjeta en Instagram
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [payMethod, setPayMethod] = useState('cash');
  const [sale, setSale] = useState(null); // { orderId, total }
  const [saleBusy, setSaleBusy] = useState(null); // 'sale' | 'publish'
  const [cardPost, setCardPost] = useState(null); // { ok, text }

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, recipe_text, product_variants(id, label, price, active)')
      .eq('category', 'coffee_bag')
      .eq('active', true)
      .then(({ data, error }) => {
        if (error) console.error('Error cargando variedades:', error.message);
        setVarieties(data ?? []);
      });
    fetchBogotaWeather().then(setWeather);
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Foto capturada → imagen para el fondo de la tarjeta
  useEffect(() => {
    if (captured?.type !== 'image') { setPhotoImg(null); return undefined; }
    const img = new Image();
    img.onload = () => setPhotoImg(img);
    img.src = captured.url;
    return () => { img.onload = null; };
  }, [captured]);

  useEffect(() => () => { if (captured?.url) URL.revokeObjectURL(captured.url); }, [captured]);

  const minuteKey = `${now.getHours()}:${now.getMinutes()}`;
  useEffect(() => {
    if (!selected || !canvasRef.current) return;
    drawEspresaleCard(canvasRef.current, {
      variety: selected,
      weather,
      date: new Date(),
      format,
      photo: usePhoto ? photoImg : null,
    });
    setSavedUrl(null);
  }, [selected, weather, format, photoImg, usePhoto, minuteKey]);

  const recipe = useMemo(() => parseRecipe(selected?.recipe_text || ''), [selected]);
  const variants = useMemo(
    () => (selected?.product_variants ?? []).filter((v) => v.active).sort((a, b) => Number(a.price) - Number(b.price)),
    [selected]
  );
  const variant = variants.find((v) => v.id === variantId) ?? null;

  // Al cambiar de variedad: primera presentación y venta nueva
  useEffect(() => {
    setVariantId(variants[0]?.id ?? null);
    setQty(1);
    setSale(null);
    setCardPost(null);
  }, [variants]);
  const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const tempStr = weather.tempC !== null ? `${weather.tempC}°C` : '—';
  const fileName = `espresale-${slug(selected?.name)}.png`;

  const buildCaption = () =>
    `☕ ${selected?.name ?? ''} — AceroPress\n\n${selected?.recipe_text ?? ''}\n\n${weather.icon} ${tempStr} en Bogotá · ${timeStr}`;

  const toBlob = () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png'));

  const download = async () => {
    const blob = await toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare
    && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });

  // En el celular, el menú de compartir sí adjunta la imagen (a WhatsApp,
  // Instagram, etc.) — wa.me solo puede llevar texto.
  const share = async () => {
    const blob = await toBlob();
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], text: buildCaption() });
    } catch (err) {
      if (err?.name !== 'AbortError') setNotice({ ok: false, text: 'No se pudo abrir el menú de compartir.' });
    }
  };

  const openWhatsApp = () => {
    const digits = waDigits(phone);
    if (!digits) {
      setNotice({ ok: false, text: 'Escribe el WhatsApp del cliente (paso 04).' });
      return;
    }
    const msg = `${buildCaption()}\n\nTe compartimos la tarjeta de tu preparación 👇`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank');
    setNotice({ ok: true, text: 'Se abrió el chat — adjunta la imagen que descargaste.' });
  };

  // Sube el archivo a Storage y crea su fila en Publicaciones. Devuelve { url, id }.
  const uploadPublication = async (blobOrFile, ext, contentType, extra = {}) => {
    const path = `espresale/${Date.now()}-${slug(selected?.name || 'captura')}.${ext}`;
    const { error } = await supabase.storage.from('marketing').upload(path, blobOrFile, { contentType });
    if (error) throw error;
    const { data: pub } = supabase.storage.from('marketing').getPublicUrl(path);
    const caption = buildCaption();
    const { data: row, error: insertError } = await supabase
      .from('publications')
      .insert({ video_url: pub.publicUrl, caption, caption_es: caption, created_at: new Date().toISOString(), ...extra })
      .select('id')
      .single();
    if (insertError) throw insertError;
    return { url: pub.publicUrl, id: row.id };
  };

  const saveToPublications = async () => {
    setSaving(true);
    setNotice(null);
    try {
      setSavedUrl((await uploadPublication(await toBlob(), 'png', 'image/png', { media_kind: IG_KIND[format] })).url);
      setNotice({ ok: true, text: 'Guardada — ya aparece en Publicaciones.' });
    } catch (err) {
      console.error(err);
      setNotice({ ok: false, text: `No se pudo guardar: ${err.message || 'error desconocido'}` });
    }
    setSaving(false);
  };

  const handleCapture = (e, type) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCaptured({ file, type, url: URL.createObjectURL(file) });
    setUsePhoto(true);
    setCapturedSavedUrl(null);
    setIgResult(null);
  };

  const saveCaptured = async () => {
    setCapturedSaving(true);
    try {
      const ext = captured.type === 'video' ? 'mp4' : 'jpg';
      const saved = await uploadPublication(captured.file, ext, captured.file.type, {
        media_kind: captured.type === 'video' ? 'reel' : 'image',
        ...(sale ? { order_id: sale.orderId } : {}),
      });
      setCapturedSavedUrl(saved);
    } catch (err) {
      console.error(err);
      setIgResult({ ok: false, message: `No se pudo guardar: ${err.message || 'error desconocido'}` });
    }
    setCapturedSaving(false);
  };

  // Video capturado → Reel
  const publishToInstagram = async () => {
    if (!capturedSavedUrl) return;
    setIgPublishing(true);
    setIgResult(null);
    try {
      const ig = await igPublish({ mediaUrl: capturedSavedUrl.url, kind: 'reel', caption: buildCaption(), publicationId: capturedSavedUrl.id });
      setIgResult(ig.success ? { ok: true, message: 'Reel publicado en Instagram.' } : { ok: false, message: ig.error || 'Instagram no confirmó la publicación.' });
    } catch (err) {
      setIgResult({ ok: false, message: err.message });
    }
    setIgPublishing(false);
  };

  // Tarjeta → post del feed (4:5) o historia (9:16). Instagram solo acepta JPEG.
  const publishCard = async (orderId = sale?.orderId) => {
    setSaleBusy('publish');
    setCardPost(null);
    try {
      const jpeg = await new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/jpeg', 0.92));
      const saved = await uploadPublication(jpeg, 'jpg', 'image/jpeg', {
        media_kind: IG_KIND[format],
        ...(orderId ? { order_id: orderId } : {}),
      });
      const ig = await igPublish({ mediaUrl: saved.url, kind: IG_KIND[format], caption: buildCaption(), publicationId: saved.id });
      setCardPost(ig.success
        ? { ok: true, text: format === 'story' ? 'Historia publicada en Instagram.' : 'Post publicado en el feed de Instagram.' }
        : { ok: false, text: ig.error || 'Instagram no confirmó la publicación.' });
    } catch (err) {
      setCardPost({ ok: false, text: `No se publicó: ${err.message}` });
    }
    setSaleBusy(null);
  };

  const registerSale = async (alsoPublish) => {
    if (!variant) return;
    setSaleBusy('sale');
    setCardPost(null);
    try {
      const r = await recordEspresaleSale({
        variant,
        productName: selected.name,
        qty,
        paymentMethod: payMethod,
        phone: waDigits(phone),
      });
      setSale(r);
      setSaleBusy(null);
      if (alsoPublish) await publishCard(r.orderId);
    } catch (err) {
      setCardPost({ ok: false, text: `No se registró la venta: ${err.message}` });
      setSaleBusy(null);
    }
  };

  const { w, h, safe } = FORMATS[format];
  const pct = (v, total) => `${(v / total) * 100}%`;
  // Lo que queda fuera de la zona segura (lo tapa la app), en % del lienzo
  const shades = [
    { left: 0, top: 0, width: '100%', height: pct(safe.y0, h) },
    { left: 0, top: pct(safe.y1, h), width: '100%', height: pct(h - safe.y1, h) },
    { left: 0, top: pct(safe.y0, h), width: pct(safe.x0, w), height: pct(safe.y1 - safe.y0, h) },
    { left: pct(safe.x1, w), top: pct(safe.y0, h), width: pct(w - safe.x1, w), height: pct(safe.y1 - safe.y0, h) },
  ];

  return (
    <div className="admin-page esp">
      <header className="esp-head">
        <div className="esp-cota">
          <span>FIG. 06 — ESPRESALE / VENTA RÁPIDA</span>
          <span className="esp-badge">{weather.icon} {tempStr} · {timeStr}</span>
        </div>
        <h1 className="esp-title">Espresale.</h1>
        <p className="esp-sub">
          Elige la variedad y la tarjeta se dibuja sola como un plano de la receta — con clima y hora
          de Bogotá. Mándasela al cliente o guárdala para redes.
        </p>
      </header>

      <div className="esp-layout">
        <div className="esp-steps">
          <section className="esp-step">
            <StepHead n="01" title="Variedad" done={!!selected} />
            {varieties === null ? (
              <p className="esp-muted">Cargando variedades…</p>
            ) : varieties.length === 0 ? (
              <p className="esp-muted">No hay cafés activos en el catálogo (categoría coffee_bag).</p>
            ) : (
              <div className="esp-chips">
                {varieties.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`esp-chip ${selected?.id === v.id ? 'active' : ''}`}
                    onClick={() => setSelected(v)}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <dl className="esp-specs">
                <div><dt>Dosis</dt><dd>{recipe.dose ? `${recipe.dose}g` : '—'}</dd></div>
                <div><dt>Agua</dt><dd>{recipe.water ? `${recipe.water}ml` : '—'}</dd></div>
                <div><dt>Temp</dt><dd>{recipe.temp ? `${recipe.temp}°C` : '—'}</dd></div>
                <div><dt>Tiempo</dt><dd>{recipe.time || '—'}</dd></div>
              </dl>
            )}
            {selected && !selected.recipe_text && (
              <p className="esp-muted">Esta variedad no tiene receta — agrégala en Catálogo.</p>
            )}
          </section>

          <section className="esp-step">
            <StepHead
              n="02"
              title="Fondo"
              done={!!captured}
              hint="Plano de papel, o una foto real de la preparación detrás de la hoja."
            />
            <div className="esp-chips">
              <button type="button" className={`esp-chip ${!(usePhoto && photoImg) ? 'active' : ''}`} onClick={() => setUsePhoto(false)}>
                Plano
              </button>
              {photoImg && (
                <button type="button" className={`esp-chip ${usePhoto ? 'active' : ''}`} onClick={() => setUsePhoto(true)}>
                  Foto
                </button>
              )}
              <button type="button" className="esp-chip esp-chip-ghost" onClick={() => photoInputRef.current?.click()}>
                📷 Tomar foto
              </button>
              <button type="button" className="esp-chip esp-chip-ghost" onClick={() => videoInputRef.current?.click()}>
                🎥 Grabar video
              </button>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleCapture(e, 'image')} />
            <input ref={videoInputRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => handleCapture(e, 'video')} />

            {captured?.type === 'video' && (
              <div className="esp-capture">
                <video src={captured.url} controls playsInline />
                <p className="esp-muted">El video no va en la tarjeta: guárdalo y publícalo como Reel.</p>
                <div className="esp-actions-row">
                  <button type="button" className="esp-btn esp-btn-ghost" disabled={capturedSaving || !!capturedSavedUrl} onClick={saveCaptured}>
                    {capturedSavedUrl ? '✓ Guardado' : capturedSaving ? 'Guardando…' : 'Guardar en Publicaciones'}
                  </button>
                  <button type="button" className="esp-btn esp-btn-primary" disabled={igPublishing || !capturedSavedUrl} onClick={publishToInstagram}>
                    {igPublishing ? 'Publicando…' : 'Publicar en Instagram'}
                  </button>
                </div>
                {igResult && <p className={`esp-notice ${igResult.ok ? 'ok' : 'err'}`}>{igResult.message}</p>}
              </div>
            )}
          </section>

          <section className="esp-step">
            <StepHead n="03" title="Formato" done />
            <div className="esp-chips">
              {Object.entries(FORMATS).map(([id, f]) => (
                <button key={id} type="button" className={`esp-chip esp-chip-format ${format === id ? 'active' : ''}`} onClick={() => setFormat(id)}>
                  <span className={`esp-ratio esp-ratio-${id}`} aria-hidden="true" />
                  <span className="esp-chip-text">
                    {f.label}
                    <small>{f.apps}</small>
                  </span>
                </button>
              ))}
            </div>
            <label className="esp-toggle">
              <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} />
              Ver zonas de la app en la vista previa
            </label>
          </section>

          <section className="esp-step">
            <StepHead n="04" title="WhatsApp del cliente" done={waDigits(phone).length >= 11} hint="Opcional. Con 10 dígitos se agrega el +57." />
            <input
              type="tel"
              inputMode="tel"
              className="esp-input"
              placeholder="300 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </section>

          <section className="esp-step">
            <StepHead
              n="05"
              title="Venta"
              done={!!sale}
              hint="Suma al contador de ventas, al dashboard y descuenta inventario."
            />
            {!selected ? (
              <p className="esp-muted">Elige primero la variedad.</p>
            ) : variants.length === 0 ? (
              <p className="esp-muted">Esta variedad no tiene presentaciones con precio activas (Catálogo).</p>
            ) : (
              <>
                <div className="esp-chips">
                  {variants.map((v) => (
                    <button key={v.id} type="button" className={`esp-chip ${variantId === v.id ? 'active' : ''}`} onClick={() => setVariantId(v.id)}>
                      {v.label} · {money(v.price)}
                    </button>
                  ))}
                </div>
                <div className="esp-sale-row">
                  <div className="esp-qty" role="group" aria-label="Cantidad">
                    <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">−</button>
                    <span>{qty}</span>
                    <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Más">+</button>
                  </div>
                  <strong className="esp-sale-total">{variant ? money(Number(variant.price) * qty) : '—'}</strong>
                </div>
                <div className="esp-chips">
                  {PAY_METHODS.map((m) => (
                    <button key={m.id} type="button" className={`esp-chip esp-chip-ghost ${payMethod === m.id ? 'active' : ''}`} onClick={() => setPayMethod(m.id)}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {sale ? (
                  <p className="esp-notice ok">✓ Venta registrada: {money(sale.total)}.</p>
                ) : (
                  <div className="esp-actions-row">
                    <button type="button" className="esp-btn esp-btn-ghost" disabled={!!saleBusy || !variant} onClick={() => registerSale(false)}>
                      {saleBusy === 'sale' ? 'Registrando…' : 'Registrar venta'}
                    </button>
                    <button type="button" className="esp-btn esp-btn-primary" disabled={!!saleBusy || !variant} onClick={() => registerSale(true)}>
                      Registrar y publicar
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <div className="esp-preview">
          <div className="esp-cota esp-cota-dark">
            <span>VISTA PREVIA · {w}×{h}</span>
            <span className="esp-badge">{FORMATS[format].apps}</span>
          </div>

          <div className={`esp-canvas-wrap esp-canvas-${format}`}>
            <div className="esp-canvas-frame" hidden={!selected}>
              <canvas ref={canvasRef} className="esp-canvas" />
              {showZones && (
                <div className="esp-zones" aria-hidden="true">
                  {shades.map((st, i) => <span key={i} className="esp-zone-shade" style={st} />)}
                  <span
                    className="esp-zone-safe"
                    style={{ left: pct(safe.x0, w), top: pct(safe.y0, h), width: pct(safe.x1 - safe.x0, w), height: pct(safe.y1 - safe.y0, h) }}
                  >
                    <em>ZONA SEGURA</em>
                  </span>
                </div>
              )}
            </div>
            {!selected && (
              <div className="esp-empty">
                <span className="esp-empty-fig">FIG. 01</span>
                <p>Elige una variedad para dibujar la tarjeta.</p>
              </div>
            )}
          </div>

          <div className="esp-actions">
            {canShareFiles && (
              <button type="button" className="esp-btn esp-btn-primary" disabled={!selected} onClick={share}>
                Compartir imagen
              </button>
            )}
            <button type="button" className={`esp-btn ${canShareFiles ? 'esp-btn-ghost' : 'esp-btn-primary'}`} disabled={!selected} onClick={download}>
              Descargar PNG
            </button>
            <button type="button" className="esp-btn esp-btn-ghost" disabled={!selected} onClick={openWhatsApp}>
              Abrir WhatsApp
            </button>
            <button type="button" className="esp-btn esp-btn-ghost" disabled={!selected || !!saleBusy} onClick={() => publishCard()}>
              {saleBusy === 'publish' ? 'Publicando…' : `Publicar ${format === 'story' ? 'historia' : 'en el feed'}`}
            </button>
            <button type="button" className="esp-btn esp-btn-ghost" disabled={!selected || saving || !!savedUrl} onClick={saveToPublications}>
              {savedUrl ? '✓ En Publicaciones' : saving ? 'Guardando…' : 'Guardar en Publicaciones'}
            </button>
          </div>
          {cardPost && <p className={`esp-notice ${cardPost.ok ? 'ok' : 'err'}`}>{cardPost.text}</p>}
          {notice && <p className={`esp-notice ${notice.ok ? 'ok' : 'err'}`}>{notice.text}</p>}
          <p className="esp-fineprint">
            {canShareFiles
              ? '“Compartir imagen” abre el menú del celular y adjunta la tarjeta a WhatsApp o Instagram.'
              : 'WhatsApp Web no adjunta imágenes solo: descarga el PNG y arrástralo al chat que se abre.'}
          </p>
        </div>
      </div>
    </div>
  );
}

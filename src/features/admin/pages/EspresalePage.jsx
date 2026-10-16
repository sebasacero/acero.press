import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { fetchBogotaWeather } from '../../../shared/lib/weather.js';
import { drawEspresaleCard, parseRecipe, FORMATS, composeVideoFrame, recordCardVideo, pickVideoType } from '../espresaleCard.js';
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

  // Fondo: foto o video (de la cámara o de la galería del celular)
  const [captured, setCaptured] = useState(null); // { file, type: 'image'|'video', url }
  const [photoImg, setPhotoImg] = useState(null);
  const [videoEl, setVideoEl] = useState(null);
  const [usePhoto, setUsePhoto] = useState(true);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const overlayRef = useRef(null); // capa de la tarjeta que va encima del video

  // Video final de la tarjeta (grabado en el navegador)
  const [cardVideo, setCardVideo] = useState(null); // { blob, url, ext, type }
  const [recording, setRecording] = useState(null); // progreso 0..1 mientras graba

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

  // Video elegido → elemento <video> (fuera de pantalla) para dibujarlo en la tarjeta
  useEffect(() => {
    if (captured?.type !== 'video') { setVideoEl(null); return undefined; }
    const v = document.createElement('video');
    v.src = captured.url;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    const ready = () => setVideoEl(v);
    v.addEventListener('loadeddata', ready, { once: true });
    v.load();
    return () => { v.pause(); v.removeAttribute('src'); v.load(); };
  }, [captured]);

  useEffect(() => () => { if (cardVideo?.url) URL.revokeObjectURL(cardVideo.url); }, [cardVideo]);

  const videoMode = !!(usePhoto && videoEl);
  const minuteKey = `${now.getHours()}:${now.getMinutes()}`;
  useEffect(() => {
    if (!selected || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    if (!videoMode) {
      drawEspresaleCard(canvas, {
        variety: selected,
        weather,
        date: new Date(),
        format,
        photo: usePhoto ? photoImg : null,
      });
      setSavedUrl(null);
      return undefined;
    }
    // Video de fondo: la tarjeta es una capa transparente encima, y la vista
    // previa se compone cuadro a cuadro mientras el video corre en bucle.
    if (!overlayRef.current) overlayRef.current = document.createElement('canvas');
    const overlay = overlayRef.current;
    let raf = 0;
    let alive = true;
    drawEspresaleCard(overlay, { variety: selected, weather, date: new Date(), format, videoOverlay: true }).then(() => {
      if (!alive) return;
      canvas.width = overlay.width;
      canvas.height = overlay.height;
      const ctx = canvas.getContext('2d');
      const loop = () => {
        composeVideoFrame(ctx, videoEl, overlay);
        raf = requestAnimationFrame(loop);
      };
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.play().catch(() => {});
      loop();
    });
    setSavedUrl(null);
    return () => { alive = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, weather, format, photoImg, usePhoto, videoMode, videoEl, minuteKey]);

  // El video grabado deja de valer si cambia lo que se ve en la tarjeta
  useEffect(() => { setCardVideo(null); }, [selected, format, videoEl, usePhoto]);

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

  // Graba (si hace falta) el video de la tarjeta con el video de fondo.
  const ensureCardVideo = async () => {
    if (cardVideo) return cardVideo;
    setRecording(0);
    setNotice(null);
    // Copias propias del video y de la capa: la vista previa sigue corriendo
    // (y redibujándose cada minuto) sin afectar lo que se graba.
    const recVideo = document.createElement('video');
    recVideo.src = captured.url;
    recVideo.playsInline = true;
    recVideo.setAttribute('playsinline', '');
    recVideo.preload = 'auto';
    const overlaySnap = document.createElement('canvas');
    overlaySnap.width = overlayRef.current.width;
    overlaySnap.height = overlayRef.current.height;
    overlaySnap.getContext('2d').drawImage(overlayRef.current, 0, 0);
    try {
      await new Promise((resolve, reject) => {
        recVideo.addEventListener('loadeddata', resolve, { once: true });
        recVideo.addEventListener('error', () => reject(new Error('No se pudo leer el video.')), { once: true });
        recVideo.load();
      });
      const r = await recordCardVideo({
        video: recVideo,
        overlay: overlaySnap,
        width: FORMATS[format].w,
        height: FORMATS[format].h,
        maxSeconds: 60,
        onProgress: (p) => setRecording(p),
      });
      const result = { ...r, url: URL.createObjectURL(r.blob) };
      setCardVideo(result);
      return result;
    } finally {
      setRecording(null);
      recVideo.pause();
      recVideo.removeAttribute('src');
      recVideo.load();
    }
  };

  // Lo que se descarga/comparte/publica: video si el fondo es video, imagen si no.
  const cardMedia = async ({ jpeg = false } = {}) => {
    if (videoMode) {
      const v = await ensureCardVideo();
      return { blob: v.blob, ext: v.ext, type: v.type, isVideo: true, igReady: v.igReady };
    }
    const type = jpeg ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, type, 0.92));
    return { blob, ext: jpeg ? 'jpg' : 'png', type, isVideo: false };
  };

  const download = async () => {
    try {
      const m = await cardMedia();
      const url = URL.createObjectURL(m.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.png$/, `.${m.ext}`);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    }
  };

  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare
    && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });

  // En el celular, el menú de compartir sí adjunta la imagen (a WhatsApp,
  // Instagram, etc.) — wa.me solo puede llevar texto.
  const share = async () => {
    try {
      const m = await cardMedia();
      const file = new File([m.blob], fileName.replace(/\.png$/, `.${m.ext}`), { type: m.type });
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
      const m = await cardMedia({ jpeg: true });
      const kind = m.isVideo ? (format === 'story' ? 'story' : 'reel') : IG_KIND[format];
      setSavedUrl((await uploadPublication(m.blob, m.ext, m.type, { media_kind: kind })).url);
      setNotice({ ok: true, text: 'Guardada — ya aparece en Publicaciones.' });
    } catch (err) {
      console.error(err);
      setNotice({ ok: false, text: `No se pudo guardar: ${err.message || 'error desconocido'}` });
    }
    setSaving(false);
  };

  // Cámara o galería: el tipo se deduce del archivo elegido.
  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    setCaptured({ file, type, url: URL.createObjectURL(file) });
    setUsePhoto(true);
  };

  // Tarjeta → post del feed (4:5) o historia (9:16). Instagram solo acepta JPEG.
  const publishCard = async (orderId = sale?.orderId) => {
    setSaleBusy('publish');
    setCardPost(null);
    try {
      const m = await cardMedia({ jpeg: true });
      if (m.isVideo && !m.igReady) {
        throw new Error('Este navegador no grabó el video en H.264, el único formato que acepta Instagram. Descárgalo y súbelo desde la app, o usa Safari/Chrome actualizado.');
      }
      // Video: Reel (4:5 o 9:16) o historia en video. Imagen: post o historia.
      const kind = m.isVideo ? (format === 'story' ? 'story_video' : 'reel') : IG_KIND[format];
      const saved = await uploadPublication(m.blob, m.ext, m.type, {
        media_kind: kind === 'story_video' ? 'story' : kind,
        ...(orderId ? { order_id: orderId } : {}),
      });
      const ig = await igPublish({ mediaUrl: saved.url, kind, caption: buildCaption(), publicationId: saved.id });
      const label = { image: 'Post publicado en el feed', story: 'Historia publicada', reel: 'Reel publicado', story_video: 'Historia en video publicada' }[kind];
      setCardPost(ig.success
        ? { ok: true, text: `${label} en Instagram.` }
        : { ok: false, text: ig.pending ? 'Instagram sigue procesando el video: revisa en unos minutos en Publicaciones.' : ig.error || 'Instagram no confirmó la publicación.' });
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
              hint="Plano de papel, o una foto o video real detrás de la hoja (de la cámara o de tu galería)."
            />
            <div className="esp-chips">
              <button type="button" className={`esp-chip ${!(usePhoto && (photoImg || videoEl)) ? 'active' : ''}`} onClick={() => setUsePhoto(false)}>
                Plano
              </button>
              {(photoImg || videoEl) && (
                <button type="button" className={`esp-chip ${usePhoto ? 'active' : ''}`} onClick={() => setUsePhoto(true)}>
                  {videoEl ? 'Video' : 'Foto'}
                </button>
              )}
            </div>
            <div className="esp-chips">
              <button type="button" className="esp-chip esp-chip-ghost" onClick={() => galleryInputRef.current?.click()}>
                🖼 Elegir de la galería
              </button>
              <button type="button" className="esp-chip esp-chip-ghost" onClick={() => photoInputRef.current?.click()}>
                📷 Tomar foto
              </button>
              <button type="button" className="esp-chip esp-chip-ghost" onClick={() => videoInputRef.current?.click()}>
                🎥 Grabar video
              </button>
            </div>
            {/* Sin "capture" el celular ofrece la galería/fototeca; con "capture" abre la cámara directo */}
            <input ref={galleryInputRef} type="file" accept="image/*,video/*" hidden onChange={handleCapture} />
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleCapture} />
            <input ref={videoInputRef} type="file" accept="video/*" capture="environment" hidden onChange={handleCapture} />

            {captured && (
              <p className="esp-muted">
                {captured.type === 'video'
                  ? `Video: ${captured.file.name}${videoEl && Number.isFinite(videoEl.duration) ? ` · ${Math.round(videoEl.duration)} s` : ''}. La tarjeta se monta encima; al descargar o publicar se graba un video nuevo${videoEl?.duration > 60 ? ' (primeros 60 s)' : ''}.`
                  : `Foto: ${captured.file.name}.`}
              </p>
            )}
            {captured?.type === 'video' && !pickVideoType() && (
              <p className="esp-notice err">Este navegador no puede grabar video. Usa Safari o Chrome actualizados.</p>
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
              {recording !== null && (
                <div className="esp-recording" role="status">
                  <span>● GRABANDO VIDEO</span>
                  <div className="esp-recording-bar"><span style={{ width: `${Math.round(recording * 100)}%` }} /></div>
                  <small>{Math.round(recording * 100)}% · no cierres esta ventana</small>
                </div>
              )}
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

          {cardVideo && videoMode && (
            <div className="esp-video-result">
              <video src={cardVideo.url} controls playsInline />
              <p className="esp-fineprint">
                Video listo · {cardVideo.ext.toUpperCase()}
                {!cardVideo.igReady && ' · Este navegador no grabó en H.264: para Instagram descárgalo y súbelo desde la app.'}
              </p>
            </div>
          )}

          <div className="esp-actions">
            {videoMode && !cardVideo && (
              <button type="button" className="esp-btn esp-btn-primary" disabled={!selected || recording !== null} onClick={() => ensureCardVideo().catch((err) => setNotice({ ok: false, text: err.message }))}>
                {recording !== null ? 'Grabando…' : 'Generar video de la tarjeta'}
              </button>
            )}
            {canShareFiles && (
              <button type="button" className={`esp-btn ${videoMode ? 'esp-btn-ghost' : 'esp-btn-primary'}`} disabled={!selected || recording !== null || (videoMode && !cardVideo)} onClick={share}>
                {videoMode ? 'Compartir video' : 'Compartir imagen'}
              </button>
            )}
            <button type="button" className={`esp-btn ${canShareFiles || videoMode ? 'esp-btn-ghost' : 'esp-btn-primary'}`} disabled={!selected || recording !== null} onClick={download}>
              {videoMode ? `Descargar ${cardVideo ? cardVideo.ext.toUpperCase() : 'video'}` : 'Descargar PNG'}
            </button>
            <button type="button" className="esp-btn esp-btn-ghost" disabled={!selected} onClick={openWhatsApp}>
              Abrir WhatsApp
            </button>
            <button type="button" className="esp-btn esp-btn-ghost" disabled={!selected || !!saleBusy || recording !== null} onClick={() => publishCard()}>
              {saleBusy === 'publish' ? 'Publicando…' : videoMode ? `Publicar ${format === 'story' ? 'historia en video' : 'Reel'}` : `Publicar ${format === 'story' ? 'historia' : 'en el feed'}`}
            </button>
            <button type="button" className="esp-btn esp-btn-ghost" disabled={!selected || saving || !!savedUrl || recording !== null} onClick={saveToPublications}>
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

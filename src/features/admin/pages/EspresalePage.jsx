import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { fetchBogotaWeather } from '../../../shared/lib/weather.js';
import { drawEspresaleCard, parseRecipe, FORMATS, igKind, composeVideoFrame, recordCardVideo, pickVideoType } from '../espresaleCard.js';
import { publishToInstagram as igPublish, recordEspresaleSale } from '../../../shared/lib/instagram.js';
import MicraCamera from '../components/MicraCamera.jsx';
import { CARD_KINDS, PRESETS, presetOf, hasCameraIntent, clearCameraIntent } from '../micraFilters.js';

const PAY_METHODS = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
  { id: 'card', label: 'Tarjeta' },
];
const money = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const PUBLISH_LABEL = { image: 'en el feed', story: 'historia', reel: 'Reel', story_video: 'historia en video' };

const slug = (s) => String(s || 'tarjeta').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

/** Número de WhatsApp: si escriben un celular colombiano de 10 dígitos, le agrega el 57. */
function waDigits(phone) {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 && d.startsWith('3') ? `57${d}` : d;
}

function Field({ label, aside, children }) {
  return (
    <div className="esp-field">
      <div className="esp-field-label"><span>{label}</span>{aside}</div>
      {children}
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

  // Venta y publicación de la tarjeta en Instagram
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [payMethod, setPayMethod] = useState('cash');
  const [sale, setSale] = useState(null); // { orderId, total }
  const [saleBusy, setSaleBusy] = useState(null); // 'sale' | 'publish'
  const [cardPost, setCardPost] = useState(null); // { ok, text }

  // Cámara Micra: se abre de una desde el ícono "m." del inicio (o con el logo)
  const [cameraOpen, setCameraOpen] = useState(hasCameraIntent);
  useEffect(() => { clearCameraIntent(); }, []);

  // Tipo de tarjeta (sección de la cámara), filtro y texto de cada sección
  const [kind, setKind] = useState('recipe');
  const [presetIds, setPresetIds] = useState({ invite: PRESETS.invite[0].id, announce: PRESETS.announce[0].id });
  const [texts, setTexts] = useState({ invite: '', announce: '' });
  const preset = kind === 'recipe' ? null : presetOf(kind, presetIds[kind]);
  const cardText = kind === 'recipe' ? '' : texts[kind];
  const cardReady = kind !== 'recipe' || !!selected;

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, recipe_text, image_url, product_variants(id, label, price, active)')
      .eq('category', 'coffee_bag')
      .eq('active', true)
      .then(({ data, error }) => {
        if (error) console.error('Error cargando variedades:', error.message);
        setVarieties(data ?? []);
        // La cámara abre con un filtro puesto: la primera variedad
        setSelected((cur) => cur ?? data?.[0] ?? null);
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
    if (!cardReady || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const content = { variety: selected, kind, preset, text: cardText };
    if (!videoMode) {
      drawEspresaleCard(canvas, {
        ...content,
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
    // Un dibujo por cuadro nuevo del video (no 60 por segundo) cuando el
    // navegador lo permite.
    const perFrame = typeof videoEl.requestVideoFrameCallback === 'function';
    drawEspresaleCard(overlay, { ...content, weather, date: new Date(), format, videoOverlay: true }).then(() => {
      if (!alive) return;
      // La vista previa se ve a ~400 px: se compone a la mitad de resolución
      // (el video final se graba aparte a tamaño completo).
      canvas.width = overlay.width / 2;
      canvas.height = overlay.height / 2;
      const ctx = canvas.getContext('2d');
      const loop = () => {
        if (!alive) return;
        composeVideoFrame(ctx, videoEl, overlay);
        raf = perFrame ? videoEl.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
      };
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.play().catch(() => {});
      loop();
    });
    setSavedUrl(null);
    return () => {
      alive = false;
      if (perFrame) videoEl.cancelVideoFrameCallback(raf);
      else cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, kind, preset, cardText, cardReady, weather, format, photoImg, usePhoto, videoMode, videoEl, minuteKey]);

  // El video grabado deja de valer si cambia lo que se ve en la tarjeta
  useEffect(() => { setCardVideo(null); }, [selected, kind, preset, cardText, format, videoEl, usePhoto]);

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
  const fileName = `micra-${slug(preset?.name ?? selected?.name)}.png`;

  const buildCaption = () => {
    const where = `${weather.icon} ${tempStr} en Bogotá · ${timeStr}`;
    if (kind === 'invite') {
      return `☕ ${preset.name}${cardText ? ` — ${preset.textLabel.toLowerCase()}: ${cardText}` : ''} · AceroPress\n\n${preset.note}\n\n📍 Chapinero, Bogotá · ${where}`;
    }
    if (kind === 'announce') {
      const coffee = preset.usesVariety && selected ? `: ${selected.name}` : '';
      return `📣 ${preset.name}${coffee} — AceroPress\n\n${cardText || 'Más información en la barra o por WhatsApp.'}\n\n${where}`;
    }
    return `☕ ${selected?.name ?? ''} — AceroPress\n\n${selected?.recipe_text ?? ''}\n\n${where}`;
  };

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
    overlaySnap.__glass = overlayRef.current.__glass;
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
    const path = `esspresale/${Date.now()}-${slug(preset?.name || selected?.name || 'captura')}.${ext}`;
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
      const kind = igKind(format, m.isVideo);
      setSavedUrl((await uploadPublication(m.blob, m.ext, m.type, { media_kind: kind === 'story_video' ? 'story' : kind })).url);
      setNotice({ ok: true, text: 'Guardada — ya aparece en Publicaciones.' });
    } catch (err) {
      console.error(err);
      setNotice({ ok: false, text: `No se pudo guardar: ${err.message || 'error desconocido'}` });
    }
    setSaving(false);
  };

  // Cámara o galería: el tipo se deduce del archivo elegido.
  const takeFile = (file) => {
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    setCaptured({ file, type, url: URL.createObjectURL(file) });
    setUsePhoto(true);
  };
  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) takeFile(file);
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
      const kind = igKind(format, m.isVideo);
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

  const ready = cardReady && recording === null;
  const publishLabel = saleBusy === 'publish'
    ? 'Publicando…'
    : `Publicar ${PUBLISH_LABEL[igKind(format, videoMode)]}`;

  return (
    <div className="admin-page esp esp--console">
      <header className="esp-bar">
        <h1 className="esp-title">
          <button type="button" className="esp-logo-btn" onClick={() => setCameraOpen(true)} title="Abrir la cámara" aria-label="Micra: abrir la cámara">
            Micra<span>.</span><em className="esp-logo-cam" aria-hidden="true">● CÁMARA</em>
          </button>
        </h1>
        <span className="esp-bar-sub">Toca el logo para la cámara · venta en barra · tarjeta para redes</span>
        <span className="esp-badge">{weather.icon} {tempStr} · {timeStr}</span>
      </header>

      <div className="esp-console">
        {/* 01 · Venta: todo lo que se cobra en la barra */}
        <section className="esp-panel" aria-labelledby="esp-sale-title">
          <h2 className="esp-panel-title" id="esp-sale-title"><span>01</span> Venta</h2>

          <Field label="Variedad">
            {varieties === null ? (
              <p className="esp-muted">Cargando variedades…</p>
            ) : varieties.length === 0 ? (
              <p className="esp-muted">No hay cafés activos en el catálogo (categoría coffee_bag).</p>
            ) : (
              <div className="esp-chips">
                {varieties.map((v) => (
                  <button key={v.id} type="button" className={`esp-chip ${selected?.id === v.id ? 'active' : ''}`} onClick={() => setSelected(v)}>
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
            {selected && !selected.recipe_text && <p className="esp-muted">Esta variedad no tiene receta — agrégala en Catálogo.</p>}
          </Field>

          <Field label="Presentación">
            {!selected ? (
              <p className="esp-muted">Elige primero la variedad.</p>
            ) : variants.length === 0 ? (
              <p className="esp-muted">Sin presentaciones con precio activas (Catálogo).</p>
            ) : (
              <div className="esp-chips">
                {variants.map((v) => (
                  <button key={v.id} type="button" className={`esp-chip ${variantId === v.id ? 'active' : ''}`} onClick={() => setVariantId(v.id)}>
                    {v.label} · {money(v.price)}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <div className="esp-sale-row">
            <div className="esp-qty" role="group" aria-label="Cantidad">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">−</button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Más">+</button>
            </div>
            <strong className="esp-sale-total">{variant ? money(Number(variant.price) * qty) : '—'}</strong>
          </div>

          <Field label="Pago">
            <div className="esp-chips esp-chips-pay">
              {PAY_METHODS.map((m) => (
                <button key={m.id} type="button" className={`esp-chip esp-chip-ghost ${payMethod === m.id ? 'active' : ''}`} onClick={() => setPayMethod(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="esp-panel-foot">
            {sale ? (
              <p className="esp-notice ok">✓ Venta registrada: {money(sale.total)}. Suma al contador, al dashboard y al inventario.</p>
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
          </div>
        </section>

        {/* 02 · Tarjeta: fondo, formato y a dónde va */}
        <section className="esp-panel" aria-labelledby="esp-card-title">
          <h2 className="esp-panel-title" id="esp-card-title"><span>02</span> Tarjeta</h2>

          <Field label="Tipo de tarjeta">
            <div className="esp-chips esp-chips-kind">
              {CARD_KINDS.map((k) => (
                <button key={k.id} type="button" className={`esp-chip ${kind === k.id ? 'active' : ''}`} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                  {k.label}
                </button>
              ))}
            </div>
            {preset && (
              <div className="esp-kind-row">
                <select className="esp-input" aria-label="Modelo" value={preset.id} onChange={(e) => setPresetIds((p) => ({ ...p, [kind]: e.target.value }))}>
                  {PRESETS[kind].map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input
                  className="esp-input"
                  aria-label={preset.textLabel}
                  placeholder={`${preset.textLabel}: ${preset.placeholder}`}
                  maxLength={kind === 'announce' ? 140 : 40}
                  value={cardText}
                  onChange={(e) => setTexts((t) => ({ ...t, [kind]: e.target.value }))}
                />
              </div>
            )}
          </Field>

          <Field label="Fondo">
            <div className="esp-chips">
              <button type="button" className={`esp-chip ${!(usePhoto && (photoImg || videoEl)) ? 'active' : ''}`} onClick={() => setUsePhoto(false)}>
                Plano
              </button>
              {(photoImg || videoEl) && (
                <button type="button" className={`esp-chip ${usePhoto ? 'active' : ''}`} onClick={() => setUsePhoto(true)}>
                  {videoEl ? 'Video' : 'Foto'}
                </button>
              )}
              <button type="button" className="esp-chip esp-chip-ghost" onClick={() => galleryInputRef.current?.click()}>🖼 Galería</button>
              <button type="button" className="esp-chip esp-chip-ghost" onClick={() => photoInputRef.current?.click()}>📷 Foto</button>
              <button type="button" className="esp-chip esp-chip-ghost" onClick={() => videoInputRef.current?.click()}>🎥 Video</button>
            </div>
            {/* Sin "capture" el celular ofrece la galería/fototeca; con "capture" abre la cámara directo */}
            <input ref={galleryInputRef} type="file" accept="image/*,video/*" hidden onChange={handleCapture} />
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleCapture} />
            <input ref={videoInputRef} type="file" accept="video/*" capture="environment" hidden onChange={handleCapture} />
            {captured && (
              <p className="esp-muted">
                {captured.type === 'video'
                  ? `Video: ${captured.file.name}${videoEl && Number.isFinite(videoEl.duration) ? ` · ${Math.round(videoEl.duration)} s` : ''}. Al descargar o publicar se graba un video nuevo${videoEl?.duration > 60 ? ' (primeros 60 s)' : ''}.`
                  : `Foto: ${captured.file.name}.`}
              </p>
            )}
            {captured?.type === 'video' && !pickVideoType() && (
              <p className="esp-notice err">Este navegador no puede grabar video. Usa Safari o Chrome actualizados.</p>
            )}
          </Field>

          <Field label="Formato">
            <div className="esp-chips">
              {Object.entries(FORMATS).map(([id, f]) => (
                <button key={id} type="button" className={`esp-chip esp-chip-format ${format === id ? 'active' : ''}`} onClick={() => setFormat(id)}>
                  <span className={`esp-ratio esp-ratio-${id}`} aria-hidden="true" />
                  <span className="esp-chip-text">{f.label}<small>{f.apps}</small></span>
                </button>
              ))}
            </div>
            <label className="esp-toggle">
              <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} />
              Ver zonas de la app en la vista previa
            </label>
          </Field>

          <Field label="WhatsApp del cliente" aside={<small>Opcional · va con la venta y la tarjeta</small>}>
            <input type="tel" inputMode="tel" className="esp-input" placeholder="300 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>

          <Field label="Enviar y publicar">
            <div className="esp-grid-actions">
              {videoMode && !cardVideo && (
                <button type="button" className="esp-btn esp-btn-primary" disabled={!ready} onClick={() => ensureCardVideo().catch((err) => setNotice({ ok: false, text: err.message }))}>
                  {recording !== null ? 'Grabando…' : 'Generar video'}
                </button>
              )}
              {canShareFiles && (
                <button type="button" className={`esp-btn ${videoMode ? 'esp-btn-ghost' : 'esp-btn-primary'}`} disabled={!ready || (videoMode && !cardVideo)} onClick={share}>
                  {videoMode ? 'Compartir video' : 'Compartir imagen'}
                </button>
              )}
              <button type="button" className={`esp-btn ${canShareFiles || videoMode ? 'esp-btn-ghost' : 'esp-btn-primary'}`} disabled={!ready} onClick={download}>
                {videoMode ? `Descargar ${cardVideo ? cardVideo.ext.toUpperCase() : 'video'}` : 'Descargar PNG'}
              </button>
              <button type="button" className="esp-btn esp-btn-ghost" disabled={!cardReady} onClick={openWhatsApp}>Abrir WhatsApp</button>
              <button type="button" className="esp-btn esp-btn-ghost" disabled={!ready || !!saleBusy} onClick={() => publishCard()}>{publishLabel}</button>
              <button type="button" className="esp-btn esp-btn-ghost" disabled={!ready || saving || !!savedUrl} onClick={saveToPublications}>
                {savedUrl ? '✓ En Publicaciones' : saving ? 'Guardando…' : 'Guardar en Publicaciones'}
              </button>
            </div>
          </Field>

          <div className="esp-panel-foot">
            {cardPost && <p className={`esp-notice ${cardPost.ok ? 'ok' : 'err'}`}>{cardPost.text}</p>}
            {notice && <p className={`esp-notice ${notice.ok ? 'ok' : 'err'}`}>{notice.text}</p>}
            <p className="esp-fineprint">
              {canShareFiles
                ? '“Compartir” abre el menú del celular y adjunta la tarjeta a WhatsApp o Instagram.'
                : 'WhatsApp Web no adjunta imágenes solo: descarga el PNG y arrástralo al chat que se abre.'}
            </p>
          </div>
        </section>

        {/* 03 · Vista previa: la tarjeta cabe en el alto de la pantalla */}
        <section className="esp-preview" aria-label="Vista previa de la tarjeta">
          <div className="esp-cota esp-cota-dark">
            <span>03 · VISTA PREVIA · {w}×{h}</span>
            <span className="esp-badge">{FORMATS[format].apps}</span>
          </div>

          <div className={`esp-canvas-wrap esp-canvas-${format}`} style={{ '--esp-ar': w / h }}>
            <div className="esp-canvas-frame" hidden={!cardReady}>
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
                  <span className="esp-zone-safe" style={{ left: pct(safe.x0, w), top: pct(safe.y0, h), width: pct(safe.x1 - safe.x0, w), height: pct(safe.y1 - safe.y0, h) }}>
                    <em>ZONA SEGURA</em>
                  </span>
                </div>
              )}
            </div>
            {!cardReady && (
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
        </section>
      </div>

      {cameraOpen && (
        <MicraCamera
          varieties={varieties}
          variety={selected}
          onVariety={setSelected}
          kind={kind}
          onKind={setKind}
          presetId={preset?.id}
          onPreset={(id) => setPresetIds((p) => ({ ...p, [kind]: id }))}
          text={cardText}
          onText={(t) => setTexts((x) => ({ ...x, [kind]: t }))}
          format={format}
          weather={weather}
          onFormat={setFormat}
          onFile={(file) => { takeFile(file); setCameraOpen(false); }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}

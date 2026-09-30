import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { fetchBogotaWeather } from '../../../shared/lib/weather.js';

const CARD_SIZE = 1080;

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, curY);
      line = word + ' ';
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, curY);
  return curY + lineHeight;
}

function drawCard(canvas, { variety, weather, timeStr }) {
  const ctx = canvas.getContext('2d');
  const S = CARD_SIZE;
  canvas.width = S;
  canvas.height = S;

  ctx.fillStyle = '#1E1E1E';
  ctx.fillRect(0, 0, S, S);

  const chrome = ctx.createLinearGradient(0, 0, S, 0);
  chrome.addColorStop(0, '#cfd3d8');
  chrome.addColorStop(0.15, '#ffffff');
  chrome.addColorStop(0.3, '#8b8f96');
  chrome.addColorStop(0.45, '#eef0f2');
  chrome.addColorStop(0.6, '#9a9ea5');
  chrome.addColorStop(0.75, '#ffffff');
  chrome.addColorStop(0.9, '#b7bbc1');
  chrome.addColorStop(1, '#7d8188');
  ctx.fillStyle = chrome;
  ctx.fillRect(0, 0, S, 14);

  ctx.fillStyle = '#F7F3E8';
  ctx.font = '700 40px Arial';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ACERO', 60, 110);
  ctx.fillStyle = '#de1b1b';
  ctx.font = '700 40px Arial';
  ctx.fillText('.press', 60 + ctx.measureText('ACERO').width, 110);

  ctx.fillStyle = '#F7F3E8';
  ctx.font = '900 84px Arial';
  wrapText(ctx, variety.name.toUpperCase(), 60, 260, S - 120, 88);

  const panelY = 420;
  const panelH = 330;
  ctx.fillStyle = 'rgba(247,243,232,0.06)';
  ctx.fillRect(50, panelY, S - 100, panelH);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(50, panelY, S - 100, panelH);

  ctx.fillStyle = '#de1b1b';
  ctx.font = '700 26px monospace';
  ctx.fillText('RECETA', 84, panelY + 56);

  ctx.fillStyle = '#F7F3E8';
  ctx.font = '400 34px Arial';
  wrapText(ctx, variety.recipe_text || 'Consulta la receta con nuestro barista.', 84, panelY + 110, S - 170, 46);

  const footY = S - 90;
  ctx.font = '600 30px Arial';
  ctx.fillStyle = '#F7F3E8';
  const line = `${weather.icon}  ${weather.tempC !== null ? weather.tempC + '°C' : ''}  ·  ${timeStr}  ·  AceroPress, Bogotá`;
  ctx.fillText(line, 60, footY);
}

export default function EspresalePage() {
  const [varieties, setVarieties] = useState([]);
  const [selected, setSelected] = useState(null);
  const [phone, setPhone] = useState('');
  const [weather, setWeather] = useState({ tempC: null, condition: '', icon: '🌡️' });
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState(null);
  const canvasRef = useRef(null);

  // --- Cámara: foto o video real ---
  const [capturedFile, setCapturedFile] = useState(null);
  const [capturedType, setCapturedType] = useState(null); // 'image' | 'video'
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState(null);
  const [capturedSaving, setCapturedSaving] = useState(false);
  const [capturedSavedUrl, setCapturedSavedUrl] = useState(null);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // --- Publicar en Instagram (usa la función publish-content ya desplegada) ---
  const [igPublishing, setIgPublishing] = useState(false);
  const [igResult, setIgResult] = useState(null);

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, recipe_text')
      .eq('category', 'coffee_bag')
      .eq('active', true)
      .then(({ data }) => setVarieties(data ?? []));
    fetchBogotaWeather().then(setWeather);
  }, []);

  const generate = useCallback(() => {
    if (!selected || !canvasRef.current) return;
    const timeStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    drawCard(canvasRef.current, { variety: selected, weather, timeStr });
    setGenerated(true);
    setSavedUrl(null);
  }, [selected, weather]);

  const download = () => {
    canvasRef.current.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `espresale-${selected.name.toLowerCase().replace(/\s+/g, '-')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const buildCaption = () =>
    `☕ ${selected?.name ?? ''} — AceroPress\n\n${selected?.recipe_text ?? ''}\n\n${weather.icon} ${weather.tempC}°C en Bogotá · ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;

  const openWhatsAppToCustomer = () => {
    if (!phone.trim()) {
      alert('Escribe el número de WhatsApp del cliente primero.');
      return;
    }
    const digits = phone.replace(/\D/g, '');
    const msg = buildCaption() + '\n\nTe compartimos esta foto de tu preparación 👇 (adjúntala manualmente si no se adjuntó sola).';
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const saveToPublications = async () => {
    if (!canvasRef.current) return;
    setSaving(true);
    canvasRef.current.toBlob(async (blob) => {
      const fileName = `espresale/${Date.now()}-${selected.name.toLowerCase().replace(/\s+/g, '-')}.png`;
      const { error: uploadError } = await supabase.storage.from('marketing').upload(fileName, blob, {
        contentType: 'image/png',
      });
      if (uploadError) {
        console.error(uploadError);
        alert('No se pudo guardar la imagen.');
        setSaving(false);
        return;
      }
      const { data: pub } = supabase.storage.from('marketing').getPublicUrl(fileName);
      await supabase.from('publications').insert({
        video_url: pub.publicUrl,
        caption: buildCaption(),
        caption_es: buildCaption(),
      });
      setSavedUrl(pub.publicUrl);
      setSaving(false);
    }, 'image/png');
  };

  // --- Cámara ---
  const handleCapture = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedFile(file);
    setCapturedType(type);
    setCapturedPreviewUrl(URL.createObjectURL(file));
    setCapturedSavedUrl(null);
    setIgResult(null);
  };

  const saveCapturedToPublications = async () => {
    if (!capturedFile) return;
    setCapturedSaving(true);
    const ext = capturedType === 'video' ? 'mp4' : 'jpg';
    const fileName = `espresale/${Date.now()}-captura.${ext}`;
    const { error: uploadError } = await supabase.storage.from('marketing').upload(fileName, capturedFile, {
      contentType: capturedFile.type,
    });
    if (uploadError) {
      console.error(uploadError);
      alert('No se pudo guardar el archivo.');
      setCapturedSaving(false);
      return;
    }
    const { data: pub } = supabase.storage.from('marketing').getPublicUrl(fileName);
    await supabase.from('publications').insert({
      video_url: pub.publicUrl,
      caption: buildCaption(),
      caption_es: buildCaption(),
    });
    setCapturedSavedUrl(pub.publicUrl);
    setCapturedSaving(false);
  };

  // Instagram (Reels) solo acepta video — usa la función publish-content que
  // ya está desplegada en este proyecto de Supabase.
  const publishToInstagram = async () => {
    const videoUrl = capturedSavedUrl;
    if (!videoUrl) {
      alert('Primero guarda un video en Publicaciones (Instagram Reels no acepta fotos).');
      return;
    }
    setIgPublishing(true);
    setIgResult(null);
    const { data, error } = await supabase.functions.invoke('publish-content', {
      body: { video_url: videoUrl, caption: buildCaption(), platforms: { ig: true } },
    });
    setIgPublishing(false);
    if (error) {
      setIgResult({ ok: false, message: error.message || 'No se pudo publicar.' });
      return;
    }
    const igOutcome = data?.results?.instagram;
    if (igOutcome?.success) {
      setIgResult({ ok: true, message: '✓ Publicado en Instagram.' });
    } else {
      setIgResult({ ok: false, message: igOutcome?.error || 'Instagram no confirmó la publicación (revisa las credenciales configuradas en la función).' });
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Espresale</h1>
      <p className="admin-page-sub">
        Elige la variedad, escribe el WhatsApp del cliente y genera la tarjeta con receta, clima y hora —
        o toma una foto/video real desde la cámara para publicar directo en Instagram.
      </p>

      <div className="admin-espresale-layout">
        <div className="admin-espresale-form">
          <div className="admin-card">
            <div className="admin-card-header"><h3>1. Variedad</h3></div>
            <div className="admin-espresale-varieties">
              {varieties.map((v) => (
                <button
                  key={v.id}
                  className={`admin-variety-btn ${selected?.id === v.id ? 'active' : ''}`}
                  onClick={() => { setSelected(v); setGenerated(false); }}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header"><h3>2. WhatsApp del cliente</h3></div>
            <input
              type="text"
              className="admin-price-input"
              style={{ width: '100%' }}
              placeholder="57300xxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="admin-card">
            <div className="admin-card-header"><h3>3. Clima y hora (automático)</h3></div>
            <p className="admin-page-sub" style={{ margin: 0 }}>
              {weather.icon} {weather.tempC !== null ? `${weather.tempC}°C` : '—'} en Bogotá · {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <button className="admin-btn-primary" disabled={!selected} onClick={generate}>
            Generar tarjeta
          </button>

          <div className="admin-card">
            <div className="admin-card-header"><h3>4. Foto o video real (cámara)</h3></div>
            <p className="admin-page-sub" style={{ marginBottom: '.6rem' }}>
              En celular, esto abre la cámara directamente. Un video es necesario si vas a publicar en Instagram Reels.
            </p>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <button className="admin-btn-ghost admin-btn-sm" onClick={() => photoInputRef.current?.click()}>
                📷 Tomar foto
              </button>
              <button className="admin-btn-ghost admin-btn-sm" onClick={() => videoInputRef.current?.click()}>
                🎥 Grabar video
              </button>
            </div>
            <input
              ref={photoInputRef} type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }} onChange={(e) => handleCapture(e, 'image')}
            />
            <input
              ref={videoInputRef} type="file" accept="video/*" capture="environment"
              style={{ display: 'none' }} onChange={(e) => handleCapture(e, 'video')}
            />

            {capturedPreviewUrl && (
              <div style={{ marginTop: '.8rem' }}>
                {capturedType === 'video' ? (
                  <video src={capturedPreviewUrl} controls style={{ width: '100%', borderRadius: 8 }} />
                ) : (
                  <img src={capturedPreviewUrl} alt="" style={{ width: '100%', borderRadius: 8 }} />
                )}
                <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem', flexWrap: 'wrap' }}>
                  <button className="admin-btn-primary admin-btn-sm" disabled={capturedSaving} onClick={saveCapturedToPublications}>
                    {capturedSaving ? 'Guardando…' : 'Guardar en Publicaciones'}
                  </button>
                  {capturedType === 'video' && (
                    <button className="admin-btn-primary admin-btn-sm" disabled={igPublishing || !capturedSavedUrl} onClick={publishToInstagram}>
                      {igPublishing ? 'Publicando…' : '📸 Publicar en Instagram'}
                    </button>
                  )}
                </div>
                {capturedSavedUrl && <p className="admin-fineprint">✓ Guardado en Publicaciones.</p>}
                {capturedType === 'video' && !capturedSavedUrl && (
                  <p className="admin-fineprint">Guarda el video primero para poder publicarlo en Instagram.</p>
                )}
                {igResult && (
                  <p className="admin-fineprint" style={{ color: igResult.ok ? '#0f7d4d' : '#de1b1b' }}>
                    {igResult.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="admin-espresale-preview">
          <canvas ref={canvasRef} className="admin-espresale-canvas" style={{ display: generated ? 'block' : 'none' }} />
          {!generated && <p className="admin-loading">Elige una variedad y da clic en "Generar tarjeta".</p>}

          {generated && (
            <div className="admin-espresale-actions">
              <button className="admin-btn-ghost admin-btn-sm" onClick={download}>Descargar imagen</button>
              <button className="admin-btn-ghost admin-btn-sm" onClick={openWhatsAppToCustomer}>
                Abrir WhatsApp del cliente
              </button>
              <button className="admin-btn-primary admin-btn-sm" disabled={saving} onClick={saveToPublications}>
                {saving ? 'Guardando…' : 'Guardar en Publicaciones'}
              </button>
              {savedUrl && <p className="admin-fineprint">✓ Guardada — ya aparece en la pestaña Publicaciones.</p>}
              <p className="admin-fineprint">
                WhatsApp no permite adjuntar imágenes automáticamente a un número — descarga la imagen
                primero y adjúntala tú mismo en el chat que se abre. Esta tarjeta (imagen fija) tampoco
                sirve para Instagram Reels — usa la cámara (abajo) para eso.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

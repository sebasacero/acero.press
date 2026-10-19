import { useCallback, useEffect, useRef, useState } from 'react';
import { drawEspresaleCard, FORMATS, pickVideoType } from '../espresaleCard.js';
import { CARD_KINDS, PRESETS, presetOf } from '../micraFilters.js';

// Cámara de Micra, como la de una red social: se abre ya encendida y la
// tarjeta es el filtro. Abajo, un carrusel de filtros redondos (cada uno con
// el nombre que va en la tarjeta) con el disparador en el centro, y debajo
// las secciones: Receta, Invitación y Anuncio. Arriba, el formato
// (feed, reel, historia), foto o video y el cambio de cámara.
//
// Pensada para gastar poco: el video lo pinta el navegador (hardware, sin
// filtros CSS), la tarjeta se dibuja UNA vez por cambio de filtro, la foto se
// toma una sola vez (a resolución del sensor si se puede) y el video se graba
// directo de la cámara. La cámara se apaga al cerrar, al tomar y si la app se
// va a segundo plano. Si no hay acceso, el disparador usa la del celular.

const MAX_SECONDS = 60;
const FORMAT_ORDER = ['feed', 'reel', 'story'];
const FORMAT_SHORT = { feed: '4:5', reel: 'Reel', story: 'Historia' };
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const stopStream = (s) => s?.getTracks().forEach((t) => t.stop());
const canLive = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Carrusel de filtros: el del centro es el elegido y el disparador. */
function FilterCarousel({ filters, selectedId, onSelect, onShutter, shutterClass, disabled }) {
  const ref = useRef(null);
  const settle = useRef(0);

  // El elegido siempre queda en el centro (al abrir y al cambiar de sección)
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-id="${CSS.escape(String(selectedId ?? ''))}"]`);
    if (el) ref.current.scrollTo({ left: el.offsetLeft - (ref.current.clientWidth - el.offsetWidth) / 2, behavior: 'instant' });
  }, [selectedId, filters]);

  // Al soltar el carrusel, el filtro que quedó en el centro es el elegido
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const box = ref.current;
      if (!box) return;
      const mid = box.scrollLeft + box.clientWidth / 2;
      let best = null;
      for (const el of box.querySelectorAll('[data-id]')) {
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
        if (!best || d < best.d) best = { d, id: el.dataset.id };
      }
      if (best && best.id !== String(selectedId)) onSelect(best.id);
    }, 110);
  };
  useEffect(() => () => clearTimeout(settle.current), []);

  return (
    <div className="mc-carousel-wrap">
      <div className="mc-carousel" ref={ref} onScroll={onScroll} role="listbox" aria-label="Filtros">
        {filters.map((f) => {
          const on = String(f.id) === String(selectedId);
          return (
            <button
              key={f.id}
              type="button"
              data-id={f.id}
              role="option"
              aria-selected={on}
              aria-label={on ? `${f.name}: tomar` : f.name}
              className={`mc-filter ${on ? 'on' : ''}`}
              disabled={disabled && !on}
              onClick={(e) => {
                if (on) { onShutter(); return; }
                onSelect(String(f.id));
                e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
              }}
            >
              {f.thumb ? <img src={f.thumb} alt="" loading="lazy" /> : <span className="mc-filter-glyph" aria-hidden="true">{f.glyph ?? f.name.slice(0, 1)}</span>}
            </button>
          );
        })}
      </div>
      <span className={`mc-shutter-ring ${shutterClass}`} aria-hidden="true" />
    </div>
  );
}

export default function MicraCamera({
  varieties, variety, onVariety,
  kind, onKind, presetId, onPreset, text, onText,
  format, onFormat, weather, onFile, onClose,
}) {
  const videoRef = useRef(null);
  const cardRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const nativeRef = useRef(null);
  const galleryRef = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [status, setStatus] = useState(canLive() ? 'starting' : 'error'); // starting | live | error
  const [mode, setMode] = useState('photo');
  const [seconds, setSeconds] = useState(null); // grabando
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // texto que se está escribiendo

  // Cámara: encendida de una, solo video y a 30 cuadros como máximo (el micrófono se pide al grabar)
  useEffect(() => {
    if (!canLive()) return undefined;
    let cancelled = false;
    setStatus('starting');
    stopStream(streamRef.current);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }, audio: false })
      .then(async (stream) => {
        if (cancelled) { stopStream(stream); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        setStatus('live');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [facing]);

  // Se apaga todo al salir o si la app pasa a segundo plano
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const off = () => {
      const r = recRef.current;
      if (r) { r.cancelled = true; if (r.recorder.state === 'recording') r.recorder.stop(); }
      stopStream(streamRef.current);
      streamRef.current = null;
    };
    const onHide = () => { if (document.hidden) { off(); onCloseRef.current(); } };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); off(); };
  }, []);

  // Esc: cierra el editor de texto o la cámara
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (editing !== null) setEditing(null);
      else if (!recRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [editing]);

  // El filtro: la tarjeta se dibuja una vez por cambio (transparente sobre el video)
  const preset = kind === 'recipe' ? null : presetOf(kind, presetId);
  useEffect(() => {
    const c = cardRef.current;
    if (!c) return;
    if (kind === 'recipe' && !variety) { c.getContext('2d')?.clearRect(0, 0, c.width, c.height); return; }
    drawEspresaleCard(c, { variety, weather, date: new Date(), format, videoOverlay: true, kind, preset, text });
  }, [variety, weather, format, kind, preset, text]);

  // Filtros de la sección: en Receta, las variedades; en las otras, sus modelos
  const filters = kind === 'recipe'
    ? (varieties ?? []).map((v) => ({ id: v.id, name: v.name, thumb: v.image_url || null }))
    : PRESETS[kind].map((p) => ({ id: p.id, name: p.name, glyph: p.glyph }));
  const selectedId = kind === 'recipe' ? variety?.id : preset?.id;
  const selectedName = kind === 'recipe' ? variety?.name : preset?.name;
  const selectFilter = useCallback((id) => {
    if (kind === 'recipe') {
      const v = (varieties ?? []).find((x) => String(x.id) === String(id));
      if (v) onVariety(v);
    } else onPreset(id);
  }, [kind, varieties, onVariety, onPreset]);

  const takePhoto = async () => {
    setBusy(true);
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      let blob = null;
      // Foto a resolución del sensor (Chrome/Android); si no, el cuadro del video
      if (track && typeof window.ImageCapture === 'function') {
        try { blob = await new window.ImageCapture(track).takePhoto(); } catch { blob = null; }
      }
      if (!blob) {
        const v = videoRef.current;
        const c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.92));
      }
      onFile(new File([blob], `micra-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }));
    } finally {
      setBusy(false);
    }
  };

  const startVideo = async () => {
    const type = pickVideoType();
    if (!type) { nativeRef.current?.click(); return; }
    // Micrófono solo mientras se graba
    let mic = null;
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { mic = null; }
    const stream = new MediaStream([...streamRef.current.getVideoTracks(), ...(mic?.getAudioTracks() ?? [])]);
    const recorder = new MediaRecorder(stream, { mimeType: type });
    const chunks = [];
    const r = { recorder, cancelled: false, timer: 0 };
    recRef.current = r;
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      clearInterval(r.timer);
      stopStream(mic);
      recRef.current = null;
      setSeconds(null);
      if (r.cancelled || !chunks.length) return;
      const mime = type.split(';')[0];
      onFile(new File([new Blob(chunks, { type: mime })], `micra-${Date.now()}.${mime === 'video/mp4' ? 'mp4' : 'webm'}`, { type: mime }));
    };
    const started = Date.now();
    r.timer = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) recorder.stop();
    }, 1000);
    recorder.start(1000);
    setSeconds(0);
  };

  const recording = seconds !== null;
  const ready = kind !== 'recipe' || !!variety;
  const shutter = () => {
    if (!ready || busy) return;
    // Sin cámara en vivo, el disparador abre la del celular (foto o video)
    if (status === 'error') { nativeRef.current?.click(); return; }
    if (status !== 'live') return;
    if (mode === 'photo') takePhoto();
    else if (recording) recRef.current?.recorder.stop();
    else startVideo();
  };

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  };

  const nextFormat = FORMAT_ORDER[(FORMAT_ORDER.indexOf(format) + 1) % FORMAT_ORDER.length];
  const { w, h } = FORMATS[format];
  const shutterClass = `${mode === 'video' ? 'is-video' : ''} ${recording ? 'is-rec' : ''}`;

  return (
    <div className="mcam" role="dialog" aria-modal="true" aria-label="Cámara Micra">
      <div className="mc-stage">
        <div className="mc-frame" style={{ '--mc-ar': w / h }}>
          {status === 'error'
            ? <div className="mc-bg" aria-hidden="true" />
            : <video ref={videoRef} className="mc-video" playsInline muted />}
          <canvas ref={cardRef} className="mc-card" aria-hidden="true" />
          {status === 'starting' && <p className="mc-status">Abriendo la cámara…</p>}
          {recording && <span className="mc-rec">● REC {clock(seconds)} / {clock(MAX_SECONDS)}</span>}
        </div>
      </div>

      <header className="mc-top">
        <button type="button" className="mc-round" onClick={onClose} disabled={recording} aria-label="Cerrar la cámara">×</button>
        <div className="mc-top-mid">
          <button type="button" className="mc-pill" onClick={() => onFormat(nextFormat)} disabled={recording} aria-label={`Formato ${FORMATS[format].label}; cambiar a ${FORMATS[nextFormat].label}`}>
            <i className={`mc-ratio mc-ratio-${format}`} aria-hidden="true" />{FORMAT_SHORT[format]}
          </button>
          <div className="mc-seg" role="group" aria-label="Foto o video">
            {[['photo', 'Foto'], ['video', 'Video']].map(([id, label]) => (
              <button key={id} type="button" className={mode === id ? 'on' : ''} aria-pressed={mode === id} disabled={recording} onClick={() => setMode(id)}>{label}</button>
            ))}
          </div>
        </div>
        <button type="button" className="mc-round" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} disabled={recording || status === 'error'} aria-label="Cambiar de cámara">⟲</button>
      </header>

      <div className="mc-under">
        {status === 'error' && <p className="mc-note">Sin cámara en vivo aquí: el disparador abre la cámara del celular.</p>}

        {kind !== 'recipe' && preset && (
          <button type="button" className="mc-text" onClick={() => setEditing(text)} disabled={recording}>
            <b aria-hidden="true">Aa</b>
            <span>{text ? `${preset.textLabel}: ${text}` : `${preset.textLabel}: escribe aquí`}</span>
          </button>
        )}

        <p className="mc-filter-name" aria-live="polite">{selectedName || (kind === 'recipe' ? 'Sin variedades activas' : '')}</p>

        <FilterCarousel
          filters={filters}
          selectedId={selectedId}
          onSelect={selectFilter}
          onShutter={shutter}
          shutterClass={shutterClass}
          disabled={recording}
        />

        <div className="mc-modes-row">
          <button type="button" className="mc-round mc-gallery" onClick={() => galleryRef.current?.click()} disabled={recording} aria-label="Elegir de la galería">▦</button>
          <div className="mc-kinds" role="tablist" aria-label="Sección">
            {CARD_KINDS.map((k) => (
              <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'on' : ''} disabled={recording} onClick={() => onKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
          <span className="mc-round mc-round-ghost" aria-hidden="true" />
        </div>
      </div>

      {editing !== null && preset && (
        <form className="mc-editor" onSubmit={(e) => { e.preventDefault(); onText(editing.trim()); setEditing(null); }}>
          <label className="mc-editor-label" htmlFor="mc-editor-input">{preset.textLabel}</label>
          <textarea
            id="mc-editor-input"
            autoFocus
            rows={kind === 'announce' ? 3 : 1}
            maxLength={kind === 'announce' ? 140 : 40}
            placeholder={preset.placeholder}
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }}
          />
          <div className="mc-editor-actions">
            <button type="button" className="mc-pill" onClick={() => setEditing(null)}>Cancelar</button>
            <button type="submit" className="mc-pill mc-pill-on">Listo</button>
          </div>
        </form>
      )}

      {/* Con "capture" el celular abre su cámara (foto o video); sin él, la galería */}
      <input ref={nativeRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" hidden onChange={pick} />
    </div>
  );
}

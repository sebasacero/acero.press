import { useCallback, useEffect, useRef, useState } from 'react';
import { drawEspresaleCard, FORMATS, pickVideoType } from '../espresaleCard.js';
import { CARD_KINDS, PRESETS, presetOf } from '../micraFilters.js';
import FilterCarousel from './FilterCarousel.jsx';
import { IconClose, IconFlip, IconGallery } from './icons.jsx';

// Cámara de Micra, como la de una red social: se abre ya encendida y la
// tarjeta es el filtro (con el diseño que el usuario dejó en el editor).
// Abajo, el carrusel de filtros con el disparador en el centro, las secciones
// (Receta, Invitación, Anuncio) y el botón de venta rápida `$`. Arriba, el
// formato, Plano/Foto/Video y el cambio de cámara.
//
// Pensada para gastar poco: el video lo pinta el navegador (hardware, sin
// filtros CSS), la tarjeta se dibuja UNA vez por cambio, la foto se toma una
// sola vez y el video se graba directo de la cámara. La cámara se apaga en
// Plano, al tomar, al salir y si la app pasa a segundo plano (y vuelve sola).

const MAX_SECONDS = 60;
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const stopStream = (s) => s?.getTracks().forEach((t) => t.stop());
export const canLive = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const typing = (el) => !!el?.closest?.('input, textarea, select, [contenteditable="true"]');

export default function MicraCamera({
  varieties, variety, onVariety, kind, onKind, presetId, onPreset,
  format, onOpenFormat, weather, elements, texts, priceText, filterExtra, cobrand,
  mode, onMode, paused, onCapture, onEditText, onOpenSale, ticketLabel, onExit, note, onRecording,
}) {
  const videoRef = useRef(null);
  const cardRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const nativeRef = useRef(null);
  const galleryRef = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [status, setStatus] = useState(mode === 'plain' ? 'off' : 'starting'); // starting | live | denied | error | off
  const [restart, setRestart] = useState(0);
  const [seconds, setSeconds] = useState(null); // grabando
  const [busy, setBusy] = useState(false);
  const [localNote, setLocalNote] = useState(null);
  const plain = mode === 'plain';
  const recording = seconds !== null;
  useEffect(() => { onRecording?.(recording); }, [recording, onRecording]);

  // Cámara: solo video y a 30 cuadros como máximo (el micrófono, solo al grabar)
  useEffect(() => {
    if (plain) { setStatus('off'); return undefined; }
    if (!canLive()) {
      setLocalNote('Sin cámara aquí: usa Plano o elige una foto');
      onMode('plain');
      return undefined;
    }
    let cancelled = false;
    setStatus('starting');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }, audio: false })
      .then(async (stream) => {
        if (cancelled) { stopStream(stream); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) { stopStream(stream); return; }
        v.srcObject = stream;
        await v.play().catch(() => {});
        if (!cancelled) setStatus('live');
      })
      .catch((err) => {
        if (cancelled) return;
        const name = err?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('denied');
        else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotSupportedError') {
          setLocalNote('Sin cámara aquí: usa Plano o elige una foto');
          onMode('plain');
        } else setStatus('error');
      });
    return () => {
      cancelled = true;
      const r = recRef.current;
      if (r) { r.cancelled = true; if (r.recorder.state === 'recording') r.recorder.stop(); }
      stopStream(streamRef.current);
      streamRef.current = null;
      const v = videoRef.current;
      if (v) v.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, plain, restart]);

  // Segundo plano: se apaga todo (y se descarta lo que se grababa); al volver, se enciende sola
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        const r = recRef.current;
        if (r) { r.cancelled = true; if (r.recorder.state === 'recording') r.recorder.stop(); }
        stopStream(streamRef.current);
        streamRef.current = null;
        setStatus((s) => (s === 'off' ? s : 'starting'));
      } else if (!plain) setRestart((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [plain]);

  // Con una hoja encima, el video se pausa (no gasta pintando lo que no se ve)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || status !== 'live') return;
    if (paused && !recording) v.pause();
    else v.play().catch(() => {});
  }, [paused, status, recording]);

  // El filtro: la tarjeta se dibuja una vez por cambio (transparente sobre el video; en Plano, el papel)
  const preset = kind === 'recipe' ? null : presetOf(kind, presetId);
  useEffect(() => {
    const c = cardRef.current;
    if (!c) return;
    if (kind === 'recipe' && !variety) { c.getContext('2d')?.clearRect(0, 0, c.width, c.height); return; }
    drawEspresaleCard(c, { variety, weather, date: new Date(), format, videoOverlay: !plain, kind, preset, texts, elements, priceText, cobrand });
  }, [variety, weather, format, kind, preset, texts, elements, priceText, cobrand, plain]);

  // Filtros de la sección: en Receta, las variedades; en las otras, sus modelos
  const filters = kind === 'recipe'
    ? (varieties ?? []).map((v) => ({ id: v.id, name: v.name, thumb: v.image_url || null }))
    : PRESETS[kind].map((p) => ({ id: p.id, name: p.name, glyph: p.glyph }));
  const selectedId = kind === 'recipe' ? variety?.id : preset?.id;
  const selectedName = kind === 'recipe' ? variety?.name : preset?.name;
  const selectFilter = useCallback((id) => {
    if (kind === 'recipe') {
      const v = (varieties ?? []).find((x) => String(x.id) === String(id));
      if (v) onVariety(v.id);
    } else onPreset(id);
  }, [kind, varieties, onVariety, onPreset]);
  const stepFilter = (dir) => {
    const i = filters.findIndex((f) => String(f.id) === String(selectedId));
    const next = filters[Math.max(0, Math.min(filters.length - 1, i + dir))];
    if (next) selectFilter(next.id);
  };

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
      if (blob) onCapture(new File([blob], `micra-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }));
    } finally {
      setBusy(false);
    }
  };

  const startVideo = async () => {
    const type = pickVideoType();
    if (!type || !streamRef.current) { nativeRef.current?.click(); return; }
    const r = { recorder: null, cancelled: false, stopAsked: false, timer: 0 };
    recRef.current = r;
    setSeconds(0);
    // Micrófono solo mientras se graba
    let mic = null;
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { mic = null; }
    if (r.cancelled || !streamRef.current) { stopStream(mic); recRef.current = null; setSeconds(null); return; }
    const stream = new MediaStream([...streamRef.current.getVideoTracks(), ...(mic?.getAudioTracks() ?? [])]);
    const recorder = new MediaRecorder(stream, { mimeType: type });
    r.recorder = recorder;
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      clearInterval(r.timer);
      stopStream(mic);
      if (recRef.current === r) recRef.current = null;
      setSeconds(null);
      if (r.cancelled || !chunks.length) return;
      const mime = type.split(';')[0];
      onCapture(new File([new Blob(chunks, { type: mime })], `micra-${Date.now()}.${mime === 'video/mp4' ? 'mp4' : 'webm'}`, { type: mime }));
    };
    const started = Date.now();
    r.timer = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) recorder.stop();
    }, 1000);
    recorder.start(1000);
    // Soltaron antes de que arrancara (mantener presionado muy corto)
    if (r.stopAsked) recorder.stop();
  };
  const stopVideo = () => {
    const r = recRef.current;
    if (!r) return;
    if (r.recorder?.state === 'recording') r.recorder.stop();
    else r.stopAsked = true;
  };

  const ready = kind !== 'recipe' || !!variety;
  const shutter = () => {
    if (!ready || busy) return;
    if (plain) { onCapture(null); return; }
    // Sin cámara en vivo, el disparador abre la del celular (foto o video)
    if (status === 'denied' || status === 'error') { nativeRef.current?.click(); return; }
    if (status !== 'live') return;
    if (mode === 'photo') takePhoto();
    else if (recording) stopVideo();
    else startVideo();
  };
  const holdStart = mode === 'photo' && status === 'live' && ready ? () => startVideo() : undefined;

  // Teclado (escritorio): espacio/enter = disparador, ←/→ = filtro, V = venta, F = formato
  const keyRef = useRef(null);
  keyRef.current = { shutter, stepFilter, onOpenSale, onOpenFormat };
  useEffect(() => {
    if (paused) return undefined;
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const onButton = e.target?.closest?.('button');
      const k = keyRef.current;
      if ((e.key === ' ' || e.key === 'Enter') && !onButton) { e.preventDefault(); k.shutter(); }
      else if (e.key === 'ArrowLeft' && !recRef.current) { e.preventDefault(); k.stepFilter(-1); }
      else if (e.key === 'ArrowRight' && !recRef.current) { e.preventDefault(); k.stepFilter(1); }
      else if (e.key.toLowerCase() === 'v' && !recRef.current) k.onOpenSale();
      else if (e.key.toLowerCase() === 'f' && !recRef.current) k.onOpenFormat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused]);

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onCapture(file);
  };

  const { w, h } = FORMATS[format];
  const shutterClass = `${mode === 'video' ? 'is-video' : ''} ${recording ? 'is-rec' : ''} ${plain ? 'is-plain' : ''}`;
  const kindText = kind === 'recipe' ? '' : texts?.[kind] || '';
  const shownNote = note || localNote;

  return (
    <div className="mcam" aria-label="Cámara Micra">
      <div className="mc-stage">
        <div className="mc-frame" style={{ '--mc-ar': w / h }}>
          {plain || status === 'denied' || status === 'error'
            ? <div className="mc-bg" aria-hidden="true" />
            : <video ref={videoRef} className="mc-video" playsInline muted />}
          <canvas ref={cardRef} className={`mc-card ${plain ? 'is-plain' : ''}`} aria-hidden="true" />
          {status === 'starting' && !plain && <p className="mc-status">Abriendo la cámara…</p>}
          {recording && <span className="mc-rec">● REC {clock(seconds)} / {clock(MAX_SECONDS)}</span>}
          {(status === 'denied' || status === 'error') && !plain && (
            <div className="mc-perm" role="alert">
              <p>{status === 'denied'
                ? 'La cámara está bloqueada para este sitio. Actívala en los ajustes del navegador (el candado junto a la dirección) y toca Reintentar.'
                : 'No se pudo abrir la cámara (¿otra app la está usando?).'}</p>
              <div className="mc-perm-actions">
                <button type="button" className="mc-pill mc-pill-on" onClick={() => setRestart((n) => n + 1)}>Reintentar</button>
                {status === 'denied' && coarse() && <button type="button" className="mc-pill" onClick={() => nativeRef.current?.click()}>Usar la cámara del celular</button>}
                <button type="button" className="mc-pill" onClick={() => onMode('plain')}>Plano</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <header className="mc-top">
        <button type="button" className="mc-round" onClick={onExit} disabled={recording} aria-label="Cerrar la cámara"><IconClose /></button>
        <div className="mc-top-mid">
          <button type="button" className="mc-pill" onClick={onOpenFormat} disabled={recording} aria-label={`Formato: ${FORMATS[format].label}. Cambiar`}>
            <i className="mc-ratio" style={{ '--r': w / h }} aria-hidden="true" />{FORMATS[format].short}
          </button>
          <div className="mc-seg" role="group" aria-label="Fondo de la tarjeta">
            {[['plain', 'Plano'], ['photo', 'Foto'], ['video', 'Video']].map(([id, label]) => (
              <button key={id} type="button" className={mode === id ? 'on' : ''} aria-pressed={mode === id} disabled={recording} onClick={() => { setLocalNote(null); onMode(id); }}>{label}</button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={`mc-round ${plain || status !== 'live' ? 'is-hidden' : ''}`}
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          disabled={recording || plain || status !== 'live'}
          aria-label="Cambiar de cámara"
        ><IconFlip /></button>
      </header>

      <div className="mc-under">
        {shownNote && <p className="mc-note">{shownNote}</p>}

        {kind !== 'recipe' && preset && (
          <button type="button" className="mc-text" onClick={() => onEditText(kind)} disabled={recording}>
            <b aria-hidden="true">Aa</b>
            <span>{kindText ? `${preset.textLabel}: ${kindText}` : `${preset.textLabel}: escribe aquí`}</span>
          </button>
        )}

        <p className="mc-filter-name" aria-live="polite">
          {selectedName || (kind === 'recipe' ? (varieties === null ? 'Cargando variedades…' : 'Sin variedades activas') : '')}
          {selectedName && filterExtra && <span> · {filterExtra}</span>}
        </p>

        <FilterCarousel
          filters={filters}
          selectedId={selectedId}
          onSelect={selectFilter}
          onShutter={shutter}
          onHoldStart={holdStart}
          onHoldEnd={stopVideo}
          shutterClass={shutterClass}
          shutterLabel={plain ? 'Usar' : null}
          disabled={recording}
          locked={recording}
        />

        <div className="mc-modes-row">
          <button type="button" className="mc-round mc-gallery" onClick={() => galleryRef.current?.click()} disabled={recording} aria-label="Elegir de la galería"><IconGallery /></button>
          <div className="mc-kinds" role="tablist" aria-label="Sección">
            {CARD_KINDS.map((k) => (
              <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'on' : ''} disabled={recording} onClick={() => onKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
          <button type="button" className="mst-ticket" onClick={onOpenSale} disabled={recording} aria-label="Venta">
            {ticketLabel}
          </button>
        </div>
      </div>

      {/* Con "capture" el celular abre su cámara (foto o video); sin él, la galería */}
      <input ref={nativeRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" hidden onChange={pick} />
    </div>
  );
}

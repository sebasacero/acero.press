import { useEffect, useRef, useState } from 'react';
import { drawEspresaleCard, FORMATS, pickVideoType } from '../espresaleCard.js';

// Cámara de Micra en dos pasos:
//  1. Opciones: fondo fijo difuminado (sin cámara encendida) con la variedad,
//     el formato y una vista previa de la tarjeta.
//  2. Cámara en vivo con la tarjeta encima como filtro.
//
// Pensada para gastar poco: el video lo pinta el navegador (hardware, sin
// filtros CSS), la tarjeta se dibuja UNA vez por opción, la foto se toma una
// sola vez (a resolución del sensor si se puede) y el video se graba directo
// de la cámara con el codificador del teléfono. Micra monta la tarjeta sobre
// lo que se tomó. La cámara se apaga al cerrar, al tomar y si la app se va
// a segundo plano. Si no hay acceso, queda la cámara del celular.

const MAX_SECONDS = 60;
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const stopStream = (s) => s?.getTracks().forEach((t) => t.stop());

function LiveCamera({ variety, format, weather, onFile, onBack, onNative }) {
  const videoRef = useRef(null);
  const cardRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [status, setStatus] = useState('starting'); // starting | live | error
  const [mode, setMode] = useState('photo');
  const [seconds, setSeconds] = useState(null); // grabando
  const [busy, setBusy] = useState(false);

  // Cámara: solo video y a 30 cuadros como máximo (el micrófono se pide al grabar)
  useEffect(() => {
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
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    const off = () => {
      const r = recRef.current;
      if (r) { r.cancelled = true; if (r.recorder.state === 'recording') r.recorder.stop(); }
      stopStream(streamRef.current);
      streamRef.current = null;
    };
    const onHide = () => { if (document.hidden) { off(); onBackRef.current(); } };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); off(); };
  }, []);

  // El filtro: la tarjeta se dibuja una vez (transparente sobre el video)
  useEffect(() => {
    if (cardRef.current) drawEspresaleCard(cardRef.current, { variety, weather, date: new Date(), format, videoOverlay: true });
  }, [variety, format, weather]);

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
    if (!type) { onNative(); return; }
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
  const shutter = () => {
    if (status !== 'live' || busy) return;
    if (mode === 'photo') takePhoto();
    else if (recording) recRef.current?.recorder.stop();
    else startVideo();
  };

  const { w, h } = FORMATS[format];

  if (status === 'error') {
    return (
      <div className="mc-live mc-live-error">
        <p>No se pudo abrir la cámara aquí (permiso o navegador).</p>
        <div className="mc-row">
          <button type="button" className="mc-btn mc-go" onClick={onNative}>📷 Cámara del celular</button>
          <button type="button" className="mc-btn mc-btn-ghost" onClick={onBack}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mc-live">
      <div className="mc-stage">
        <div className="mc-frame" style={{ '--mc-ar': w / h }}>
          <video ref={videoRef} className="mc-video" playsInline muted />
          <canvas ref={cardRef} className="mc-card" aria-hidden="true" />
          {status === 'starting' && <p className="mc-status">Abriendo la cámara…</p>}
          {recording && <span className="mc-rec">● REC {clock(seconds)} / {clock(MAX_SECONDS)}</span>}
        </div>
      </div>
      <footer className="mc-bottom">
        <button type="button" className="mc-pill" onClick={onBack} disabled={recording}>‹ Filtro · {variety.name}</button>
        <button
          type="button"
          className={`mc-shutter ${mode === 'video' ? 'is-video' : ''} ${recording ? 'is-rec' : ''}`}
          onClick={shutter}
          disabled={status !== 'live' || busy}
          aria-label={mode === 'photo' ? 'Tomar foto' : recording ? 'Detener video' : 'Grabar video'}
        />
        <div className="mc-side">
          <div className="mc-modes" role="group" aria-label="Foto o video">
            {[['photo', 'Foto'], ['video', 'Video']].map(([id, label]) => (
              <button key={id} type="button" className={mode === id ? 'on' : ''} aria-pressed={mode === id} disabled={recording} onClick={() => setMode(id)}>{label}</button>
            ))}
          </div>
          <button type="button" className="mc-icon" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} disabled={recording} aria-label="Cambiar de cámara">⟲</button>
        </div>
      </footer>
    </div>
  );
}

export default function MicraCamera({ varieties, variety, format, weather, onVariety, onFormat, onFile, onClose }) {
  const previewRef = useRef(null);
  const nativeRef = useRef(null);
  const galleryRef = useRef(null);
  const [live, setLive] = useState(false);
  const canLive = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // Vista previa del filtro: se dibuja solo cuando cambia una opción
  useEffect(() => {
    if (!live && variety && previewRef.current) drawEspresaleCard(previewRef.current, { variety, weather, date: new Date(), format });
  }, [variety, format, weather, live]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  };
  const openNative = () => nativeRef.current?.click();

  const { w, h } = FORMATS[format];

  return (
    <div className="mcam" role="dialog" aria-modal="true" aria-label="Cámara Micra">
      {!live && <div className="mc-bg" aria-hidden="true" />}

      <header className="mc-top">
        <button type="button" className="mc-icon" onClick={onClose} aria-label="Cerrar">×</button>
        <b className="mc-logo">micra<i>.</i></b>
        <span className="mc-icon mc-icon-ghost" aria-hidden="true" />
      </header>

      {live ? (
        <LiveCamera variety={variety} format={format} weather={weather} onFile={onFile} onBack={() => setLive(false)} onNative={openNative} />
      ) : (
        <div className="mc-body">
          <div className="mc-preview" style={{ '--mc-ar': w / h }}>
            {variety
              ? <canvas ref={previewRef} aria-label={`Vista previa de la tarjeta de ${variety.name}`} />
              : <p>Elige una variedad para ver la tarjeta.</p>}
          </div>

          <div className="mc-sheet" aria-label="Opciones de la tarjeta">
            <p className="mc-sheet-fig">FIG. 00 — CONFIGURA EL FILTRO</p>
            <div className="mc-field">
              <span>Variedad</span>
              <div className="mc-chips">
                {(varieties ?? []).map((v) => (
                  <button key={v.id} type="button" className={`mc-chip ${variety?.id === v.id ? 'on' : ''}`} aria-pressed={variety?.id === v.id} onClick={() => onVariety(v)}>
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mc-field">
              <span>Formato</span>
              <div className="mc-chips">
                {Object.entries(FORMATS).map(([id, f]) => (
                  <button key={id} type="button" className={`mc-chip ${format === id ? 'on' : ''}`} aria-pressed={format === id} onClick={() => onFormat(id)}>
                    {f.label}<small>{f.apps}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="mc-row">
              <button type="button" className="mc-btn mc-go" disabled={!variety} onClick={() => (canLive ? setLive(true) : openNative())}>
                📷 {variety ? 'Cámara con filtro' : 'Elige una variedad'}
              </button>
              <button type="button" className="mc-btn mc-btn-ghost" disabled={!variety} onClick={() => galleryRef.current?.click()}>
                Galería
              </button>
            </div>
            <button type="button" className="mc-link" disabled={!variety} onClick={openNative}>
              o usa la cámara del celular (sin filtro en pantalla)
            </button>
          </div>
        </div>
      )}
      {/* Con "capture" el celular abre su cámara (foto o video); sin él, la galería */}
      <input ref={nativeRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" hidden onChange={pick} />
    </div>
  );
}

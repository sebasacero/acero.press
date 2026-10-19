import { useEffect, useRef, useState } from 'react';
import { drawEspresaleCard, FORMATS, composeVideoFrame, pickVideoType } from '../espresaleCard.js';

// Cámara de Micra: se abre al tocar el logo. La cámara arranca de una, pero
// difuminada mientras se eligen las opciones de la tarjeta (variedad,
// formato, foto o video); cada toque cambia el "filtro" encima de la imagen
// en vivo. Al tocar "Listo" la imagen se aclara y se dispara: lo que se ve en
// el visor es lo que sale (foto JPG o video con la tarjeta ya montada).

const MAX_SECONDS = 60;
const MODES = [
  { id: 'photo', label: 'Foto' },
  { id: 'video', label: 'Video' },
];
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function MicraCamera({ varieties, initialVariety, initialFormat = 'feed', weather, onClose, onShot, onFallback }) {
  const videoRef = useRef(null);
  const cardRef = useRef(null); // la tarjeta a tamaño real, encima del visor
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [status, setStatus] = useState('starting'); // starting | live | error
  const [error, setError] = useState('');
  const [variety, setVariety] = useState(initialVariety ?? null);
  const [format, setFormat] = useState(initialFormat);
  const [mode, setMode] = useState('photo');
  const [configuring, setConfiguring] = useState(true);
  const [elapsed, setElapsed] = useState(null); // segundos mientras graba
  const [busy, setBusy] = useState(false);
  const [glass, setGlass] = useState([]); // zonas de vidrio de la tarjeta, en % del visor

  // Cámara (y micrófono para los videos, si lo dan)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('starting');
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setError('Este navegador no da acceso a la cámara.');
        return;
      }
      const video = { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        } catch (err) {
          if (cancelled) return;
          setStatus('error');
          setError(err?.name === 'NotAllowedError'
            ? 'No hay permiso para la cámara. Actívalo en el navegador y vuelve a tocar el logo.'
            : 'No se pudo abrir la cámara.');
          return;
        }
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream;
      v.muted = true;
      await v.play().catch(() => {});
      setStatus('live');
    })();
    return () => { cancelled = true; };
  }, [facing]);

  // Al cerrar: se apaga la cámara y cualquier grabación
  useEffect(() => () => {
    const r = recRef.current;
    if (r) { r.cancelled = true; cancelAnimationFrame(r.raf); if (r.recorder.state === 'recording') r.recorder.stop(); }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // El "filtro": la tarjeta de la variedad elegida, transparente sobre la imagen
  useEffect(() => {
    const canvas = cardRef.current;
    if (!canvas) return;
    if (!variety) {
      const { w, h } = FORMATS[format];
      canvas.width = w;
      canvas.height = h;
      canvas.__glass = [];
      canvas.getContext('2d').clearRect(0, 0, w, h);
      setGlass([]);
      return;
    }
    drawEspresaleCard(canvas, { variety, weather, date: new Date(), format, videoOverlay: true }).then(() => {
      setGlass((canvas.__glass ?? []).map((g) => ({
        left: `${(g.x / canvas.width) * 100}%`,
        top: `${(g.y / canvas.height) * 100}%`,
        width: `${(g.w / canvas.width) * 100}%`,
        height: `${(g.h / canvas.height) * 100}%`,
        borderRadius: `${(g.r / g.w) * 100}% / ${(g.r / g.h) * 100}%`,
      })));
    });
  }, [variety, format, weather]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const finish = (shot) => onShot({ ...shot, url: URL.createObjectURL(shot.blob), varietyId: variety.id, variety, format });

  const snap = async () => {
    const { w, h } = FORMATS[format];
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    composeVideoFrame(c.getContext('2d'), videoRef.current, cardRef.current);
    setBusy(true);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.92));
    setBusy(false);
    finish({ blob, type: 'image/jpeg', ext: 'jpg', isVideo: false, igReady: true });
  };

  // Video: se graba lo que se ve (cámara + tarjeta) con el audio del micrófono
  const startRecording = () => {
    const type = pickVideoType();
    if (!type || !HTMLCanvasElement.prototype.captureStream) {
      setError('Este navegador no puede grabar video. Prueba en Chrome o Safari actualizados.');
      return;
    }
    const { w, h } = FORMATS[format];
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const out = c.captureStream(30);
    streamRef.current?.getAudioTracks().forEach((t) => out.addTrack(t));
    const recorder = new MediaRecorder(out, { mimeType: type, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    const started = performance.now();
    const r = { recorder, raf: 0, cancelled: false };
    recRef.current = r;
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      cancelAnimationFrame(r.raf);
      out.getVideoTracks().forEach((t) => t.stop());
      recRef.current = null;
      setElapsed(null);
      if (r.cancelled || !chunks.length) return;
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      finish({ blob, type: type.split(';')[0], ext: type.startsWith('video/mp4') ? 'mp4' : 'webm', isVideo: true, igReady: type.includes('avc1') });
    };
    const draw = () => {
      composeVideoFrame(ctx, videoRef.current, cardRef.current);
      const s = (performance.now() - started) / 1000;
      setElapsed(Math.floor(s));
      if (s >= MAX_SECONDS) { recorder.stop(); return; }
      r.raf = requestAnimationFrame(draw);
    };
    composeVideoFrame(ctx, videoRef.current, cardRef.current);
    recorder.start(250);
    setElapsed(0);
    draw();
  };

  const stopRecording = () => recRef.current?.recorder.stop();
  const recording = elapsed !== null;
  const shutter = () => {
    if (!variety || status !== 'live' || busy) return;
    if (mode === 'photo') snap();
    else if (recording) stopRecording();
    else startRecording();
  };

  // Difuminado: fuerte al abrir, baja al elegir la variedad y desaparece con "Listo"
  const blur = configuring ? (variety ? 9 : 18) : 0;
  const { w, h } = FORMATS[format];

  return (
    <div className="mcam" role="dialog" aria-modal="true" aria-label="Cámara Micra">
      <div className="mc-stage">
        <div className="mc-frame" style={{ '--mc-ar': w / h }}>
          <video ref={videoRef} className="mc-video" playsInline muted style={{ filter: `blur(${blur}px) brightness(${configuring ? 0.72 : 1})` }} />
          {glass.map((st, i) => <span key={i} className="mc-frost" style={st} aria-hidden="true" />)}
          <canvas ref={cardRef} className="mc-card" aria-hidden="true" />
          {status === 'starting' && <p className="mc-status">Abriendo la cámara…</p>}
          {recording && <span className="mc-rec">● REC {clock(elapsed)} / {clock(MAX_SECONDS)}</span>}
        </div>
      </div>

      <header className="mc-top">
        <button type="button" className="mc-icon" onClick={onClose} aria-label="Cerrar cámara">×</button>
        <b className="mc-logo">micra<i>.</i></b>
        <button
          type="button"
          className="mc-icon"
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          disabled={recording}
          aria-label="Cambiar de cámara"
        >⟲</button>
      </header>

      {status === 'error' ? (
        <div className="mc-sheet">
          <p className="mc-error">{error}</p>
          <div className="mc-row">
            <button type="button" className="mc-btn" onClick={() => { onFallback(); onClose(); }}>Usar la cámara del celular</button>
            <button type="button" className="mc-btn mc-btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      ) : configuring ? (
        <div className="mc-sheet" aria-label="Configura el filtro">
          <p className="mc-sheet-fig">FIG. 00 — CONFIGURA EL FILTRO</p>
          <div className="mc-field">
            <span>Variedad</span>
            <div className="mc-chips">
              {(varieties ?? []).map((v) => (
                <button key={v.id} type="button" className={`mc-chip ${variety?.id === v.id ? 'on' : ''}`} aria-pressed={variety?.id === v.id} onClick={() => setVariety(v)}>
                  {v.name}
                </button>
              ))}
            </div>
          </div>
          <div className="mc-field">
            <span>Formato</span>
            <div className="mc-chips">
              {Object.entries(FORMATS).map(([id, f]) => (
                <button key={id} type="button" className={`mc-chip ${format === id ? 'on' : ''}`} aria-pressed={format === id} onClick={() => setFormat(id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mc-field">
            <span>Captura</span>
            <div className="mc-chips">
              {MODES.map((m) => (
                <button key={m.id} type="button" className={`mc-chip ${mode === m.id ? 'on' : ''}`} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="mc-btn mc-go" disabled={!variety} onClick={() => setConfiguring(false)}>
            {variety ? 'Listo · a la cámara' : 'Elige una variedad'}
          </button>
        </div>
      ) : (
        <footer className="mc-bottom">
          <button type="button" className="mc-pill" onClick={() => setConfiguring(true)} disabled={recording}>
            Filtro · {variety?.name}
          </button>
          <button
            type="button"
            className={`mc-shutter ${mode === 'video' ? 'is-video' : ''} ${recording ? 'is-rec' : ''}`}
            onClick={shutter}
            disabled={status !== 'live' || busy}
            aria-label={mode === 'photo' ? 'Tomar foto' : recording ? 'Detener video' : 'Grabar video'}
          />
          <div className="mc-modes" role="group" aria-label="Foto o video">
            {MODES.map((m) => (
              <button key={m.id} type="button" className={mode === m.id ? 'on' : ''} aria-pressed={mode === m.id} disabled={recording} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </footer>
      )}
      {error && status !== 'error' && <p className="mc-toast">{error}</p>}
    </div>
  );
}

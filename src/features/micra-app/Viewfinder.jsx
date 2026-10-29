import { useEffect, useRef, useState } from 'react';

// El visor de la ficha rápida: la cámara trasera a pantalla completa, sin
// filtro, un disparador grande y cambiar de cámara. Si la cámara no abre (sin
// permiso, navegador viejo), el botón pasa a la cámara del sistema.

const MAX_SIDE = 1600; // la foto del puesto no necesita más

async function frameToBlob(video) {
  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No salió la foto.'))), 'image/jpeg', 0.9));
}

export default function Viewfinder({ onShot, children }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [status, setStatus] = useState('starting'); // starting | live | off
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setStatus('starting');
    const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('off'); return undefined; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((stream) => {
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
        setStatus('live');
      })
      .catch(() => { if (alive) setStatus('off'); });
    return () => { alive = false; stop(); };
  }, [facing]);

  const shoot = async () => {
    if (status !== 'live' || busy) return;
    setBusy(true);
    try {
      const blob = await frameToBlob(videoRef.current);
      onShot({ file: new File([blob], 'puesto.jpg', { type: 'image/jpeg' }), url: URL.createObjectURL(blob) });
    } finally { setBusy(false); }
  };
  const picked = (file) => { if (file) onShot({ file, url: URL.createObjectURL(file) }); };

  return (
    <div className="mvf" data-status={status}>
      <video ref={videoRef} className="mvf-video" playsInline muted autoPlay />
      {status === 'off' && <p className="mvf-off">La cámara no abrió aquí. Toma la foto con la cámara del celular.</p>}
      {children}
      <div className="mvf-bar">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { picked(e.target.files?.[0]); e.target.value = ''; }} data-testid="ficha-file" />
        <button type="button" className="mvf-side" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} aria-label="Cambiar de cámara" disabled={status !== 'live'}>⟲</button>
        {status === 'off'
          ? <button type="button" className="mvf-shutter is-system" onClick={() => fileRef.current?.click()} aria-label="Tomar foto con la cámara del celular">📷</button>
          : <button type="button" className="mvf-shutter" onClick={shoot} disabled={status !== 'live' || busy} aria-label="Tomar la foto" data-testid="ficha-shutter"><span /></button>}
        <button type="button" className="mvf-side" onClick={() => fileRef.current?.click()} aria-label="Elegir de la galería">▤</button>
      </div>
    </div>
  );
}

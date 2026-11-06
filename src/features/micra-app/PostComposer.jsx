import { useEffect, useRef, useState } from 'react';
import * as api from './api.js';
import { postKind, mediaError, postPath, cleanCaption, MAX_CAPTION } from './posts.js';
import Juez from './Juez.jsx';
import platform from './platform.js';

// «Publicar en Micra»: el barista escoge una foto o un video (galería o cámara
// del celular), le pone su texto y lo manda a revisión. La foto se achica en el
// celular (1600 px, JPEG) para que suba rápido con mala señal; el video va tal
// cual hasta 25 MB. Sale en Hoy cuando el equipo la aprueba.

/** La foto a lo más de 1600 px de lado, en JPEG (también para la imagen de un anuncio). */
export async function shrinkPhoto(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k) });
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => { c.toBlob(r, 'image/jpeg', 0.85); });
    return blob ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * `challenge`: la entrada al reto de la semana (solo foto; una por barista).
 * `sale`: la foto de la venta, desde la cámara de la barra del barista: abre la cámara de una
 * y guarda dónde se vendió (el GPS del celular, que la base redondea a la cuadra) para el mapa
 * de Estudio. Sin GPS se publica igual, sin el lugar.
 */
export default function PostComposer({ selfId, asId = null, onClose, onSent, challenge = null, sale = false }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  // El juez de arte latte: su puntaje va con la entrada (solo en los retos de arte latte)
  const [judge, setJudge] = useState(null);
  const judging = challenge?.kind === 'arte_latte';
  const input = useRef(null);
  const kind = postKind(file);
  // El GPS se pide al abrir, mientras toma la foto: al enviar ya está (o no hay y no espera)
  const [place, setPlace] = useState(sale ? 'buscando' : null);
  useEffect(() => {
    if (!sale) return undefined;
    let on = true;
    platform.position(10000, true).then((p) => { if (on) setPlace(p ?? 'sin'); });
    // La cámara de una: el barista tocó la cámara de la barra
    input.current?.click();
    return () => { on = false; };
  }, [sale]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose, busy]);

  const pick = (e) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!f) return;
    const err = mediaError(f) ?? (challenge && postKind(f) === 'video' ? 'Al reto se entra con una foto.' : null);
    setError(err);
    if (err) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = kind === 'foto' ? await shrinkPhoto(file) : file;
      const type = kind === 'foto' ? (blob.type || 'image/jpeg') : file.type;
      const path = postPath(selfId, type);
      if (!path) throw new Error('Ese tipo de archivo no se puede subir.');
      const post = await api.publishPost({ path, blob, type, kind, caption: cleanCaption(caption), asId, challengeId: challenge?.id ?? null, judge: judging ? judge : null });
      // El lugar va aparte: si falla (sin la migración, fuera de Bogotá) la foto ya quedó enviada
      if (sale && post?.id && place?.lat) await api.postPlace(post.id, place.lat, place.lng, asId).catch(() => null);
      setSent(true);
      onSent?.();
    } catch (e) {
      setError(e.missing ? 'Publicar en Micra abre muy pronto.' : e.message);
    }
    setBusy(false);
  };

  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label={challenge ? 'Tu entrada al reto' : sale ? 'Foto de la venta' : 'Publicar en Micra'} data-testid="post-composer">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" tabIndex={-1} onClick={() => !busy && onClose()} />
      <section className="mapp-sheet is-scroll">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <header className="mapp-sheet-head">
          <h2 className="mapp-title is-small">{challenge ? 'Tu entrada al reto' : sale ? 'Foto de la venta' : 'Publicar en Micra'}</h2>
          <button type="button" className="mapp-link" onClick={onClose} disabled={busy}>{sent ? 'Listo' : 'Cancelar'}</button>
        </header>
        {sent ? (
          <div className="mapp-compose-done" role="status" data-testid="post-sent">
            <span aria-hidden="true">✨</span>
            <p><b>¡Enviada!</b> {challenge ? 'El equipo la revisa y entra al reto, donde todos la califican.' : 'El equipo la revisa y sale en Hoy, donde la ven tus clientes y los otros baristas.'}</p>
          </div>
        ) : (
          <>
            {challenge && <p className="mapp-cota">🏆 {challenge.title}</p>}
            <input ref={input} type="file" accept={challenge || sale ? 'image/*' : 'image/*,video/*'} capture={sale ? 'environment' : undefined} onChange={pick} hidden data-testid="post-file" />
            {preview ? (
              <div className="mapp-compose-media">
                {kind === 'video'
                  ? <video src={preview} controls playsInline muted />
                  : <img src={preview} alt="Tu foto" />}
                <button type="button" className="mapp-link" onClick={() => input.current?.click()} disabled={busy}>Cambiar</button>
              </div>
            ) : (
              null
            )}
            {preview && judging && kind === 'foto' && <Juez file={file} onResult={setJudge} />}
            {!preview && (
              <button type="button" className="mapp-compose-pick" onClick={() => input.current?.click()}>
                <span aria-hidden="true">📸</span>
                <b>{challenge ? 'Escoger la foto' : sale ? 'Tomar la foto' : 'Escoger foto o video'}</b>
                <small>{challenge ? 'De tu galería o con la cámara · solo una entrada' : sale ? 'Tu cliente con su vasito' : 'De tu galería o con la cámara · video hasta 25 MB'}</small>
              </button>
            )}
            <label className="mapp-field">
              <span>Tu texto ({MAX_CAPTION - caption.length})</span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))} rows={3} placeholder={sale ? 'Ej.: El tinto de Don Jorge en la 57 ☕' : 'Ej.: El primer tinto del día en la 85 ☕'} />
            </label>
            {sale && (
              <p className="mapp-fine" data-testid="sale-place">
                {place === 'buscando' ? '📍 Buscando dónde estás…' : place?.lat ? '📍 Guardamos la cuadra donde vendiste, para el mapa del estudio.' : '📍 Sin GPS: se envía sin el lugar.'}
              </p>
            )}
            <label className="mapp-check">
              <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} data-testid="post-consent" />
              <span>{sale ? 'Mi cliente me dio permiso de tomarle la foto y publicarla.' : 'No sale nadie más, o quien sale me dio permiso.'}</span>
            </label>
            {error && <p className="mapp-error" role="alert">{error}</p>}
            <button type="button" className="mapp-btn is-cta" onClick={send} disabled={!file || !ok || busy} data-testid="post-send">{busy ? 'Subiendo…' : 'Enviar a revisión'}</button>
            <p className="mapp-fine">El equipo la revisa antes de que salga en Hoy. Sale con tu nombre de pila y tu punto; puedes quitarla cuando quieras.</p>
          </>
        )}
      </section>
    </div>
  );
}

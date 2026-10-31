import { useEffect, useRef, useState } from 'react';
import * as api from './api.js';
import { postKind, mediaError, postPath, cleanCaption, MAX_CAPTION } from './posts.js';

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

export default function PostComposer({ selfId, asId = null, onClose, onSent }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const input = useRef(null);
  const kind = postKind(file);

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
    const err = mediaError(f);
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
      await api.publishPost({ path, blob, type, kind, caption: cleanCaption(caption), asId });
      setSent(true);
      onSent?.();
    } catch (e) {
      setError(e.missing ? 'Publicar en Micra abre muy pronto.' : e.message);
    }
    setBusy(false);
  };

  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Publicar en Micra" data-testid="post-composer">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" tabIndex={-1} onClick={() => !busy && onClose()} />
      <section className="mapp-sheet is-scroll">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <header className="mapp-sheet-head">
          <h2 className="mapp-title is-small">Publicar en Micra</h2>
          <button type="button" className="mapp-link" onClick={onClose} disabled={busy}>{sent ? 'Listo' : 'Cancelar'}</button>
        </header>
        {sent ? (
          <div className="mapp-compose-done" role="status" data-testid="post-sent">
            <span aria-hidden="true">✨</span>
            <p><b>¡Enviada!</b> El equipo la revisa y sale en Hoy, donde la ven tus clientes y los otros baristas.</p>
          </div>
        ) : (
          <>
            <input ref={input} type="file" accept="image/*,video/*" onChange={pick} hidden data-testid="post-file" />
            {preview ? (
              <div className="mapp-compose-media">
                {kind === 'video'
                  ? <video src={preview} controls playsInline muted />
                  : <img src={preview} alt="Tu foto" />}
                <button type="button" className="mapp-link" onClick={() => input.current?.click()} disabled={busy}>Cambiar</button>
              </div>
            ) : (
              <button type="button" className="mapp-compose-pick" onClick={() => input.current?.click()}>
                <span aria-hidden="true">📸</span>
                <b>Escoger foto o video</b>
                <small>De tu galería o con la cámara · video hasta 25 MB</small>
              </button>
            )}
            <label className="mapp-field">
              <span>Tu texto ({MAX_CAPTION - caption.length})</span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))} rows={3} placeholder="Ej.: El primer tinto del día en la 85 ☕" />
            </label>
            <label className="mapp-check">
              <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} data-testid="post-consent" />
              <span>No sale nadie más, o quien sale me dio permiso.</span>
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

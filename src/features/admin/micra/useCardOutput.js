import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { publishToInstagram } from '../../../shared/lib/instagram.js';
import { FORMATS, igKind, recordCardVideo } from '../espresaleCard.js';
import { captionFor, PUBLISH_DONE, slug, waDigits } from './captions.js';

// Lo que sale de Micra: descargar, compartir (menú del celular), WhatsApp,
// guardar en Publicaciones y publicar en Instagram. Es la lógica de la consola
// anterior, ahora sin pantalla propia.
//
// Con fondo de video, el video final se graba solo cuando se pide (una vez
// por diseño: cambiar la tarjeta lo invalida), se puede cancelar y mantiene
// la pantalla encendida mientras graba.

export const canShareFiles = () => {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare
      && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
};

export function useCardOutput({ getCanvas, videoMode, captureUrl, trimStart = 0, format, caption, hashtags, name, altText, cardKey }) {
  const [cardVideo, setCardVideo] = useState(null); // { blob, url, ext, type, igReady }
  const [progress, setProgress] = useState(null); // 0..1 mientras graba
  const [savedUrl, setSavedUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef(null);
  const inflight = useRef(null);
  const videoRef = useRef(null);
  videoRef.current = cardVideo;

  // Cambió la tarjeta: el video grabado y lo guardado ya no valen
  useEffect(() => {
    abortRef.current?.abort();
    inflight.current = null;
    videoRef.current = null;
    setCardVideo(null);
    setSavedUrl(null);
  }, [cardKey]);
  useEffect(() => () => { if (cardVideo?.url) URL.revokeObjectURL(cardVideo.url); }, [cardVideo]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const fileName = (ext) => `micra-${slug(name)}.${ext}`;

  // Una sola grabación a la vez: quien la pida mientras corre recibe la misma
  const ensureCardVideo = useCallback(() => {
    if (videoRef.current) return Promise.resolve(videoRef.current);
    if (inflight.current) return inflight.current;
    const run = (async () => {
      const overlay = getCanvas();
      if (!overlay || !captureUrl) throw new Error('No hay video de fondo.');
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setProgress(0);
      // Copias propias del video y de la capa: el editor sigue igual mientras graba
      const recVideo = document.createElement('video');
      recVideo.src = captureUrl;
      recVideo.playsInline = true;
      recVideo.setAttribute('playsinline', '');
      recVideo.preload = 'auto';
      const snap = document.createElement('canvas');
      snap.width = overlay.width;
      snap.height = overlay.height;
      snap.getContext('2d').drawImage(overlay, 0, 0);
      snap.__glass = overlay.__glass;
      let lock = null;
      try {
        lock = await navigator.wakeLock?.request('screen').catch(() => null);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('El video no cargó. Intenta de nuevo.')), 20000);
          const done = (fn) => (arg) => { clearTimeout(timer); fn(arg); };
          recVideo.addEventListener('loadeddata', done(resolve), { once: true });
          recVideo.addEventListener('error', done(() => reject(new Error('No se pudo leer el video.'))), { once: true });
          ctrl.signal.addEventListener('abort', done(() => reject(new DOMException('Cancelado', 'AbortError'))), { once: true });
          recVideo.load();
        });
        const r = await recordCardVideo({
          video: recVideo,
          overlay: snap,
          width: FORMATS[format].w,
          height: FORMATS[format].h,
          maxSeconds: 60,
          startAt: trimStart,
          signal: ctrl.signal,
          onProgress: (p) => setProgress(p),
        });
        if (ctrl.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
        const result = { ...r, url: URL.createObjectURL(r.blob) };
        // Ya, no en el próximo render: quien siga en la misma cadena (publicar) no vuelve a grabar
        videoRef.current = result;
        setCardVideo(result);
        return result;
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
        setProgress(null);
        lock?.release?.().catch(() => {});
        recVideo.pause();
        recVideo.removeAttribute('src');
        recVideo.load();
      }
    })();
    inflight.current = run;
    run.finally(() => { if (inflight.current === run) inflight.current = null; }).catch(() => {});
    return run;
  }, [getCanvas, captureUrl, format, trimStart]);

  const cancelVideo = useCallback(() => abortRef.current?.abort(), []);

  // Video si el fondo es video; imagen si no (JPEG para Instagram)
  const cardMedia = useCallback(async ({ jpeg = false } = {}) => {
    if (videoMode) {
      const v = await ensureCardVideo();
      return { blob: v.blob, ext: v.ext, type: v.type, isVideo: true, igReady: v.igReady };
    }
    const type = jpeg ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((resolve) => getCanvas().toBlob(resolve, type, 0.92));
    if (!blob) throw new Error('No se pudo exportar la tarjeta.');
    return { blob, ext: jpeg ? 'jpg' : 'png', type, isVideo: false };
  }, [videoMode, ensureCardVideo, getCanvas]);

  const download = useCallback(async () => {
    const m = await cardMedia();
    const url = URL.createObjectURL(m.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(m.ext);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardMedia, name]);

  // El menú de compartir del celular sí adjunta la tarjeta (wa.me solo lleva texto).
  // Con video, solo cuando ya está listo: grabar antes rompería el gesto del toque.
  const share = useCallback(async () => {
    let m;
    if (videoMode) {
      const v = videoRef.current;
      if (!v) throw new Error('Prepara el video primero.');
      m = { blob: v.blob, ext: v.ext, type: v.type };
    } else {
      m = await cardMedia();
    }
    const file = new File([m.blob], fileName(m.ext), { type: m.type });
    try {
      await navigator.share({ files: [file], text: captionFor('share', caption, hashtags), title: altText });
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
      throw new Error('No se pudo abrir el menú de compartir.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoMode, cardMedia, caption, hashtags, altText, name]);

  // WhatsApp se abre YA (en el mismo toque, o el navegador lo bloquea)
  const openWhatsApp = useCallback((phone) => {
    const digits = waDigits(phone);
    if (!digits) return false;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(captionFor('whatsapp', caption, false))}`, '_blank');
    return true;
  }, [caption]);

  // Sube el archivo a Storage y crea su fila en Publicaciones
  const uploadPublication = useCallback(async (blob, ext, contentType, extra = {}) => {
    const path = `esspresale/${Date.now()}-${slug(name || 'captura')}.${ext}`;
    const { error } = await supabase.storage.from('marketing').upload(path, blob, { contentType });
    if (error) throw error;
    const { data: pub } = supabase.storage.from('marketing').getPublicUrl(path);
    const text = captionFor('ig', caption, hashtags);
    const { data: row, error: insertError } = await supabase
      .from('publications')
      .insert({ video_url: pub.publicUrl, caption: text, caption_es: text, created_at: new Date().toISOString(), ...extra })
      .select('id')
      .single();
    if (insertError) throw insertError;
    return { url: pub.publicUrl, id: row.id };
  }, [name, caption, hashtags]);

  const saveToPublications = useCallback(async ({ orderId = null } = {}) => {
    setSaving(true);
    try {
      const m = await cardMedia({ jpeg: true });
      const k = igKind(format, m.isVideo);
      const saved = await uploadPublication(m.blob, m.ext, m.type, { media_kind: k === 'story_video' ? 'story' : k, ...(orderId ? { order_id: orderId } : {}) });
      setSavedUrl(saved.url);
      return saved;
    } finally {
      setSaving(false);
    }
  }, [cardMedia, format, uploadPublication]);

  /** Publica en Instagram (feed, historia o Reel según el formato). Devuelve { ok, pending, text, kind }. */
  const publishIG = useCallback(async ({ orderId = null, onStage } = {}) => {
    const m = await cardMedia({ jpeg: true });
    if (m.isVideo && !m.igReady) {
      throw new Error('Este navegador no grabó el video en H.264, el único formato que acepta Instagram. Descárgalo y súbelo desde la app, o usa Safari/Chrome actualizado.');
    }
    const kind = igKind(format, m.isVideo);
    onStage?.('upload');
    const saved = await uploadPublication(m.blob, m.ext, m.type, {
      media_kind: kind === 'story_video' ? 'story' : kind,
      ...(orderId ? { order_id: orderId } : {}),
    });
    setSavedUrl(saved.url);
    onStage?.('publish');
    const ig = await publishToInstagram({ mediaUrl: saved.url, kind, caption: captionFor('ig', caption, hashtags), publicationId: saved.id });
    if (ig.success) return { ok: true, kind, text: `${PUBLISH_DONE[kind]} en Instagram` };
    if (ig.pending) return { ok: false, pending: true, kind, text: 'Instagram sigue procesando el video: revisa en unos minutos en Publicaciones.' };
    return { ok: false, kind, text: ig.error || 'Instagram no confirmó la publicación.' };
  }, [cardMedia, format, uploadPublication, caption, hashtags]);

  return {
    cardVideo, progress, ensureCardVideo, cancelVideo,
    download, share, openWhatsApp, saveToPublications, publishIG,
    saving, savedUrl,
  };
}

import { useEffect, useRef, useState } from 'react';
import { FORMATS, igKind } from '../espresaleCard.js';
import { money, PAY_METHODS, PUBLISH_ARIA, PUBLISH_LABEL } from './captions.js';
import Sheet from './Sheet.jsx';
import { IconCamera, IconChat, IconDownload, IconGrid, IconShare } from './icons.jsx';

/**
 * «Enviar a»: pie de foto, el video (si el fondo es video) y los destinos.
 * El interruptor de registrar la venta viene apagado: solo se muestra en
 * Receta, sin una venta ya enlazada y con un ticket con precio.
 */
export default function ShareSheet({
  out, sale, kind, format, videoMode, cardRef, cardKey, caption, autoCaption, setCaption, hashtags, setHashtags,
  linkedOrderId, canShare, onPublish, onNewCard, onOpenPublications, guardLogo, onClose, docked, onRegistered,
  busy: studioBusy = false, linkedPhone = null, lite = false,
}) {
  const thumbRef = useRef(null);
  const [notice, setNotice] = useState(null); // { ok, text }
  const [done, setDone] = useState(null); // texto del éxito
  const [busy, setBusy] = useState(null); // destino en curso
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [alsoSale, setAlsoSale] = useState(false);
  const F = FORMATS[format];
  const kindIG = igKind(format, videoMode);
  const isStory = kindIG === 'story' || kindIG === 'story_video';
  const showSaleSwitch = kind === 'recipe' && !linkedOrderId && sale.priced;
  const line = sale.lines[0];
  const pay = PAY_METHODS.find((m) => m.id === sale.payMethod)?.label;

  // Miniatura de la tarjeta (una copia, una vez por diseño)
  useEffect(() => {
    const src = cardRef.current;
    const c = thumbRef.current;
    if (!src || !c || !src.width) return;
    c.width = 240;
    c.height = Math.round((240 * src.height) / src.width);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b0c0f';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, c.width, c.height);
  }, [cardRef, cardKey]);

  // La venta (si se pidió) antes del destino; devuelve el pedido a enlazar
  const withSale = async () => {
    if (!alsoSale || !showSaleSwitch) return linkedOrderId;
    const rec = await sale.register({ attach: true });
    setAlsoSale(false);
    if (rec) onRegistered?.(rec);
    return rec?.orderId ?? null;
  };

  const runJob = async (dest, fn) => {
    setBusy(dest);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      if (err?.name !== 'AbortError') setNotice({ ok: false, text: err.message || 'Algo falló.' });
    } finally {
      setBusy(null);
    }
  };

  const publish = () => guardLogo(() => runJob('ig', async () => {
    const orderId = await withSale();
    const r = await onPublish({ orderId });
    if (r.ok) setDone(r.text);
    else if (!r.aborted) setNotice({ ok: false, text: r.pending ? r.text : `No se publicó: ${r.text}` });
  }));

  const whatsapp = () => {
    // El número de este ticket o el de la venta de esta tarjeta
    const to = sale.phone.trim() || linkedPhone || '';
    if (!to) { setPhoneOpen(true); return; }
    // El chat se abre YA (en el mismo toque); la tarjeta se descarga después para adjuntarla
    if (!out.openWhatsApp(to)) {
      setPhoneOpen(true);
      setNotice({ ok: false, text: 'Escribe el WhatsApp del cliente.' });
      return;
    }
    runJob('wa', async () => {
      await withSale();
      if (!canShare) await out.download();
      setNotice({ ok: true, text: canShare ? 'Se abrió el chat. Para adjuntar la tarjeta usa «Compartir».' : 'Se abrió el chat — adjunta la tarjeta que se descargó.' });
    });
  };

  const share = () => {
    // Sin esperar la venta: el menú de compartir necesita el gesto del toque
    if (alsoSale && showSaleSwitch) withSale().catch((e) => setNotice({ ok: false, text: `No se registró la venta: ${e.message}` }));
    runJob('share', async () => { await out.share(); });
  };

  const download = () => runJob('download', async () => {
    await withSale();
    await out.download();
    setNotice({ ok: true, text: 'Tarjeta descargada.' });
  });

  const save = () => runJob('save', async () => {
    const orderId = await withSale();
    await out.saveToPublications({ orderId });
    setNotice({ ok: true, text: 'Guardada — ya aparece en Publicaciones.' });
  });

  if (done) {
    return (
      <Sheet title="Enviar a" onClose={onClose} docked={docked}>
        <div className="msheet-success" role="status">
          <p>✓ {done}</p>
          <div className="msheet-row">
            <button type="button" className="msheet-btn is-primary" onClick={onNewCard}>Nueva tarjeta</button>
            <button type="button" className="msheet-btn" onClick={onOpenPublications}>Ver en Publicaciones</button>
          </div>
        </div>
      </Sheet>
    );
  }

  const videoReady = !!out.cardVideo;
  const pct = out.progress !== null ? Math.round(out.progress * 100) : null;
  const dests = [
    // Un barista de la app (lite) comparte en sus redes, no en las de ACERO ni en Publicaciones
    !lite && { id: 'ig', label: 'Instagram', sub: PUBLISH_LABEL[kindIG], aria: PUBLISH_ARIA[kindIG], Icon: IconCamera, run: publish },
    { id: 'wa', label: 'WhatsApp', sub: 'cliente', Icon: IconChat, run: whatsapp },
    canShare && { id: 'share', label: 'Compartir', sub: 'menú del celular', Icon: IconShare, run: share, disabled: videoMode && !videoReady },
    { id: 'download', label: 'Descargar', sub: videoMode ? (out.cardVideo?.ext?.toUpperCase() || 'Video') : 'PNG', Icon: IconDownload, run: download },
    // Guardada una vez basta (otra subida sería una fila repetida)
    !lite && { id: 'save', label: 'Publicaciones', sub: out.savedUrl ? '✓ Guardada' : 'Guardar', Icon: IconGrid, run: save, on: !!out.savedUrl, disabled: !!out.savedUrl },
  ].filter(Boolean);

  return (
    <Sheet title="Enviar a" onClose={onClose} docked={docked} size="tall">
      <div className="msheet-share-head">
        <canvas ref={thumbRef} className="msheet-thumb" aria-hidden="true" />
        <div>
          <b>{F.label}</b>
          <small>{F.w}×{F.h} · {F.apps}</small>
        </div>
      </div>

      <div className="msheet-group">
        <div className="msheet-label-row">
          <label className="msheet-label" htmlFor="mst-caption">Pie de foto</label>
          <button type="button" className={`msheet-chip is-sm ${caption === null ? 'on' : ''}`} onClick={() => setCaption(null)} disabled={caption === null}>Automático</button>
          <button type="button" className={`msheet-chip is-sm ${hashtags ? 'on' : ''}`} aria-pressed={hashtags} onClick={() => setHashtags(!hashtags)}># Etiquetas</button>
        </div>
        <textarea id="mst-caption" className="msheet-input is-caption" rows={4} maxLength={2200} value={caption ?? autoCaption} onChange={(e) => setCaption(e.target.value)} />
        {isStory && <small className="msheet-fine">Las historias de Instagram no llevan pie de foto.</small>}
      </div>

      {showSaleSwitch && (
        <label className="msheet-switch is-sale">
          <input type="checkbox" checked={alsoSale} onChange={(e) => setAlsoSale(e.target.checked)} />
          <span>También registrar la venta · {line?.variety?.name} {line?.variant?.label} × {line?.qty}{sale.lines.length > 1 ? ` (+${sale.lines.length - 1})` : ''} · {money(sale.total)} · {pay}</span>
        </label>
      )}

      {videoMode && (
        <div className="msheet-group msheet-video">
          {videoReady ? (
            <>
              <video src={out.cardVideo.url} controls playsInline className="msheet-video-player" />
              <small className="msheet-fine">Video listo · {out.cardVideo.ext.toUpperCase()}</small>
              {!out.cardVideo.igReady && <p className="msheet-notice is-warn">Este navegador no grabó en H.264: para Instagram descárgalo y súbelo desde la app.</p>}
            </>
          ) : pct !== null ? (
            <div className="msheet-progress" role="status">
              <span>Preparando video {pct} % · no cierres Micra</span>
              <i style={{ '--p': `${pct}%` }} />
              <button type="button" className="msheet-btn is-ghost" onClick={out.cancelVideo}>Cancelar</button>
            </div>
          ) : (
            <button type="button" className="msheet-btn" onClick={() => runJob('video', out.ensureCardVideo)}>Preparar video</button>
          )}
        </div>
      )}

      <div className="msheet-dest-grid">
        {dests.map((d) => (
          <button key={d.id} type="button" className={`msheet-dest ${d.on ? 'on' : ''}`} onClick={d.run} disabled={!!busy || studioBusy || d.disabled || out.progress !== null} aria-label={d.aria}>
            <span className="msheet-dest-icon"><d.Icon /></span>
            <b>{busy === d.id ? '…' : d.label}</b>
            <small>{d.sub}</small>
          </button>
        ))}
      </div>

      {phoneOpen && (
        <div className="msheet-row is-phone">
          <input className="msheet-input" type="tel" inputMode="tel" placeholder="300 123 4567" aria-label="WhatsApp del cliente" value={sale.phone} onChange={(e) => sale.setPhone(e.target.value)} autoFocus />
          <button type="button" className="msheet-btn is-primary" disabled={!sale.phone.trim()} onClick={() => { setPhoneOpen(false); whatsapp(); }}>Abrir chat</button>
        </div>
      )}

      {notice && <p className={`msheet-notice ${notice.ok ? 'is-ok' : 'is-err'}`} role="status">{notice.text}</p>}
      <p className="msheet-fine">
        {canShare
          ? '“Compartir” abre el menú del celular y adjunta la tarjeta a WhatsApp o Instagram.'
          : 'WhatsApp Web no adjunta imágenes solo: descarga la tarjeta y arrástrala al chat que se abre.'}
      </p>
    </Sheet>
  );
}

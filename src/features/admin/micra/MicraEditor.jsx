import { useEffect, useRef, useState } from 'react';
import { composeVideoFrame, drawEspresaleCard, FORMATS } from '../espresaleCard.js';
import SafeZoneOverlay from './SafeZoneOverlay.jsx';
import SelectionLayer from './SelectionLayer.jsx';
import { IconPause, IconPlay } from './icons.jsx';

// Escenario del editor: la tarjeta (el lienzo que se exporta), el video de
// fondo nativo debajo (si la toma es video), la capa táctil y las zonas.
//
// La tarjeta se dibuja solo cuando cambia algo confirmado (una acción,
// «Listo», al soltar, formato, fondo o filtro), una vez por cuadro como
// máximo y descartando dibujos viejos. Con video no hay bucle de composición:
// el navegador pinta el video y, al pausar, se compone UNA vez el cuadro
// exacto que saldrá (con el vidrio esmerilado).

const LOOP_SECONDS = 60;

export default function MicraEditor({
  cardRef, drawArgs, tick, pending, onDrawn, drawn, format, videoUrl, trimStart = 0, hold,
  selection, onSelect, onEditText, onSlot, onSlotStep, onHide, isText, zones, altText, children,
}) {
  const videoRef = useRef(null);
  const stillRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [stillReady, setStillReady] = useState(false);
  const argsRef = useRef(drawArgs);
  argsRef.current = drawArgs;
  const onDrawnRef = useRef(onDrawn);
  onDrawnRef.current = onDrawn;

  const composeStill = () => {
    const v = videoRef.current;
    const c = stillRef.current;
    const card = cardRef.current;
    if (!v || !c || !card?.width || v.readyState < 2) return;
    c.width = card.width / 2;
    c.height = card.height / 2;
    composeVideoFrame(c.getContext('2d'), v, card);
    setStillReady(true);
  };
  const pausedRef = useRef(false);
  pausedRef.current = !!videoUrl && (!playing || hold);

  // Dibujo de la tarjeta: uno por cambio confirmado (coalescido al cuadro).
  // `tick` cambia cada minuto solo si la tarjeta muestra la hora.
  useEffect(() => {
    if (pending) return undefined;
    let alive = true;
    const raf = requestAnimationFrame(async () => {
      const c = cardRef.current;
      if (!c || !alive) return;
      const res = await drawEspresaleCard(c, { ...argsRef.current, date: new Date() });
      if (!res || !alive) return;
      onDrawnRef.current({ layout: res.layout, slots: res.slots, fit: res.fit, notes: res.notes, W: c.width, H: c.height });
      if (pausedRef.current) composeStill();
    });
    return () => { alive = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawArgs, tick, pending]);

  // Al cambiar de toma o salir: el <video> suelta el archivo (y lo retoma si React
  // vuelve a montar el mismo elemento, como hace el modo estricto)
  useEffect(() => {
    const v = videoRef.current;
    if (v && videoUrl && !v.getAttribute('src')) { v.src = videoUrl; v.load(); }
    return () => { if (v) { v.pause(); v.removeAttribute('src'); v.load(); } };
  }, [videoUrl]);

  // Video de fondo: en bucle desde el inicio elegido (máx. 60 s); se pausa con hojas encima
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!playing || hold) { v.pause(); composeStill(); }
    // (si el navegador no deja reproducir solo, queda en pausa con su botón)
    else { setStillReady(false); v.play().catch((e) => { if (e?.name === 'NotAllowedError') setPlaying(false); }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, hold, videoUrl]);
  useEffect(() => {
    const v = videoRef.current;
    if (v && Number.isFinite(trimStart)) v.currentTime = trimStart;
  }, [trimStart, videoUrl]);
  useEffect(() => {
    const onVis = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // El clip se repite desde el inicio elegido (lo mismo que saldrá en el video)
  const onTime = () => {
    const v = videoRef.current;
    if (v && (v.currentTime > trimStart + LOOP_SECONDS || v.currentTime < trimStart - 0.25)) v.currentTime = trimStart;
  };
  const onEnded = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = trimStart;
    if (!pausedRef.current) v.play().catch(() => {});
  };

  const { w, h } = FORMATS[format];
  const still = !videoUrl || !playing || hold;

  return (
    <div className="mst-stage" data-still={still ? 'true' : 'false'}>
      <div className="mst-frame" style={{ '--mst-ar': w / h }}>
        {videoUrl && (
          <video
            key={videoUrl}
            ref={videoRef}
            className="mst-video"
            src={videoUrl}
            muted
            playsInline
            autoPlay
            onTimeUpdate={onTime}
            onEnded={onEnded}
            onSeeked={() => { if (pausedRef.current) composeStill(); }}
            onLoadedData={() => { if (pausedRef.current) composeStill(); }}
          />
        )}
        {videoUrl && <canvas ref={stillRef} className={`mst-still ${still && stillReady ? 'is-on' : ''}`} aria-hidden="true" />}
        <canvas ref={cardRef} className="mst-card" role="img" aria-label={altText} />
        {zones !== 'off' && <SafeZoneOverlay format={format} mode={zones} />}
        <SelectionLayer
          drawn={drawn}
          cardRef={cardRef}
          selection={selection}
          onSelect={onSelect}
          onEditText={onEditText}
          onSlot={onSlot}
          onSlotStep={onSlotStep}
          onHide={onHide}
          isText={isText}
        />
        {videoUrl && (
          <button type="button" className="mst-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pausar video' : 'Reproducir video'}>
            {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

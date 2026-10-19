import { useEffect, useRef } from 'react';
import { drawEspresaleCard, FORMATS } from '../espresaleCard.js';

// Cámara de Micra: se abre al tocar el logo. Fondo fijo difuminado (sin la
// cámara encendida, para no gastar batería) con las opciones de la tarjeta y
// una vista previa del "filtro". Con las opciones listas, "Cámara" abre la
// cámara propia del celular, con su foto y su video; lo que se toma vuelve a
// Micra como fondo de la tarjeta.

export default function MicraCamera({ varieties, variety, format, weather, onVariety, onFormat, onFile, onClose }) {
  const previewRef = useRef(null);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  // Vista previa del filtro: se dibuja solo cuando cambia una opción
  useEffect(() => {
    if (variety && previewRef.current) drawEspresaleCard(previewRef.current, { variety, weather, date: new Date(), format });
  }, [variety, format, weather]);

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

  const { w, h } = FORMATS[format];

  return (
    <div className="mcam" role="dialog" aria-modal="true" aria-label="Cámara Micra">
      <div className="mc-bg" aria-hidden="true" />

      <header className="mc-top">
        <button type="button" className="mc-icon" onClick={onClose} aria-label="Cerrar">×</button>
        <b className="mc-logo">micra<i>.</i></b>
        <span className="mc-icon mc-icon-ghost" aria-hidden="true" />
      </header>

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
            <button type="button" className="mc-btn mc-go" disabled={!variety} onClick={() => cameraRef.current?.click()}>
              📷 {variety ? 'Cámara' : 'Elige una variedad'}
            </button>
            <button type="button" className="mc-btn mc-btn-ghost" disabled={!variety} onClick={() => galleryRef.current?.click()}>
              Galería
            </button>
          </div>
          <p className="mc-hint">La cámara del celular trae su foto y su video. Lo que tomes queda de fondo en la tarjeta.</p>
          {/* Con "capture" el celular abre su cámara (foto o video); sin él, la galería */}
          <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={pick} />
          <input ref={galleryRef} type="file" accept="image/*,video/*" hidden onChange={pick} />
        </div>
      </div>
    </div>
  );
}

import { pickVideoType } from '../espresaleCard.js';
import Sheet from './Sheet.jsx';

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Fondo de la tarjeta: papel o la toma, otra toma, galería, marco/cuadrícula/degradado e inicio del clip. */
export default function BackgroundSheet({ bg, capture, thumbUrl, onBg, onRetake, onGallery, elements, onToggle, trimStart, onTrim, duration, onClose, docked }) {
  const isVideo = capture?.type === 'video';
  const max = Math.max(0, Math.floor((duration || 0) - 1));
  return (
    <Sheet title="Fondo" onClose={onClose} docked={docked}>
      <div className="msheet-tiles is-two">
        <button type="button" className={`msheet-tile ${bg === 'plain' ? 'on' : ''}`} aria-pressed={bg === 'plain'} onClick={() => onBg('plain')}>
          <span className="msheet-tile-prev is-paper" />
          <span className="msheet-tile-name">Plano</span>
        </button>
        <button type="button" className={`msheet-tile ${bg === 'media' ? 'on' : ''}`} aria-pressed={bg === 'media'} disabled={!capture} onClick={() => onBg('media')}>
          <span className="msheet-tile-prev" style={thumbUrl ? { backgroundImage: `url(${thumbUrl})` } : undefined}>{!capture && <small>Toma una</small>}</span>
          <span className="msheet-tile-name">{isVideo ? 'Video' : 'Foto'}</span>
        </button>
      </div>
      <div className="msheet-row">
        <button type="button" className="msheet-btn" onClick={onRetake}>Volver a tomar</button>
        <button type="button" className="msheet-btn" onClick={onGallery}>Elegir de la galería</button>
      </div>
      <div className="msheet-group">
        {[['frame', 'Marco'], ['grid', 'Cuadrícula'], ['shade', 'Degradado']].map(([id, label]) => (
          <label key={id} className={`msheet-switch ${!elements[id].available ? 'is-na' : ''}`}>
            <input type="checkbox" checked={!!elements[id].visible} disabled={!elements[id].available} onChange={() => onToggle(id)} />
            <span>{label}</span>
            {!elements[id].available && <small>Solo con foto o video</small>}
          </label>
        ))}
      </div>
      {isVideo && bg === 'media' && (
        <div className="msheet-group">
          <label className="msheet-label" htmlFor="mst-trim">Inicio del clip</label>
          <input id="mst-trim" className="msheet-range" type="range" min={0} max={max} step={1} value={Math.min(trimStart, max)} disabled={!max} onChange={(e) => onTrim(Number(e.target.value))} />
          <small className="msheet-fine">Desde {clock(trimStart)} · se usan hasta 60 s</small>
          <p className="msheet-fine">Video · {Math.round(duration || 0)} s. Al publicar se graba un video nuevo (primeros 60 s desde el inicio elegido).</p>
          {!pickVideoType() && <p className="msheet-notice is-err">Este navegador no puede grabar video. Usa Safari o Chrome actualizados.</p>}
        </div>
      )}
    </Sheet>
  );
}

import { useEffect, useRef, useState } from 'react';
import { judgeLatteArt, judgeRecord, scoreBand, CRITERIA, MAX_SIDE } from './arteLatte.js';

// El juez de arte latte en la pantalla: toma la foto escogida, la reduce a
// 256 px en un canvas, la califica con arteLatte.js (en el celular, sin
// internet) y muestra el puntaje, los seis criterios, lo que puede mejorar y
// la foto con lo que midió encima (la taza, el eje y el centro del dibujo).
// Lo que se guarda con la entrada es judgeRecord (puntaje y criterios).

/** La foto reducida a MAX_SIDE y sus píxeles, para el juez. */
export async function readPhoto(file, max = MAX_SIDE) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(img.naturalWidth * k)), height: Math.max(1, Math.round(img.naturalHeight * k)) });
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, c.width, c.height);
    return { canvas: c, image: g.getImageData(0, 0, c.width, c.height) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Las barras de los seis criterios (también para la entrada abierta en la competencia). */
export function JudgeBars({ scores, compact = false }) {
  return (
    <ul className={`mapp-juez-bars ${compact ? 'is-compact' : ''}`} aria-label="Criterios">
      {CRITERIA.map((c) => (
        <li key={c.id}>
          <span>{c.label}</span>
          <i aria-hidden="true"><b style={{ width: `${(scores?.[c.id] ?? 0) * 10}%` }} /></i>
          <small>{(scores?.[c.id] ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })}</small>
        </li>
      ))}
    </ul>
  );
}

/** El sello del puntaje: el número grande y su banda. */
export function JudgeBadge({ score, small = false }) {
  if (score == null) return null;
  return (
    <span className={`mapp-juez-badge ${small ? 'is-small' : ''}`} aria-label={`Juez Micra: ${score} de 100`}>
      <b>{score}</b>{!small && <small>{scoreBand(score)}</small>}
    </span>
  );
}

export default function Juez({ file, onResult }) {
  const [state, setState] = useState({ busy: true });
  const canvasRef = useRef(null);
  useEffect(() => {
    let alive = true;
    setState({ busy: true });
    (async () => {
      try {
        const { canvas, image } = await readPhoto(file);
        const j = judgeLatteArt(image);
        if (!alive) return;
        setState({ busy: false, judge: j, canvas });
        onResult?.(judgeRecord(j));
      } catch (e) {
        if (!alive) return;
        setState({ busy: false, judge: { ok: false, reason: 'No pude leer la foto.' } });
        onResult?.(null);
      }
    })();
    return () => { alive = false; };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  // La foto con lo medido encima
  useEffect(() => {
    const el = canvasRef.current;
    const { judge: j, canvas } = state;
    if (!el || !canvas) return;
    el.width = canvas.width; el.height = canvas.height;
    const g = el.getContext('2d');
    g.drawImage(canvas, 0, 0);
    if (!j?.ok) return;
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(31, 36, 82, .9)';
    g.beginPath(); g.arc(j.cup.cx, j.cup.cy, j.cup.r, 0, Math.PI * 2); g.stroke();
    g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(j.cup.cx, j.cup.cy - j.cup.r); g.lineTo(j.cup.cx, j.cup.cy + j.cup.r); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#DE1B1B';
    g.beginPath(); g.arc(j.pattern.cx, j.pattern.cy, 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(222, 27, 27, .8)';
    g.beginPath(); g.moveTo(j.cup.cx - 5, j.cup.cy); g.lineTo(j.cup.cx + 5, j.cup.cy); g.moveTo(j.cup.cx, j.cup.cy - 5); g.lineTo(j.cup.cx, j.cup.cy + 5); g.stroke();
  }, [state]);

  const j = state.judge;
  return (
    <section className="mapp-glass mapp-juez" aria-label="Juez Micra" data-testid="juez">
      <header className="mapp-juez-head">
        <div>
          <p className="mapp-cota">Juez Micra · arte latte</p>
          {state.busy ? <p className="mapp-muted">Mirando tu taza…</p>
            : j?.ok ? <p className="mapp-muted">Mide lo mismo que los jurados: contraste, definición, simetría, centrado, tamaño y limpieza.</p>
              : <p className="mapp-error" role="alert" data-testid="juez-reason">{j?.reason}</p>}
        </div>
        {j?.ok && <JudgeBadge score={j.score} />}
      </header>
      {!state.busy && (
        <div className="mapp-juez-body">
          <canvas ref={canvasRef} className="mapp-juez-canvas" aria-label="Tu foto con lo que midió el juez" data-testid="juez-canvas" />
          {j?.ok && (
            <div className="mapp-juez-detail" data-testid="juez-score" data-score={j.score}>
              <JudgeBars scores={j.scores} />
              {j.notes.length > 0 && (
                <ul className="mapp-juez-notes">
                  {j.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      <p className="mapp-fine">El puntaje queda con tu entrada. La gente califica con granos y el equipo como jurado; con eso el juez aprende.</p>
    </section>
  );
}

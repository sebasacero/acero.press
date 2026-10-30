import { useEffect, useRef, useState } from 'react';
import { money, cupsLabel } from './micraApp.js';
import { dayStory } from './motivation.js';
import platform from './platform.js';
import Figure, { loadFigure } from './Elenco.jsx';
import { km } from '../ruta/track.js';

// La meta cumplida (una vez al día) y la tarjeta de «mi día» para WhatsApp o
// Historias. Se cargan aparte: solo las ve quien llega a su meta o la pide.

/** Cerrar con Escape y devolver el foco al botón principal al abrir. */
function useDialog(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const on = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return ref;
}

/** Granos de café a trazo y puntos rojos alrededor del personaje. */
function Beans() {
  return (
    <svg className="mapp-party-beans" viewBox="0 0 390 300" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <g transform="translate(40 60) rotate(-20)"><ellipse rx="9" ry="13" /><path d="M0-12c-4 8 4 16 0 24" /></g>
        <g transform="translate(340 80) rotate(30)"><ellipse rx="9" ry="13" /><path d="M0-12c-4 8 4 16 0 24" /></g>
        <g transform="translate(70 230) rotate(60)"><ellipse rx="7" ry="10" /><path d="M0-9c-3 6 3 12 0 18" /></g>
        <g transform="translate(320 220) rotate(-50)"><ellipse rx="7" ry="10" /><path d="M0-9c-3 6 3 12 0 18" /></g>
        <g transform="translate(200 24) rotate(10)"><ellipse rx="6" ry="9" /><path d="M0-8c-3 5 3 11 0 16" /></g>
      </g>
      <g className="is-dots"><circle cx="90" cy="120" r="4" /><circle cx="300" cy="150" r="5" /><circle cx="260" cy="50" r="3" /><circle cx="130" cy="270" r="3" /></g>
    </svg>
  );
}

export function Party({ cups, goal, streak, total, fig, onShare, onClose }) {
  const first = useDialog(onClose);
  return (
    <div className="mapp-party" role="dialog" aria-modal="true" aria-label="Meta cumplida" data-testid="party">
      <div className="mapp-party-stage">
        <Beans />
        <span className="mapp-party-sun" aria-hidden="true" />
        <Figure name={fig} className="is-party" draw />
      </div>
      <p className="mapp-party-script">¡Lo lograste!</p>
      <p className="mapp-party-n">{cupsLabel(cups)}</p>
      <p className="mapp-party-sub">Cumpliste tu meta de {goal}.{streak > 1 ? ` Llevas ${streak} días seguidos.` : ''}</p>
      <dl className="mapp-party-stats">
        <div><dd>{money(total)}</dd><dt>hoy</dt></div>
        <div><dd>{streak}</dd><dt>{streak === 1 ? 'día seguido' : 'días seguidos'}</dt></div>
        <div><dd>{cups - goal > 0 ? `+${cups - goal}` : '✓'}</dd><dt>sobre la meta</dt></div>
      </dl>
      <button ref={first} type="button" className="mapp-btn is-cta" onClick={onShare}>Compartir mi día</button>
      <button type="button" className="mapp-btn is-ghostdark" onClick={onClose}>Seguir vendiendo</button>
    </div>
  );
}

const today = () => new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'short' });

/** El SVG del elenco con sus colores puestos, para dibujarlo en el lienzo. */
async function figureImage(name) {
  try {
    const raw = await loadFigure(name);
    if (!raw) return null;
    const svg = raw.replace(/<svg([^>]*)>/, '<svg$1><style>.pi{fill:#1F2452}.pz{fill:#C9BFAE}.pr{fill:#DE1B1B}</style>');
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    return img;
  } catch { return null; }
}

/** La tarjeta de 1080 × 1920 (Historias): crema, la cifra grande, el personaje en su andén. */
async function drawStory({ name, cups, total, streak, distance, url, fig }) {
  const W = 1080; const H = 1920;
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = c.getContext('2d');
  await document.fonts?.ready;
  g.fillStyle = '#F5EFE4'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#16181F';
  g.font = '800 64px Archivo, sans-serif'; g.fillText('micra', 90, 170);
  g.fillStyle = '#DE1B1B'; g.fillText('.', 90 + g.measureText('micra').width, 170);
  g.fillStyle = '#626877'; g.font = '500 34px "JetBrains Mono", monospace'; g.fillText(today().toUpperCase(), 90, 230);
  g.save(); g.translate(90, 360); g.rotate(-0.04);
  g.fillStyle = '#DE1B1B'; g.font = '72px "Permanent Marker", cursive'; g.fillText(`El día de ${name}`, 0, 0);
  g.restore();
  g.fillStyle = '#16181F'; g.font = '900 300px Archivo, sans-serif'; g.fillText(String(cups), 80, 650);
  g.font = '800 64px Archivo, sans-serif'; g.fillText(cups === 1 ? 'taza de café' : 'tazas de café', 90, 740);
  // Sin pesos: la tarjeta sale a las redes y lo que lleva encima no se anuncia (seguridad en la calle)
  const stats = [[String(streak), streak === 1 ? 'DÍA SEGUIDO' : 'DÍAS SEGUIDOS']];
  if (distance > 0) stats.push([km(distance), 'CAMINADOS']);
  stats.forEach(([v, l], i) => {
    const y = 880 + i * 150;
    g.fillStyle = '#16181F'; g.font = '900 80px Archivo, sans-serif'; g.fillText(v, 90, y);
    g.fillStyle = '#626877'; g.font = '500 30px "JetBrains Mono", monospace'; g.fillText(l, 90, y + 46);
  });
  const img = await figureImage(fig);
  const ground = 1700;
  if (img) {
    const h = 900; const w = h * (img.naturalWidth / img.naturalHeight || 0.5);
    g.drawImage(img, W - w - 40, ground - h, w, h);
  }
  g.strokeStyle = '#1F2452'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, ground); g.lineTo(W, ground); g.stroke();
  g.lineWidth = 2; g.globalAlpha = 0.35;
  for (let x = 60; x < W; x += 160) { g.beginPath(); g.moveTo(x, ground); g.lineTo(x, H); g.stroke(); }
  g.globalAlpha = 1;
  g.fillStyle = '#626877'; g.font = '500 32px "JetBrains Mono", monospace'; g.fillText('Apártame en Micra:', 90, 1500);
  g.fillStyle = '#16181F'; g.font = '700 34px "JetBrains Mono", monospace'; g.fillText(url.replace(/^https?:\/\//, ''), 90, 1550);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export function DayStory({ name, cups, total, streak, fig, km: distance = 0, url, onClose }) {
  const first = useDialog(onClose);
  const [busy, setBusy] = useState(false);
  const text = dayStory({ cups, total, streak });
  const shareImage = async () => {
    setBusy(true);
    try {
      const blob = await drawStory({ name, cups, total, streak, distance, url, fig });
      if (blob) await platform.shareImage({ blob, fileName: 'mi-dia-micra.png', title: 'Mi día en Micra', text: `${text} ${url}` });
      else await platform.share({ title: 'Mi día en Micra', text, url });
    } catch { await platform.share({ title: 'Mi día en Micra', text, url }); }
    setBusy(false);
  };
  return (
    <div className="mapp-storywrap" role="dialog" aria-modal="true" aria-label="Mi día" data-testid="story">
      <article className="mapp-story">
        <p className="mapp-story-brand">micra<i>.</i> <small>{today()}</small></p>
        <p className="mapp-story-script">El día de {name}</p>
        <p className="mapp-story-n">{cups}</p>
        <p className="mapp-story-unit">{cups === 1 ? 'taza de café' : 'tazas de café'}</p>
        <dl className="mapp-story-stats">
          <div><dd>{streak}</dd><dt>{streak === 1 ? 'día seguido' : 'días seguidos'}</dt></div>
          {distance > 0 && <div><dd>{km(distance)}</dd><dt>caminados</dt></div>}
        </dl>
        <p className="mapp-story-link">Apártame en Micra:<br /><b>{url.replace(/^https?:\/\//, '')}</b></p>
        <Figure name={fig} className="is-story" />
        <i className="mapp-anden" aria-hidden="true" />
      </article>
      <span className="mapp-row-btns is-story">
        <button ref={first} type="button" className="mapp-btn is-cta" onClick={shareImage} disabled={busy}>{busy ? 'Preparando…' : 'Compartir'}</button>
        <button type="button" className="mapp-btn is-ghostdark" onClick={onClose}>Cerrar</button>
      </span>
    </div>
  );
}

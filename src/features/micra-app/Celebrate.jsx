import { useEffect, useRef, useState } from 'react';
import { money, cupsLabel } from './micraApp.js';
import { dayStory } from './motivation.js';
import platform from './platform.js';
import Figure, { loadFigure } from './Elenco.jsx';
import { km } from '../ruta/track.js';
import { LEVELS } from './motivation.js';
import { routeLine, storyVariant, storyFigure, goalTimeLabel } from './daycard.js';

// La meta cumplida (una vez al día) y la tarjeta de «mi día» para WhatsApp o
// Historias. Se cargan aparte: solo las ve quien llega a su meta o la pide.

/** El QR del perfil del barista, en SVG; qr.js se carga aparte al abrir la tarjeta. */
function useQr(url) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    let on = true;
    import('./qr.js').then(({ qrMatrix, modulesPath }) => {
      const m = qrMatrix(url);
      if (on) setQr({ m, n: m.length, d: modulesPath(m, { quiet: 2 }) });
    }).catch(() => {});
    return () => { on = false; };
  }, [url]);
  return qr;
}

/** Los tres ojos del QR (7 × 7), que modulesPath deja fuera. */
const qrEyes = (n, q = 2) => [[q, q], [q + n - 7, q], [q, q + n - 7]];

function StoryQr({ qr }) {
  if (!qr) return null;
  const side = qr.n + 4;
  return (
    <svg className="mapp-story-qr" viewBox={`0 0 ${side} ${side}`} role="img" aria-label="QR a mi perfil de Micra" data-testid="story-qr">
      <rect width={side} height={side} fill="#fff" />
      <path d={qr.d} fill="#16181F" />
      {qrEyes(qr.n).map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width="6" height="6" rx="1.6" fill="none" stroke="#16181F" />
          <rect x={x + 2} y={y + 2} width="3" height="3" rx=".8" fill="#DE1B1B" />
        </g>
      ))}
    </svg>
  );
}

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
  const [at] = useState(() => goalTimeLabel());
  return (
    <div className="mapp-party" role="dialog" aria-modal="true" aria-label="Meta cumplida" data-testid="party">
      <div className="mapp-party-stage">
        <Beans />
        <span className="mapp-party-sun" aria-hidden="true" />
        <Figure name={fig} className="is-party" draw />
      </div>
      <p className="mapp-party-script">¡Lo lograste!</p>
      <p className="mapp-party-n">{cupsLabel(cups)}</p>
      <p className="mapp-party-sub">Meta de {goal} cumplida a las {at}.{streak > 1 ? ` Llevas ${streak} días seguidos.` : ''}</p>
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

/**
 * Los otros momentos del día, con la misma escena de la meta: la primera taza
 * (la racha sigue o llega a un hito). El texto sale de daycard.js; aquí solo
 * se pinta.
 */
export function Moment({ moment, fig, onPrimary, onClose, closeLabel = 'Seguir' }) {
  const first = useDialog(onClose);
  return (
    <div className={`mapp-party is-${moment.tone}`} role="dialog" aria-modal="true" aria-label={moment.script} data-testid={`moment-${moment.id}`}>
      <div className="mapp-party-stage">
        <Beans />
        <span className="mapp-party-sun" aria-hidden="true" />
        {moment.tone === 'racha' || moment.tone === 'primera'
          ? <span className="mapp-party-flame" aria-hidden="true">🔥</span>
          : null}
        <Figure name={fig} className="is-party" draw />
      </div>
      <p className="mapp-party-script">{moment.script}</p>
      <p className="mapp-party-n">{moment.big}</p>
      <p className="mapp-party-sub">{moment.sub}</p>
      <dl className="mapp-party-stats">
        {moment.stats.map(([v, l]) => <div key={l}><dd>{v}</dd><dt>{l}</dt></div>)}
      </dl>
      <button ref={first} type="button" className="mapp-btn is-cta" onClick={onPrimary}>{moment.primary}</button>
      {closeLabel && <button type="button" className="mapp-btn is-ghostdark" onClick={onClose}>{closeLabel}</button>}
    </div>
  );
}

/** El trazo del recorrido: tinta, con puntos rojos al salir, en las paradas y al final. */
export function RouteBox({ path, className = '' }) {
  const r = routeLine(path, { w: 300, h: 150, pad: 14 });
  return (
    <figure className={`mapp-routebox ${className}`} data-testid="story-route">
      <svg viewBox="0 0 300 150" role="img" aria-label={r ? 'Tu recorrido de hoy' : 'Aún sin recorrido'}>
        <g className="mapp-routebox-grid" aria-hidden="true">
          {[30, 75, 120].map((y) => <line key={y} x1="0" x2="300" y1={y} y2={y} />)}
          {[50, 125, 200, 275].map((x) => <line key={x} y1="0" y2="150" x1={x} x2={x} />)}
        </g>
        {r ? (
          <>
            <path d={r.d} className="mapp-routebox-line" />
            {r.points.filter((_, i) => i > 0 && i < r.points.length - 1 && i % Math.max(1, Math.floor(r.points.length / 4)) === 0)
              .map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4" className="mapp-routebox-stop" />)}
            <circle cx={r.start[0]} cy={r.start[1]} r="6" className="mapp-routebox-start" />
            <circle cx={r.end[0]} cy={r.end[1]} r="7" className="mapp-routebox-end" />
          </>
        ) : <text x="150" y="80" textAnchor="middle" className="mapp-routebox-empty">Tu ruta sale aquí cuando caminas con la ubicación</text>}
      </svg>
    </figure>
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

/**
 * La tarjeta de 1080 × 1920 (Historias): crema, la cifra grande, el personaje
 * en su andén. Si camina, «Mi día en la calle» con el trazo de su recorrido.
 */
async function drawStory({ name, cups, streak, distance, stops, path, url, fig, variant, qr }) {
  const W = 1080; const H = 1920;
  const calle = variant === 'calle';
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = c.getContext('2d');
  await document.fonts?.ready;
  g.fillStyle = '#F5EFE4'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#16181F';
  // «micra.» con la misma letra a mano de la marca en la app
  g.font = '80px "Permanent Marker", cursive'; g.fillText('micra', 90, 170);
  g.fillStyle = '#DE1B1B'; g.fillText('.', 90 + g.measureText('micra').width, 170);
  g.fillStyle = '#626877'; g.font = '500 34px "JetBrains Mono", monospace'; g.fillText(today().toUpperCase(), 90, 230);
  g.save(); g.translate(90, 360); g.rotate(-0.04);
  g.fillStyle = '#DE1B1B'; g.font = '72px "Permanent Marker", cursive'; g.fillText(calle ? 'Mi día en la calle' : `El día de ${name}`, 0, 0);
  g.restore();
  g.fillStyle = '#16181F'; g.font = `900 ${calle ? 240 : 300}px Archivo, sans-serif`; g.fillText(String(cups), 80, calle ? 600 : 650);
  g.font = '800 64px Archivo, sans-serif'; g.fillText(cups === 1 ? 'taza de café' : 'tazas de café', 90, calle ? 690 : 740);
  // Sin pesos: la tarjeta sale a las redes y lo que lleva encima no se anuncia (seguridad en la calle)
  let y0 = 880;
  if (calle) {
    const r = routeLine(path, { w: 900, h: 380, pad: 40 });
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(90, 740, 900, 380, 36); g.fill();
    g.save(); g.translate(90, 740);
    g.strokeStyle = 'rgba(31,36,82,.08)'; g.lineWidth = 3;
    for (let x = 150; x < 900; x += 225) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 380); g.stroke(); }
    for (let y = 95; y < 380; y += 95) { g.beginPath(); g.moveTo(0, y); g.lineTo(900, y); g.stroke(); }
    if (r) {
      g.strokeStyle = '#1F2452'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(new Path2D(r.d));
      g.fillStyle = '#DE1B1B';
      for (const [x, y] of [r.start, r.end]) { g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
    y0 = 1230;
    const stats = [[km(distance), 'CAMINADOS'], [String(streak), streak === 1 ? 'DÍA SEGUIDO' : 'DÍAS SEGUIDOS'], [String(stops), stops === 1 ? 'PARADA' : 'PARADAS'], [`${LEVELS[0].id} ${LEVELS[0].name}`, 'NIVEL']];
    stats.forEach(([v, l], i) => {
      const x = 90 + (i % 2) * 330; const y = y0 + Math.floor(i / 2) * 140;
      g.fillStyle = '#16181F'; g.font = `900 ${i === 3 ? 48 : 68}px Archivo, sans-serif`; g.fillText(v, x, y);
      g.fillStyle = '#626877'; g.font = '500 28px "JetBrains Mono", monospace'; g.fillText(l, x, y + 42);
    });
  } else {
    const stats = [[String(streak), streak === 1 ? 'DÍA SEGUIDO' : 'DÍAS SEGUIDOS']];
    if (distance > 0) stats.push([km(distance), 'CAMINADOS']);
    stats.forEach(([v, l], i) => {
      const y = y0 + i * 150;
      g.fillStyle = '#16181F'; g.font = '900 80px Archivo, sans-serif'; g.fillText(v, 90, y);
      g.fillStyle = '#626877'; g.font = '500 30px "JetBrains Mono", monospace'; g.fillText(l, 90, y + 46);
    });
  }
  const img = await figureImage(fig);
  const ground = 1700;
  if (img) {
    const h = calle ? 560 : 900; const w = h * (img.naturalWidth / img.naturalHeight || 0.5);
    g.drawImage(img, W - w - 40, ground - h, w, h);
  }
  g.strokeStyle = '#1F2452'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, ground); g.lineTo(W, ground); g.stroke();
  g.lineWidth = 2; g.globalAlpha = 0.35;
  for (let x = 60; x < W; x += 160) { g.beginPath(); g.moveTo(x, ground); g.lineTo(x, H); g.stroke(); }
  g.globalAlpha = 1;
  // El QR lleva al perfil de Micra del barista; debajo, el enlace corto por si no lo escanean
  const top = calle ? 1360 : 1290; const size = 260;
  g.fillStyle = '#626877'; g.font = '500 30px "JetBrains Mono", monospace'; g.fillText('Pídeme por', 90, top - 24);
  const lead = g.measureText('Pídeme por ').width;
  g.fillStyle = '#16181F'; g.font = '44px "Permanent Marker", cursive'; g.fillText('micra', 90 + lead, top - 22);
  g.fillStyle = '#DE1B1B'; g.fillText('.', 90 + lead + g.measureText('micra').width, top - 22);
  if (qr) {
    const side = qr.n + 4; const u = size / side;
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(90, top, size, size, 18); g.fill();
    g.save(); g.translate(90, top); g.scale(u, u);
    g.fillStyle = '#16181F'; g.fill(new Path2D(qr.d));
    for (const [x, y] of qrEyes(qr.n)) {
      g.strokeStyle = '#16181F'; g.lineWidth = 1; g.beginPath(); g.roundRect(x + 0.5, y + 0.5, 6, 6, 1.6); g.stroke();
      g.fillStyle = '#DE1B1B'; g.beginPath(); g.roundRect(x + 2, y + 2, 3, 3, 0.8); g.fill();
    }
    g.restore();
  }
  g.fillStyle = '#16181F'; g.font = '700 24px "JetBrains Mono", monospace';
  g.fillText(url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/b/')[0] + '/b/…', 90, top + size + 44);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export function DayStory({ name, cups, total, streak, fig, km: distance = 0, stops = 0, path = [], mode = null, url, onClose }) {
  const first = useDialog(onClose);
  const [busy, setBusy] = useState(false);
  const variant = storyVariant(mode);
  const calle = variant === 'calle';
  const figure = mode ? storyFigure(mode) : fig;
  const text = dayStory({ cups, total, streak });
  const qr = useQr(url);
  const shareImage = async () => {
    setBusy(true);
    try {
      const blob = await drawStory({ name, cups, streak, distance, stops, path, url, fig: figure, variant, qr });
      if (blob) await platform.shareImage({ blob, fileName: 'mi-dia-micra.png', title: 'Mi día en Micra', text: `${text} ${url}` });
      else await platform.share({ title: 'Mi día en Micra', text, url });
    } catch { await platform.share({ title: 'Mi día en Micra', text, url }); }
    setBusy(false);
  };
  const whatsapp = () => platform.openExternal(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`);
  const level = LEVELS[0];
  return (
    <div className="mapp-storywrap" role="dialog" aria-modal="true" aria-label={calle ? 'Mi día en la calle' : 'Mi día'} data-testid="story" data-variant={variant}>
      <article className={`mapp-story is-${variant}`}>
        <p className="mapp-story-brand"><span className="mapp-micraword">micra<i>.</i></span> <small>{today()}</small></p>
        <p className="mapp-story-script">{calle ? 'Mi día en la calle' : `El día de ${name}`}</p>
        <p className="mapp-story-n">{cups}</p>
        <p className="mapp-story-unit">{cups === 1 ? 'taza de café' : 'tazas de café'}</p>
        {calle && <RouteBox path={path} />}
        <dl className="mapp-story-stats">
          {calle ? (
            <>
              <div><dd>{km(distance)}</dd><dt>caminados</dt></div>
              <div><dd>{streak}</dd><dt>{streak === 1 ? 'día seguido' : 'días seguidos'}</dt></div>
              <div><dd>{stops}</dd><dt>{stops === 1 ? 'parada' : 'paradas'}</dt></div>
              <div><dd><span className="mapp-levelchip">{level.id}</span> {level.name}</dd><dt>nivel</dt></div>
            </>
          ) : (
            <>
              <div><dd>{streak}</dd><dt>{streak === 1 ? 'día seguido' : 'días seguidos'}</dt></div>
              {distance > 0 && <div><dd>{km(distance)}</dd><dt>caminados</dt></div>}
            </>
          )}
        </dl>
        <div className="mapp-story-link">
          <p>Pídeme por <span className="mapp-micraword">micra<i>.</i></span></p>
          <StoryQr qr={qr} />
          <a href={url} data-testid="story-link">Ver mi perfil</a>
        </div>
        <Figure name={figure} className="is-story" />
        <i className="mapp-anden" aria-hidden="true" />
      </article>
      <span className="mapp-row-btns is-story">
        <button ref={first} type="button" className="mapp-btn is-wa" onClick={whatsapp} data-testid="story-wa">WhatsApp</button>
        <button type="button" className="mapp-btn is-cta" onClick={shareImage} disabled={busy} data-testid="story-share">{busy ? 'Preparando…' : 'Historias'}</button>
      </span>
      <button type="button" className="mapp-link is-onink" onClick={onClose}>Cerrar</button>
    </div>
  );
}

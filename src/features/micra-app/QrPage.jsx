import { useEffect, useMemo, useState } from 'react';
import platform from './platform.js';
import { QR_LOGOS, logoOf, defaultLogo, qrMatrix, logoHole, modulesPath, finderOrigins, shortUrl, qrFileName } from './qr.js';

// «Pídeme por Micra»: el QR propio del barista, con su dibujo al centro (el
// termo, el vasito, el carrito, la sombrilla o el chico que camina). Lleva a su
// página (/micra/b/<id>). Se comparte o se descarga en PNG para pegarlo en el
// termo, el carrito o la sombrilla. Se carga aparte: solo lo baja quien lo abre.

const KEY = 'micra_qr_logo_v1';
const readLogo = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const writeLogo = (id) => { try { localStorage.setItem(KEY, id); } catch { /* sin memoria: vale por hoy */ } };
const INK = '#1F2452';
const RED = '#DE1B1B';
const QUIET = 4;

/** El QR en SVG: módulos tinta, ojos redondeados con el punto rojo y el dibujo al centro en su placa blanca. */
export function QrSvg({ url, logo, className = '', logoHref = null }) {
  const { n, d, hole } = useMemo(() => {
    const m = qrMatrix(url);
    const h = logoHole(m.length);
    return { n: m.length, d: modulesPath(m, { quiet: QUIET, hole: h }), hole: h };
  }, [url]);
  const side = n + QUIET * 2;
  const L = logoOf(logo);
  const pad = 0.6;
  return (
    <svg className={className} viewBox={`0 0 ${side} ${side}`} role="img" aria-label={`Código QR de ${shortUrl(url)} con ${L.label.toLowerCase()}`} shapeRendering="crispEdges" data-testid="qr-svg" data-logo={L.id}>
      <rect width={side} height={side} rx="2.4" fill="#fff" />
      <path d={d} fill={INK} />
      {finderOrigins(n, QUIET).map(([x, y]) => (
        <g key={`${x}-${y}`} shapeRendering="geometricPrecision">
          <rect x={x + 0.5} y={y + 0.5} width="6" height="6" rx="1.8" fill="none" stroke={INK} strokeWidth="1" />
          <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.9" fill={RED} />
        </g>
      ))}
      <rect x={hole.start + QUIET + pad / 2} y={hole.start + QUIET + pad / 2} width={hole.size - pad} height={hole.size - pad} rx="1.6" fill="#fff" stroke={INK} strokeWidth=".35" shapeRendering="geometricPrecision" />
      <image href={logoHref ?? platform.siteUrl(L.src)} x={hole.start + QUIET + 1} y={hole.start + QUIET + 1} width={hole.size - 2} height={hole.size - 2} preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}

/** El SVG del dibujo como data: (dentro de un SVG pintado en lienzo no carga nada de afuera). */
async function logoData(src) {
  const r = await fetch(platform.siteUrl(src));
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await r.text())}`;
}

/** La tarjeta de 1080 × 1350 en PNG: «Pídeme por Micra», el QR y su enlace. */
async function drawCard({ url, logo, name, svgEl }) {
  const W = 1080; const H = 1350;
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = c.getContext('2d');
  await document.fonts?.ready;
  g.fillStyle = '#F5EFE4'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#16181F'; g.font = '800 64px Archivo, sans-serif'; g.fillText('micra', 90, 150);
  g.fillStyle = RED; g.fillText('.', 90 + g.measureText('micra').width, 150);
  g.save(); g.translate(90, 260); g.rotate(-0.035);
  g.fillStyle = RED; g.font = '76px "Permanent Marker", cursive'; g.fillText('Pídeme por Micra', 0, 0);
  g.restore();
  // El mismo SVG de la pantalla, con el dibujo incrustado
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '820'); clone.setAttribute('height', '820');
  const im = clone.querySelector('image');
  if (im) im.setAttribute('href', await logoData(logoOf(logo).src));
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  await img.decode();
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(110, 320, 860, 860, 48); g.fill();
  g.drawImage(img, 130, 340, 820, 820);
  g.fillStyle = '#16181F'; g.font = '900 54px Archivo, sans-serif'; g.fillText(name ? `Café de ${name}` : 'Café en la calle', 90, 1245);
  // El enlace en una o dos líneas, achicando la letra hasta que quepa
  g.fillStyle = '#626877';
  const link = shortUrl(url);
  let size = 30;
  do { g.font = `500 ${size}px "JetBrains Mono", monospace`; size -= 2; } while (g.measureText(link).width > W - 180 && size > 18);
  g.fillText(link, 90, 1305);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export default function QrPage({ url, name, mode = null, go }) {
  const [logo, setLogo] = useState(() => defaultLogo(mode, readLogo()));
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  useEffect(() => { setNote(null); }, [logo]);
  const pick = (id) => { setLogo(id); writeLogo(id); };
  const svg = () => document.querySelector('[data-testid="qr-svg"]');
  const fileName = qrFileName(name, logo);

  const share = async () => {
    setBusy('share');
    try {
      const blob = await drawCard({ url, logo, name, svgEl: svg() });
      if (blob) await platform.shareImage({ blob, fileName, title: 'Pídeme por Micra', text: `Apártame un café en Micra: ${url}` });
      else await platform.share({ title: 'Pídeme por Micra', text: 'Apártame un café en Micra:', url });
    } catch { await platform.share({ title: 'Pídeme por Micra', text: 'Apártame un café en Micra:', url }); }
    setBusy(null);
  };
  const download = async () => {
    setBusy('down');
    try {
      const blob = await drawCard({ url, logo, name, svgEl: svg() });
      const href = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href, download: fileName });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      setNote(`Guardado como ${fileName}. Imprímelo de 5 cm o más para pegarlo.`);
    } catch { setNote('No se pudo guardar. Prueba con «Compartir».'); }
    setBusy(null);
  };

  return (
    <div className="mapp-qrpage" data-testid="qr-page">
      <header className="mapp-qrpage-head">
        {go && <button type="button" className="mapp-link" onClick={() => go('/micra/barista/perfil')}>‹ Mi perfil</button>}
        <p className="mapp-cota">Pídeme por Micra</p>
        <h1 className="mapp-title is-small">Tu QR</h1>
        <p className="mapp-muted">Pégalo en tu termo, tu carrito o tu sombrilla. Quien lo escanea abre tu página y te aparta café.</p>
      </header>

      <article className="mapp-qrcard" aria-label="Tu código QR">
        <p className="mapp-qrcard-brand">micra<i>.</i></p>
        <p className="mapp-qrcard-script">Pídeme por Micra</p>
        <div className="mapp-qrcard-plate"><QrSvg url={url} logo={logo} className="mapp-qr" /></div>
        <p className="mapp-qrcard-name">{name ? `Café de ${name}` : 'Café en la calle'}</p>
        <code className="mapp-qrcard-url">{shortUrl(url)}</code>
      </article>

      <section className="mapp-qrlogos" aria-label="Dibujo del centro">
        <p className="mapp-cota">El dibujo del centro</p>
        <div role="radiogroup" aria-label="Dibujo del centro">
          {QR_LOGOS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={logo === l.id} className={logo === l.id ? 'on' : ''} onClick={() => pick(l.id)} data-testid={`qr-logo-${l.id}`}>
              <img src={platform.siteUrl(l.src)} alt="" width="48" height="48" loading="lazy" />
              <b>{l.label}</b>
            </button>
          ))}
        </div>
      </section>

      <span className="mapp-row-btns is-qr">
        <button type="button" className="mapp-btn is-cta" onClick={share} disabled={!!busy} data-testid="qr-share">{busy === 'share' ? 'Preparando…' : 'Compartir'}</button>
        <button type="button" className="mapp-btn is-ghost" onClick={download} disabled={!!busy} data-testid="qr-download">{busy === 'down' ? 'Guardando…' : 'Descargar PNG'}</button>
      </span>
      {note && <p className="mapp-fine" role="status">{note}</p>}
      <p className="mapp-fine">El QR solo lleva tu página de Micra: nada de tu número ni de cuánto vendes.</p>
    </div>
  );
}

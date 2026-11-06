import { useEffect, useState } from 'react';

// Un QR chico en SVG (la tarjeta «Mi día», la cabecera de Mi perfil). qr.js y su
// librería se piden aparte, solo cuando el QR se va a ver.

/** La matriz y el trazo del QR de `url` (null mientras carga o si falla). */
export function useQr(url) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    let on = true;
    if (!url) return undefined;
    import('./qr.js').then(({ qrMatrix, modulesPath }) => {
      const m = qrMatrix(url);
      if (on) setQr({ m, n: m.length, d: modulesPath(m, { quiet: 2 }) });
    }).catch(() => {});
    return () => { on = false; };
  }, [url]);
  return qr;
}

/** Los tres ojos del QR (7 × 7), que modulesPath deja fuera. */
export const qrEyes = (n, q = 2) => [[q, q], [q + n - 7, q], [q, q + n - 7]];

export default function MiniQr({ qr, className = '', label, testid }) {
  if (!qr) return <span className={`${className} is-loading`} aria-hidden="true" />;
  const side = qr.n + 4;
  return (
    <svg className={className} viewBox={`0 0 ${side} ${side}`} role="img" aria-label={label} data-testid={testid}>
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

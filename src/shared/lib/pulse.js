// Pulso del café: mercado (FNC, Bolsa NY, TRM) y clima de Bogotá, servidos
// por /api/pulse. Las tres cintas de la página comparten una sola consulta.
// Si no hay datos (sin conexión, en desarrollo) devuelve null y las cintas
// quedan solo con sus frases.

let pending = null;

export function fetchPulse() {
  if (!pending) {
    pending = fetch('/api/pulse')
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null))
      .catch(() => null);
  }
  return pending;
}

// Códigos de Open-Meteo agrupados en las condiciones que nombran las cintas
export function weatherKind(code) {
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

// Qué conviene vender con este clima (la cinta lo dice en una frase)
export function weatherTip(b) {
  const wet = ['drizzle', 'rain', 'showers', 'storm'].includes(weatherKind(b.code));
  if (wet || b.rainProb >= 60) return 'tipRain';
  if (b.max >= 22) return 'tipWarm';
  return 'tipMild';
}

import { useEffect, useRef } from 'react';

// Los personajes de la calle en movimiento (animado/*.mp4, generados por
// scripts/animar-personajes a partir de las ilustraciones originales).
// Acompañan las esperas: primero sale el póster (unos KB) y el video, de 30 a
// 60 KB, arranca cuando llega; con «menos movimiento» queda el póster. Van
// sobre crema en los dos temas porque los dibujos tienen su color.

const mods = import.meta.glob('./animado/*.{mp4,webp}', { eager: true, query: '?url', import: 'default' });
const url = (name, ext) => mods[`./animado/${name}${ext}`];

const quieto = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Animado({ name, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    // play() explícito: el autoplay de iOS a veces no arranca si el video llegó después de pintar
    const v = ref.current;
    if (!v || quieto()) return;
    v.play?.()?.catch?.(() => {});
  }, [name]);
  const poster = url(name, '-poster.webp');
  const video = url(name, '.mp4');
  if (!video) return null;
  if (quieto()) return <img className={`mapp-anim is-${name} ${className}`} src={poster} alt="" />;
  return (
    <video ref={ref} className={`mapp-anim is-${name} ${className}`} src={video} poster={poster}
      autoPlay muted loop playsInline preload="auto" aria-hidden="true" tabIndex={-1} />
  );
}

// Espera con personaje: el texto sigue siendo el mismo para lectores y pruebas
export function Cargando({ fig = 'carrito', children = 'Cargando…' }) {
  return (
    <div className="mapp-loading" role="status">
      <Animado name={fig} />
      <p className="mapp-muted">{children}</p>
    </div>
  );
}

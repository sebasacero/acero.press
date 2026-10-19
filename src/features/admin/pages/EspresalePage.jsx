import MicraStudio from '../micra/MicraStudio.jsx';

// Micra: cámara y editor de la tarjeta para redes, con la venta en barra.
export default function EspresalePage({ onExit, onOpenTool }) {
  return <MicraStudio onExit={onExit} onOpenTool={onOpenTool} />;
}

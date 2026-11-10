import { LanguageProvider } from '../../i18n/LanguageContext.jsx';
import ControlPanel from './ControlPanel.jsx';
import '../../../shared/styles/termico.css';
import './pagina-dia.css';

// /micra en computador (pedido del usuario, 10 nov 2026): en vez de la app del celular en una
// columna angosta, el centro de control a pantalla completa. El celular sigue abriendo la app;
// en computador la app queda a un toque («Abrir la app», /micra?app). También en /micra/panel.
// La regla de la ruta vive en main.jsx.
export default function MicraPanelPage() {
  return (
    <LanguageProvider>
      <div className="pg-panel-page">
        <header className="pg-panel-bar">
          <a href="/" className="pg-panel-brand" aria-label="ACERO.press">
            <img src="/image/micra-icon-192.png" alt="" width="40" height="40" />
            <b>Micra</b>
          </a>
          <h1>Centro de control · Bogotá</h1>
          <nav aria-label="Micra">
            <a href="/micra?app">Abrir la app</a>
            <a href="/">ACERO.press</a>
          </nav>
        </header>
        <main className="pg-panel-main">
          <ControlPanel on wide />
        </main>
      </div>
    </LanguageProvider>
  );
}

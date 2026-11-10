import { useState } from 'react';
import { LanguageProvider } from '../../i18n/LanguageContext.jsx';
import ControlPanel from './ControlPanel.jsx';
import '../../../shared/styles/termico.css';
import './pagina-dia.css';

// /micra en computador (pedido del usuario, 10 nov 2026): en vez de la app del celular en una
// columna angosta, el centro de control a pantalla completa. El celular sigue abriendo la app;
// en computador la app queda a un toque («Abrir la app», /micra?app). También en /micra/panel.
// La regla de la ruta vive en main.jsx.
// Dos pieles: HUD (pedido del usuario, 10 nov 2026: «algo que Tony Stark usaría») y la sobria
// de flota (pedida el mismo día). Arranca en HUD; lo escogido se queda en este navegador.
const SKIN_KEY = 'micra_panel_skin';
const savedSkin = () => { try { return localStorage.getItem(SKIN_KEY) === 'sobria' ? 'sobria' : 'hud'; } catch { return 'hud'; } };

export default function MicraPanelPage() {
  const [skin, setSkin] = useState(savedSkin);
  const hud = skin === 'hud';
  const toggle = () => {
    const next = hud ? 'sobria' : 'hud';
    setSkin(next);
    try { localStorage.setItem(SKIN_KEY, next); } catch { /* sin almacenamiento: vale por esta visita */ }
  };
  return (
    <LanguageProvider>
      <div className={`pg-panel-page${hud ? ' is-hud' : ''}`} data-skin={skin}>
        <header className="pg-panel-bar">
          <a href="/" className="pg-panel-brand" aria-label="ACERO.press">
            <img src="/image/micra-icon-192.png" alt="" width="40" height="40" />
            <b>Micra</b>
          </a>
          <h1>Centro de control · Bogotá</h1>
          <nav aria-label="Micra">
            <button type="button" onClick={toggle}>{hud ? 'Vista sobria' : 'Vista HUD'}</button>
            <a href="/micra?app">Abrir la app</a>
            <a href="/">ACERO.press</a>
          </nav>
        </header>
        <main className="pg-panel-main">
          <ControlPanel on wide hud={hud} />
        </main>
      </div>
    </LanguageProvider>
  );
}

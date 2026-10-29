import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import platform from '../../micra-app/platform.js';
import { drawTicket, canvasBlob } from './ticketImage.js';
import { ticketFileName, ticketNumber, ticketText } from './ticket.js';
import { MODELS, loadPrinter, savePrinter } from './phomemo.js';
import { STATUS, printErrorText } from './printer.js';
import { waDigits } from './captions.js';

// El ticket de una venta, después de registrarla: se imprime en la Phomemo por
// Bluetooth (un toque), se manda a la app de Phomemo o a Imprimir por el menú
// del celular, o va por WhatsApp. Al final, lo que sigue en la calle: otra
// venta al mismo tintero o la ficha del siguiente.

export default function TicketSheet({ rec, tintero = null, docked, onClose, onNewSale, onNewSurvey }) {
  const canvasRef = useRef(null);
  const [printer, setPrinter] = useState(() => loadPrinter(typeof localStorage !== 'undefined' ? localStorage : null));
  const [status, setStatus] = useState(null); // texto de lo que está pasando
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'ble' | 'share' | 'wa'
  const [phone, setPhone] = useState(rec.phone ?? '');
  const [askPhone, setAskPhone] = useState(false);
  const ble = platform.printer.available();

  useEffect(() => {
    if (canvasRef.current) drawTicket(canvasRef.current, { rec, tintero }, { dots: printer.dots });
  }, [rec, tintero, printer.dots]);

  const pickModel = (dots) => {
    const next = { ...printer, dots };
    setPrinter(next);
    savePrinter(localStorage, next);
  };

  const printBle = async () => {
    setBusy('ble');
    setError(null);
    try {
      const device = await platform.printer.print(canvasRef.current, {
        dots: printer.dots,
        printerId: printer.id,
        onStatus: (k) => setStatus(STATUS[k]),
      });
      if (device?.id) {
        const next = { ...printer, id: device.id, name: device.name ?? printer.name };
        setPrinter(next);
        savePrinter(localStorage, next);
      }
    } catch (e) {
      setStatus(null);
      setError(printErrorText(e));
    } finally {
      setBusy(null);
    }
  };

  const shareFile = async () => {
    setBusy('share');
    setError(null);
    try {
      const blob = await canvasBlob(canvasRef.current);
      const opened = await platform.shareImage({ blob, fileName: ticketFileName(rec), title: `Ticket ${ticketNumber(rec.orderId)}`, text: 'Ticket de ACERO.press' });
      setStatus(opened ? null : 'El ticket se descargó como imagen.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const whatsapp = () => {
    const digits = waDigits(phone);
    if (!digits) { setAskPhone(true); return; }
    setError(null);
    platform.openExternal(`https://wa.me/${digits}?text=${encodeURIComponent(ticketText({ rec, tintero }))}`);
  };

  return (
    <Sheet title="Ticket" aside={<span className="msheet-total">N.º {ticketNumber(rec.orderId)}</span>} onClose={onClose} docked={docked} size="tall" label={`Ticket ${ticketNumber(rec.orderId)}`}
      footer={(
        <>
          {error && <p className="msheet-notice is-err" role="alert">{error}</p>}
          {status && !error && <p className="msheet-notice is-ok" role="status">{status}</p>}
          <div className="mtk-actions">
            {ble && (
              <button type="button" className="msheet-btn is-primary is-big" disabled={!!busy} onClick={printBle}>
                {busy === 'ble' ? 'Imprimiendo…' : `🖨 Imprimir en la Phomemo${printer.name ? ` · ${printer.name}` : ''}`}
              </button>
            )}
            <button type="button" className={`msheet-btn ${ble ? '' : 'is-primary'} is-big`} disabled={!!busy} onClick={shareFile}>
              {busy === 'share' ? 'Abriendo…' : ble ? 'Imprimir con la app de Phomemo' : 'Imprimir · compartir'}
            </button>
            <button type="button" className="msheet-btn" disabled={!!busy} onClick={whatsapp}>Enviar por WhatsApp</button>
          </div>
          {askPhone && (
            <div className="msheet-row">
              <input className="msheet-input" type="tel" inputMode="tel" placeholder="300 123 4567" aria-label="WhatsApp del cliente" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
              <button type="button" className="msheet-btn" onClick={whatsapp}>Enviar</button>
            </div>
          )}
          <div className="mtk-next">
            <button type="button" className="msheet-btn is-ghost" onClick={onNewSale}>Nueva venta</button>
            <button type="button" className="msheet-btn is-ghost" onClick={onNewSurvey}>Nueva encuesta</button>
            <button type="button" className="msheet-btn is-ghost" onClick={onClose}>Listo</button>
          </div>
        </>
      )}
    >
      <div className="mtk-preview" data-testid="ticket-preview">
        <canvas ref={canvasRef} aria-label={`Ticket ${ticketNumber(rec.orderId)}`} />
      </div>
      <div className="msheet-group">
        <span className="msheet-label">Impresora</span>
        <div className="msheet-chips" role="listbox" aria-label="Modelo de impresora">
          {MODELS.map((m) => (
            <button key={m.id} type="button" role="option" aria-selected={printer.dots === m.dots} className={`msheet-chip ${printer.dots === m.dots ? 'on' : ''}`} onClick={() => pickModel(m.dots)}>{m.name}</button>
          ))}
        </div>
        <small className="msheet-fine">
          {ble
            ? 'Enciende la Phomemo y acércala: la primera vez el celular pregunta cuál es; después se conecta sola.'
            : 'En este navegador no hay Bluetooth: «Imprimir · compartir» abre el menú del celular y ahí eliges la app de Phomemo o Imprimir.'}
        </small>
      </div>
    </Sheet>
  );
}

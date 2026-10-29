// Imprimir un canvas en una Phomemo por Bluetooth LE. La parte del protocolo es
// phomemo.js (pura); aquí va la conversación con la impresora a través de un
// «transporte»: Web Bluetooth (Chrome en Android y computador) o el plugin de
// Capacitor dentro de la app (micra-app/native/). Un transporte es:
//   { connect(onNotify) → { id, name }, write(bytes), disconnect() }

import { toBitmap, printJob, chunks, isPrintDone, CHUNK_PAUSE_MS, SERVICE, WRITE, NOTIFY } from './phomemo.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mensajes de estado que ve quien imprime. */
export const STATUS = {
  connecting: 'Buscando la impresora…',
  printing: 'Imprimiendo…',
  done: 'Ticket impreso.',
};

/**
 * Manda el canvas a la impresora y espera a que termine.
 * `onStatus(key)` recibe 'connecting' | 'printing' | 'done'. Devuelve { id, name } de la impresora.
 */
export async function printCanvas(canvas, transport, { dots, onStatus = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const job = printJob(toBitmap(image, dots));
  onStatus('connecting');
  let done = false;
  const device = await transport.connect((bytes) => { if (isPrintDone(bytes)) done = true; });
  try {
    onStatus('printing');
    for (const c of chunks(job)) {
      await transport.write(c); // eslint-disable-line no-await-in-loop
      await wait(CHUNK_PAUSE_MS); // eslint-disable-line no-await-in-loop
    }
    // La impresora avisa cuando acabó; si no avisa (algunos modelos no lo hacen), un rato prudente
    const until = Date.now() + 8000;
    while (!done && Date.now() < until) await wait(100); // eslint-disable-line no-await-in-loop
    onStatus('done');
  } finally {
    await transport.disconnect().catch(() => {});
  }
  return device;
}

/** Web Bluetooth (Chrome en Android y en computador; Safari no lo tiene). */
export const hasWebBluetooth = () => typeof navigator !== 'undefined' && !!navigator.bluetooth;

export function webBluetoothTransport() {
  let device = null;
  let characteristic = null;
  return {
    async connect(onNotify) {
      device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE] }], optionalServices: [SERVICE] });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE);
      characteristic = await service.getCharacteristic(WRITE);
      try {
        const notify = await service.getCharacteristic(NOTIFY);
        await notify.startNotifications();
        notify.addEventListener('characteristicvaluechanged', (e) => onNotify(new Uint8Array(e.target.value.buffer)));
      } catch { /* sin avisos: se espera un rato fijo */ }
      return { id: device.id, name: device.name ?? null };
    },
    write: (bytes) => (characteristic.writeValueWithResponse ? characteristic.writeValueWithResponse(bytes) : characteristic.writeValue(bytes)),
    async disconnect() { if (device?.gatt?.connected) device.gatt.disconnect(); },
  };
}

/** Qué decirle a quien imprime cuando algo falla. */
export function printErrorText(e) {
  const m = String(e?.message || e || '');
  if (/cancel|User cancelled|chooser/i.test(m)) return 'No se eligió ninguna impresora.';
  if (/not found|No device|timed out|timeout/i.test(m)) return 'No se encontró la impresora. Enciéndela, acércala y vuelve a intentar.';
  if (/Bluetooth|BLE|adapter|powered off|disabled/i.test(m)) return 'El Bluetooth del celular está apagado o sin permiso.';
  if (/GATT|disconnected|connect/i.test(m)) return 'La impresora se desconectó. Enciéndela y vuelve a intentar.';
  return m || 'No se pudo imprimir.';
}

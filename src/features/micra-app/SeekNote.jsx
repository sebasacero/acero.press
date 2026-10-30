import { useState } from 'react';
import { seekOff, setSeekOff } from './seek.js';
import platform from './platform.js';

/** La línea bajo «Cerca de mí»: qué se comparte (la zona, no el punto) y cómo apagarlo. */
export default function SeekNote() {
  const [off, setOff] = useState(seekOff);
  const toggle = () => { setSeekOff(!off); setOff(!off); };
  return (
    <p className="mapp-fine mapp-seek-note" data-testid="seek-note">
      {off
        ? 'No le muestras tu zona a los baristas.'
        : 'Con «Cerca de mí», tu zona aproximada (unos 400 m) ayuda a los baristas a saber dónde quieren café. Nunca tu ubicación exacta ni tu nombre.'}
      {' '}<button type="button" className="mapp-link" onClick={toggle}>{off ? 'Mostrarla' : 'No mostrar mi zona'}</button>
      {' · '}<a className="mapp-link" href={platform.siteUrl('/privacidad#zona')} target="_blank" rel="noreferrer">Cómo lo usamos</a>
    </p>
  );
}

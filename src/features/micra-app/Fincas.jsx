import { useEffect, useState } from 'react';
import platform from './platform.js';
import { fetchAppConfig } from '../../shared/lib/appConfig.js';
import { OFERTA, readOferta, readRefParams, rememberRef, readRef, inviteUrl, inviteText } from './presencia.js';

// /micra/fincas: la oferta de Micra para las fincas cafeteras (9 nov 2026, pedido del usuario).
// Solo 1 a 3 de cada 100 fincas tienen su propia cuenta en redes: Micra les da un perfil
// propio y baristas que les compran por kilo, gratis. Llega por un enlace de invitación
// (?ref=… de un comité, una cooperativa o el equipo; &m=1 si la finca salió del sorteo
// de la muestra) que se guarda para contar de dónde vino cada finca en el estudio.
// Los textos se pueden cambiar en app_config `micra_fincas_oferta`.

export default function Fincas({ go }) {
  const [o, setO] = useState(OFERTA);
  const [ref] = useState(() => {
    const r = readRefParams(window.location.search);
    if (r) rememberRef(r);
    return r ?? readRef();
  });
  useEffect(() => { fetchAppConfig('micra_fincas_oferta', null).then((v) => setO(readOferta(v))).catch(() => {}); }, []);
  // Quien invita a otra finca pasa su mismo código: así se ve qué comité o feria la trajo
  const share = () => {
    const url = inviteUrl(platform.siteUrl(''), ref?.ref ?? 'finca-invita');
    platform.openExternal(`https://wa.me/?text=${encodeURIComponent(inviteText({ url }))}`);
  };
  return (
    <div className="mapp-client mapp-origen mapp-fincas" data-testid="fincas">
      <section className="mapp-ohead">
        <button type="button" className="mapp-back" onClick={() => go('/micra/origen')}>‹ Marcas y fincas</button>
        <div className="mapp-ohead-row">
          <div><p className="mapp-ohead-kicker">Para caficultores</p><h1 className="mapp-ohead-title">{o.titulo}</h1></div>
        </div>
      </section>
      <section className="mapp-glass mapp-fincas-gap" data-testid="fincas-gap">
        <p>{o.cifra}</p>
        <p className="mapp-fincas-price"><b>{o.precio}</b></p>
      </section>
      <ul className="mapp-fincas-benefits">
        {o.beneficios.map((b) => (
          <li key={b.title}><span aria-hidden="true">{b.icon}</span><span><b>{b.title}</b><small>{b.text}</small></span></li>
        ))}
      </ul>
      <p className="mapp-kicker">Cómo entras</p>
      <ol className="mapp-fsteps-list">{o.pasos.map((p) => <li key={p}>{p}</li>)}</ol>
      <button type="button" className="mapp-btn is-cta" onClick={() => go('/micra/finca')} data-testid="fincas-start">Crear mi finca</button>
      <button type="button" className="mapp-btn is-ghost" onClick={share} data-testid="fincas-share">Invitar a otra finca por WhatsApp</button>
      <p className="mapp-fine">Micra es de ACERO.press, en Bogotá. Tu celular y tu nombre solo los ve el equipo.</p>
    </div>
  );
}

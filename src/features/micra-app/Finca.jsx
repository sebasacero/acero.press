import { useEffect, useState } from 'react';
import * as api from './api.js';
import platform from './platform.js';
import { money } from './micraApp.js';
import { FINCA_STEPS, VARIEDADES, PROCESOS, emptyFinca, fincaMissing, fincaPreview, fincaText, readFinca, writeFinca, pergaminoKilo, cupsPerKilo } from './origen.js';
import { readPrices } from './feed.js';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { SellerMark } from './Origen.jsx';
import { CANALES, VENTAS, INTERES, toggleCanal, presenciaPayload, readRef, readRefParams, rememberRef } from './presencia.js';

// El caficultor crea su finca (7 nov 2026, pedido del usuario): cuatro pasos cortos (quién,
// la finca, el primer lote, listo). El borrador se queda en el celular y al final sale por
// WhatsApp al equipo, que prueba una muestra antes de publicar: sin tabla ni cuenta todavía.
// /micra/finca/perfil muestra cómo se vería su perfil público.
// El paso «Tu finca en internet» (9 nov 2026) mide la presencia digital de las fincas:
// con su permiso, las respuestas (sin nombres) van a micra_finca_presencia_add.

/** Las respuestas de «Tu finca en internet»; el permiso del estudio es aparte y opcional. */
function PresenciaStep({ p, set }) {
  const upd = (k) => (v) => set({ ...p, [k]: v });
  const show = p.canales.includes('instagram') || p.canales.includes('web') || p.canales.includes('tienda');
  return (
    <div className="mapp-fform" data-testid="finca-internet">
      <p className="mapp-kicker" id="f-canales">¿Qué tiene tu finca en internet? Marca todo lo que tengas.</p>
      <div className="mapp-chips is-wrap" role="group" aria-labelledby="f-canales">
        {CANALES.map((c) => (
          <button key={c.id} type="button" aria-pressed={p.canales.includes(c.id)} className={p.canales.includes(c.id) ? 'on' : ''} onClick={() => upd('canales')(toggleCanal(p.canales, c.id))}>{c.label}</button>
        ))}
      </div>
      {show && (
        <>
          <Field id="f-ig" label="Usuario de Instagram (opcional)" value={p.ig} onChange={upd('ig')} hint="Como @fincalaesperanza" />
          <Field id="f-web" label="Página web (opcional)" value={p.web} onChange={upd('web')} inputMode="url" />
        </>
      )}
      <p className="mapp-kicker">¿A quién le vendes hoy la mayor parte?</p>
      <div className="mapp-chips is-wrap" role="radiogroup" aria-label="A quién le vendes">
        {VENTAS.map((v) => <button key={v.id} type="button" role="radio" aria-checked={p.venta === v.id} className={p.venta === v.id ? 'on' : ''} onClick={() => upd('venta')(v.id)}>{v.label}</button>)}
      </div>
      <p className="mapp-kicker">¿Te gustaría que baristas de Bogotá te compren directo?</p>
      <div className="mapp-chips" role="radiogroup" aria-label="Vender a baristas">
        {INTERES.map((v) => <button key={v.id} type="button" role="radio" aria-checked={p.interes === v.id} className={p.interes === v.id ? 'on' : ''} onClick={() => upd('interes')(v.id)}>{v.label}</button>)}
      </div>
      <label className="mapp-check" htmlFor="f-consent">
        <input id="f-consent" type="checkbox" checked={p.consent} onChange={(e) => upd('consent')(e.target.checked)} />
        <span>Acepto que Micra guarde estas respuestas, sin mi nombre ni el de la finca, para el estudio de fincas cafeteras (Ley 1581). Puedo pedir que las borren por WhatsApp.</span>
      </label>
    </div>
  );
}

function Field({ id, label, value, onChange, hint, type = 'text', inputMode }) {
  return (
    <label className="mapp-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <small className="mapp-ffield-hint">{hint}</small>}
    </label>
  );
}

export function FincaWizard({ go }) {
  const [d, setD] = useState(() => readFinca() ?? emptyFinca());
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [team, setTeam] = useState(null);
  const [carga, setCarga] = useState(null);
  const [saved, setSaved] = useState(null);
  const last = FINCA_STEPS.length - 1;
  // El enlace de invitación (/micra/finca?ref=…) también vale aquí
  useEffect(() => { const r = readRefParams(window.location.search); if (r) rememberRef(r); }, []);
  useEffect(() => { api.teamWhatsApp().then(setTeam).catch(() => setTeam('573152125327')); }, []);
  useEffect(() => {
    supabase.from('app_config').select('key, value').in('key', ['micra_precio_carga']).then(({ data }) => setCarga(readPrices(Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))).carga)).catch(() => {});
  }, []);
  useEffect(() => { writeFinca(d); }, [d]);
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const missing = fincaMissing(d, step);
  const s = FINCA_STEPS[step];
  const next = () => { if (missing.length) { setTried(true); return; } setTried(false); setStep((n) => Math.min(FINCA_STEPS.length - 1, n + 1)); };
  const back = () => (step === 0 ? go('/micra/origen') : setStep((n) => n - 1));
  // Al llegar al final, con permiso, las respuestas van al estudio (una vez por visita; la base no repite la finca)
  useEffect(() => {
    if (step !== last || saved || !d.presencia?.consent) return;
    setSaved('enviando');
    api.fincaPresenciaAdd(presenciaPayload(d, d.presencia, readRef()))
      .then((r) => setSaved(r?.saved ? 'ok' : 'no'))
      .catch((e) => setSaved(e.missing ? 'no' : 'error'));
  }, [step, last, saved, d]);
  const pergamino = pergaminoKilo(carga);
  const send = `https://wa.me/${team}?text=${encodeURIComponent(fincaText(d))}`;
  return (
    <div className="mapp-client mapp-origen mapp-finca" data-testid="finca">
      <section className="mapp-ohead" data-testid="finca-head">
        <button type="button" className="mapp-back" onClick={back}>‹ {step === 0 ? 'Marcas y fincas' : 'Atrás'}</button>
        <div className="mapp-ohead-row">
          <div><p className="mapp-ohead-kicker">Caficultor · paso {step + 1} de {FINCA_STEPS.length}</p><h1 className="mapp-ohead-title">{s.title}</h1></div>
        </div>
        <div className="mapp-fsteps" aria-hidden="true">{FINCA_STEPS.map((x, i) => <i key={x.id} className={i <= step ? 'on' : ''} />)}</div>
      </section>

      {step === 0 && (
        <div className="mapp-fform">
          <Field id="f-owner" label="Tu nombre" value={d.owner} onChange={set('owner')} />
          <Field id="f-name" label="Finca" value={d.name} onChange={set('name')} />
          <Field id="f-city" label="Municipio" value={d.city} onChange={set('city')} hint="Como «Pitalito, Huila»" />
          <p className="mapp-fine">Lo que compartes con baristas y clientes: finca, municipio y altura. Tu celular solo lo ve el equipo.</p>
        </div>
      )}
      {step === 1 && (
        <div className="mapp-fform">
          <Field id="f-alt" label="Altura (m s. n. m.)" value={d.altitude} onChange={set('altitude')} inputMode="numeric" />
          <Field id="f-ha" label="Hectáreas en café" value={d.hectares} onChange={set('hectares')} inputMode="decimal" />
          <Field id="f-since" label="Desde qué año" value={d.since} onChange={set('since')} inputMode="numeric" />
        </div>
      )}
      {step === 2 && (
        <div className="mapp-fform">
          <p className="mapp-kicker">Variedad</p>
          <div className="mapp-chips" role="radiogroup" aria-label="Variedad">
            {VARIEDADES.map((v) => <button key={v} type="button" role="radio" aria-checked={d.variety === v} className={d.variety === v ? 'on' : ''} onClick={() => set('variety')(v)}>{v}</button>)}
          </div>
          <p className="mapp-kicker">Proceso</p>
          <div className="mapp-chips" role="radiogroup" aria-label="Proceso">
            {PROCESOS.map((v) => <button key={v} type="button" role="radio" aria-checked={d.process === v} className={d.process === v ? 'on' : ''} onClick={() => set('process')(v)}>{v}</button>)}
          </div>
          <Field id="f-kg" label="Kilos disponibles (tostado)" value={d.kg} onChange={set('kg')} inputMode="numeric" />
          <Field id="f-kilo" label="Precio por kilo al barista" value={d.kilo} onChange={set('kilo')} inputMode="numeric" hint={pergamino ? `La carga FNC hoy equivale a ${money(pergamino)} el kilo en pergamino; un kilo tostado da ${cupsPerKilo()} tazas.` : `Un kilo tostado da ${cupsPerKilo()} tazas.`} />
          <Field id="f-notes" label="Notas de taza (opcional)" value={d.notes} onChange={set('notes')} hint="Como «panela, naranja, cuerpo medio»" />
          <button type="button" className="mapp-btn is-ghost" onClick={() => go('/micra/camara')}>📷 Foto del lote y del empaque</button>
        </div>
      )}
      {step === 3 && <PresenciaStep p={d.presencia} set={set('presencia')} />}
      {step === last && (
        <div className="mapp-fform">
          <section className="mapp-glass mapp-fdone">
            <p className="mapp-kicker">Así queda</p>
            <h2 className="mapp-title is-small">{fincaPreview(d).name}</h2>
            <p>{fincaPreview(d).city}{fincaPreview(d).altitude ? ` · ${fincaPreview(d).altitude.toLocaleString('es-CO')} m` : ''}</p>
            {fincaPreview(d).lots[0] && <p><b>{fincaPreview(d).lots[0].name}</b> · {d.kg} kg · {money(fincaPreview(d).lots[0].kilo)} el kilo</p>}
            <ol className="mapp-fsteps-list">
              <li>Mándanos tu finca por WhatsApp.</li>
              <li>El equipo prueba una muestra de tu lote y te llama.</li>
              <li>Con el sello «Probado por el equipo», tu finca sale en Micra y los baristas te piden por kilo.</li>
            </ol>
          </section>
          {saved === 'ok' && <p className="mapp-fine" data-testid="finca-study-ok">Tus respuestas quedaron en el estudio de fincas, sin tu nombre. Gracias.</p>}
          <a className="mapp-btn is-cta" href={send} target="_blank" rel="noopener noreferrer" data-testid="finca-send">Mandar mi finca por WhatsApp</a>
          <button type="button" className="mapp-btn is-ghost" onClick={() => go('/micra/finca/perfil')} data-testid="finca-preview">Ver cómo se vería mi perfil</button>
        </div>
      )}
      {step < last && (
        <>
          {tried && missing.length > 0 && <p className="mapp-notice" role="alert" data-testid="finca-missing">Falta {missing.join(', ')}.</p>}
          <button type="button" className="mapp-btn is-cta" onClick={next} data-testid="finca-next">Siguiente →</button>
        </>
      )}
    </div>
  );
}

/** /micra/finca/perfil: cómo se vería su perfil público con lo que escribió. */
export function FincaPreview({ go }) {
  const d = readFinca();
  const s = fincaPreview(d ?? emptyFinca());
  const lot = s.lots[0];
  return (
    <div className="mapp-client mapp-origen" data-testid="finca-preview-page">
      <section className="mapp-ohead" data-testid="seller-head">
        <button type="button" className="mapp-back" onClick={() => go('/micra/finca')}>‹ Mi finca</button>
        <div className="mapp-ohead-row">
          <div><p className="mapp-ohead-kicker">{[s.city, s.altitude ? `${s.altitude.toLocaleString('es-CO')} m` : null].filter(Boolean).join(' · ') || 'Tu finca'}</p><h1 className="mapp-ohead-title">{s.name}</h1></div>
          <span className="mapp-ohead-pill">En revisión</span>
        </div>
      </section>
      <section className="mapp-ocover is-finca" aria-hidden="true"><SellerMark s={s} big /></section>
      {s.owner && (
        <div className="mapp-orow is-static">
          <span className="mapp-omark is-finca is-ini" aria-hidden="true">{s.owner.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
          <span className="mapp-orow-txt"><b>{s.owner}</b><small>{['Caficultor', s.hectares ? `${s.hectares.toLocaleString('es-CO')} ha` : null, s.since ? `desde ${s.since}` : null].filter(Boolean).join(' · ')}</small></span>
        </div>
      )}
      <dl className="mapp-okv">
        <div><dd>{s.lots.length}</dd><dt>{s.lots.length === 1 ? 'lote' : 'lotes'}</dt></div>
        <div><dd>0</dd><dt>baristas</dt></div>
        <div><dd>{cupsPerKilo()}</dd><dt>tazas por kilo</dt></div>
      </dl>
      <p className="mapp-kicker">Lotes disponibles</p>
      {lot ? (
        <ul className="mapp-olots">
          <li>
            <span className="mapp-obag" aria-hidden="true">1 kg</span>
            <span className="mapp-orow-txt"><b>{lot.name}{lot.kg ? ` · ${lot.kg} kg` : ''}</b><small>{lot.notes || 'Sin notas de taza todavía'}</small><span className="mapp-oseal is-text is-wait">Esperando la prueba del equipo</span></span>
            <span className="mapp-oprice"><b>{money(lot.kilo)}</b><small>por kilo</small></span>
          </li>
        </ul>
      ) : <p className="mapp-fine">Todavía no has escrito tu primer lote.</p>}
      <p className="mapp-fine">Así te verán los baristas cuando el equipo pruebe tu café. Lo que escribiste se queda en este celular hasta entonces.</p>
      <button type="button" className="mapp-btn is-cta" onClick={() => go('/micra/finca')}>Volver a mi finca</button>
      <button type="button" className="mapp-btn is-ghost" onClick={() => platform.openExternal(platform.siteUrl('/escuela'))}>Qué buscan los baristas: la Escuela</button>
    </div>
  );
}

export default FincaWizard;

import { useCallback, useEffect, useState } from 'react';
import * as api from './api.js';
import { adDraft, ctr, PLACEMENTS, AUDIENCES } from './ads.js';
import { bogota } from './micraApp.js';
import { shrinkPhoto } from './PostComposer.jsx';

// Equipo › Hoy › Anuncios (etapa 1, 20261031190000_micra_ads.sql): el equipo
// carga el anuncio que vendió (por fechas, como un paquete semanal), lo pausa y
// ve vistas, toques y la cuenta de toques por cada 100 vistas. Las cifras son
// agregadas: nunca quién lo vio.

const LABEL = Object.fromEntries([...PLACEMENTS, ...AUDIENCES]);
const EMPTY = { advertiser: '', title: '', body: '', image_url: '', cta_label: 'Ver más', cta_url: '', placement: 'feed', audience: 'all', hour_from: '', hour_to: '', starts_on: '', ends_on: '' };
const fecha = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function stateOf(a, today) {
  if (!a.active) return ['Pausado', 'is-off'];
  if (today < a.starts_on) return ['Programado', 'is-soon'];
  if (today > a.ends_on) return ['Terminó', 'is-off'];
  return ['Al aire', 'is-live'];
}

function AdForm({ initial, onSaved, onCancel }) {
  const today = bogota().day;
  const [f, setF] = useState(() => ({ ...EMPTY, starts_on: today, ...(initial ?? {}), hour_from: initial?.hour_from ?? '', hour_to: initial?.hour_to ?? '' }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError('La imagen va en JPG, PNG o WebP.'); return; }
    setBusy(true);
    setError(null);
    try { setF((o) => ({ ...o, image_url: '' })); const url = await api.uploadAdImage(await shrinkPhoto(file)); setF((o) => ({ ...o, image_url: url })); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const save = async (e) => {
    e.preventDefault();
    const d = adDraft(f, today);
    if (d.error) { setError(d.error); return; }
    setBusy(true);
    setError(null);
    try { await api.adSave(initial?.id ?? null, d.ad); onSaved(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <form className="mapp-glass mapp-adform" onSubmit={save} data-testid="ad-form">
      <p className="mapp-cota">{initial?.id ? 'Cambiar anuncio' : 'Nuevo anuncio'}</p>
      <label className="mapp-field"><span>Anunciante</span><input value={f.advertiser} onChange={set('advertiser')} maxLength={60} placeholder="Panadería La 85" /></label>
      <label className="mapp-field"><span>Título</span><input value={f.title} onChange={set('title')} maxLength={80} placeholder="Pan de bono recién salido" /></label>
      <label className="mapp-field"><span>Texto (opcional)</span><textarea value={f.body} onChange={set('body')} maxLength={240} rows={2} /></label>
      <div className="mapp-adform-img">
        {f.image_url && <img src={f.image_url} alt="La imagen del anuncio" />}
        <label className="mapp-btn is-small is-ghost">
          {f.image_url ? 'Cambiar imagen' : 'Subir imagen'}
          <input type="file" accept="image/*" onChange={pickImage} hidden data-testid="ad-image" />
        </label>
      </div>
      <label className="mapp-field"><span>Texto del botón</span><input value={f.cta_label} onChange={set('cta_label')} maxLength={24} /></label>
      <label className="mapp-field"><span>Enlace (https://) o celular de WhatsApp</span><input value={f.cta_url} onChange={set('cta_url')} inputMode="url" placeholder="https://… o 300 123 4567" /></label>
      <div className="mapp-chips" role="group" aria-label="Formato">
        {PLACEMENTS.map(([id, label]) => <button key={id} type="button" className={f.placement === id ? 'on' : ''} aria-pressed={f.placement === id} onClick={() => setF((o) => ({ ...o, placement: id }))}>{label}</button>)}
      </div>
      <div className="mapp-chips" role="group" aria-label="Para quién">
        {AUDIENCES.map(([id, label]) => <button key={id} type="button" className={f.audience === id ? 'on' : ''} aria-pressed={f.audience === id} onClick={() => setF((o) => ({ ...o, audience: id }))}>{label}</button>)}
      </div>
      <div className="mapp-adform-row">
        <label className="mapp-field"><span>Desde</span><input type="date" value={f.starts_on} onChange={set('starts_on')} /></label>
        <label className="mapp-field"><span>Hasta</span><input type="date" value={f.ends_on} onChange={set('ends_on')} data-testid="ad-ends" /></label>
      </div>
      <div className="mapp-adform-row">
        <label className="mapp-field"><span>Franja: desde (hora)</span><input inputMode="numeric" value={f.hour_from} onChange={set('hour_from')} placeholder="Todo el día" /></label>
        <label className="mapp-field"><span>hasta (hora)</span><input inputMode="numeric" value={f.hour_to} onChange={set('hour_to')} placeholder="—" /></label>
      </div>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <span className="mapp-row-btns">
        <button type="submit" className="mapp-btn is-small is-cta" disabled={busy}>{busy ? 'Un momento…' : 'Guardar'}</button>
        <button type="button" className="mapp-link" onClick={onCancel} disabled={busy}>Cancelar</button>
      </span>
      <p className="mapp-fine">Sale marcado «Patrocinado». Revisa que no prometa lo que no es (Estatuto del Consumidor) y factura con IVA.</p>
    </form>
  );
}

export default function AdsPanel() {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null); // {} nuevo · el anuncio para cambiarlo
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api.adsAdmin().then((l) => setList(l ?? [])).catch((e) => { setList(e.missing ? null : []); if (!e.missing) setError(e.message); }), []);
  useEffect(() => { load(); }, [load]);
  // Sin la migración, el panel no sale
  if (list === null && !error) return null;
  const today = bogota().day;
  const live = (list ?? []).filter((a) => stateOf(a, today)[0] === 'Al aire').length;
  const toggle = async (a) => {
    setBusy(a.id);
    try { await api.adToggle(a.id, !a.active); await load(); } catch (e) { setError(e.message); }
    setBusy(null);
  };

  return (
    <section className="mapp-glass mapp-adspanel" aria-label="Anuncios" data-testid="ads-panel">
      <header className="mapp-adspanel-head">
        <p className="mapp-cota">Anuncios · {live} al aire</p>
        {!editing && <button type="button" className="mapp-btn is-small" onClick={() => setEditing({})} data-testid="ad-new">＋ Nuevo anuncio</button>}
      </header>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      {editing && <AdForm initial={editing.id ? editing : null} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />}
      {(list ?? []).length === 0 && !editing && <p className="mapp-muted">Todavía no hay anuncios. Cuando vendas uno (por ejemplo, una semana en Hoy), cárgalo aquí.</p>}
      <ul className="mapp-adlist">
        {(list ?? []).map((a) => {
          const [label, tone] = stateOf(a, today);
          return (
            <li key={a.id} data-testid="ad-row">
              <div className="mapp-adlist-top">
                <b>{a.title}</b>
                <span className={`mapp-adstate ${tone}`}>{label}</span>
              </div>
              <small>{a.advertiser} · {LABEL[a.placement]} · {LABEL[a.audience]} · {fecha(a.starts_on)} a {fecha(a.ends_on)}{a.hour_from != null ? ` · ${a.hour_from}–${a.hour_to} h` : ''}</small>
              <dl className="mapp-adstats">
                <div><dd>{a.views.toLocaleString('es-CO')}</dd><dt>vistas</dt></div>
                <div><dd>{a.taps.toLocaleString('es-CO')}</dd><dt>toques</dt></div>
                <div><dd>{ctr(a.views, a.taps)}</dd><dt>toques por 100</dt></div>
                <div><dd>{a.views_today.toLocaleString('es-CO')}</dd><dt>vistas hoy</dt></div>
              </dl>
              <span className="mapp-row-btns">
                <button type="button" className="mapp-btn is-small is-ghost" onClick={() => toggle(a)} disabled={busy === a.id}>{a.active ? 'Pausar' : 'Poner al aire'}</button>
                <button type="button" className="mapp-link" onClick={() => setEditing(a)}>Cambiar</button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

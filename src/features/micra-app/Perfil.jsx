import { useEffect, useState } from 'react';
import { initials, menuOf, windowLabel, baristaPath, cupsLabel } from './micraApp.js';
import { streakLabel, lessonPath, LEVELS } from './motivation.js';
import { lessonsFor } from '../school/lessons.js';
import { readSeen } from '../school/progress.js';
import { maskPhone, signInMethod, METHOD_LABEL, signOutBlock, blockText, keysToClear, clearStored } from './perfil.js';
import { seekOff, setSeekOff } from './seek.js';
import * as api from './api.js';
import platform from './platform.js';
import { StampsCard } from './Loyalty.jsx';
import { ProductGrid, PayMethods } from './BaristaFlow.jsx';
import { methodsLabel } from './flow.js';

// «Mi perfil» y «Cerrar sesión» de Micra, para el barista, el cliente (sin
// cuenta: lo que guarda el celular) y el equipo. Llega aparte (la app está al
// borde del límite del bundle). Las confirmaciones van dentro de la página:
// window.confirm no es confiable en la app instalada (WebView).
// Lo puro (celular a medias, qué se borra, cuándo no se deja salir) en perfil.js.

const store = () => { try { return window.localStorage; } catch { return null; } };
const fecha = (iso) => new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' });

function useUser() {
  const [user, setUser] = useState(undefined); // undefined: cargando · null: sin sesión
  useEffect(() => { api.currentUser().then(setUser).catch(() => setUser(null)); }, []);
  return user;
}

function Privacy() {
  return (
    <p className="mapp-fine">
      Tus datos se tratan según la Ley 1581 de 2012: puedes conocerlos, corregirlos o pedir que los borremos.{' '}
      <a className="mapp-link" href={platform.siteUrl('/privacidad')} target="_blank" rel="noreferrer" data-testid="privacy-link">Política de privacidad</a>
    </p>
  );
}

/** Una fila de dato: etiqueta a la izquierda, valor a la derecha. */
function Row({ label, children, testid }) {
  return (
    <div className="mapp-prow">
      <dt>{label}</dt>
      <dd data-testid={testid}>{children}</dd>
    </div>
  );
}

/**
 * La confirmación dentro de la página. `block`: lo que impide salir (no hay botón
 * para confirmar, solo reintentar). `children`: lo que se explica antes.
 */
function Confirm({ title, children, confirmLabel, onConfirm, onCancel, busy, block, onRetry, error }) {
  return (
    <section className="mapp-glass mapp-confirm" role="alertdialog" aria-label={title} data-testid="signout-confirm">
      <p className="mapp-cota">{title}</p>
      {block ? <p className="mapp-error" role="alert" data-testid="signout-block">{blockText(block)}</p> : children}
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <span className="mapp-row-btns">
        {block
          ? onRetry && <button type="button" className="mapp-btn is-small" onClick={onRetry} disabled={busy}>{busy ? 'Subiendo…' : 'Reintentar subir'}</button>
          : <button type="button" className="mapp-btn is-small is-cta" onClick={onConfirm} disabled={busy}>{busy ? 'Un momento…' : confirmLabel}</button>}
        <button type="button" className="mapp-link" onClick={onCancel} disabled={busy}>Cancelar</button>
      </span>
    </section>
  );
}

/* ── Barista ─────────────────────────────────────────────────────────── */

/**
 * Su perfil: quién es, cómo entra, horario, precios, pagos, meta y racha,
 * permisos, su enlace y cerrar sesión. Vive dentro de BaristaHome (pestaña
 * «perfil») porque cerrar sesión necesita lo de ahí: «Ya volví», el recorrido y
 * la cola de ventas sin subir.
 */
export function BaristaProfile({ day, asId = null, trip, live, pending, flush, onReload, renderPrices, go, streak, goal, board, extras = null, menu: fullMenu = null, onExtras }) {
  const own = !asId;
  const user = useUser();
  const [profile, setProfile] = useState(null);
  const [publicCard, setPublicCard] = useState(null);
  const [edit, setEdit] = useState(null); // 'prices' | 'pay'
  const [confirm, setConfirm] = useState(false);
  const [block, setBlock] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [outFailed, setOutFailed] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    let alive = true;
    api.baristaProfile(asId).then((p) => alive && setProfile(p)).catch(() => {
      // Sin la migración: el horario sale de su tarjeta pública (si es público) y los pagos de micra_barista_pay
      if (!alive) return;
      setProfile(false);
      api.listBaristas().then((l) => alive && setPublicCard((l ?? []).find((b) => b.id === day.id) ?? null)).catch(() => {});
      api.baristaPay(day.id).then((x) => alive && x && setProfile({ pay_nequi: x.nequi, pay_daviplata: x.daviplata })).catch(() => {});
    });
    return () => { alive = false; };
  }, [asId, day.id]);

  const p = profile || {};
  const hours = p.hora_inicio != null ? windowLabel(p.hora_inicio, p.hora_fin) : publicCard ? windowLabel(publicCard.hora_inicio, publicCard.hora_fin) : null;
  const phone = maskPhone(p.phone) || (own ? maskPhone(user?.phone) : '');
  const method = own ? signInMethod(user) : null;
  const menu = fullMenu ?? menuOf(day);
  const [pubBusy, setPubBusy] = useState(false);
  const [pubOverride, setPubOverride] = useState(null);
  const lessons = lessonsFor('es');
  const path = lessonPath(lessons, readSeen());
  const isPublic = pubOverride ?? extras?.public ?? p.public ?? day.public;
  const consentAt = own ? trip.consentAt : p.consent_at ?? null;
  const url = platform.siteUrl(baristaPath(day.id));
  const first = day.name.split(' ')[0];

  const openConfirm = async () => {
    setError(null);
    setOutFailed(false);
    setConfirm(true);
    // Lo que quedó sin subir se intenta subir antes de decidir
    if (pending) await flush();
    setBlock(signOutBlock(store(), 'barista'));
  };
  const retry = async () => {
    setBusy(true);
    await flush();
    setBlock(signOutBlock(store(), 'barista'));
    setBusy(false);
  };
  const signOut = async ({ force = false } = {}) => {
    setBusy(true);
    setError(null);
    // «Ya volví»: sin esto seguiría en el mapa hasta 4 horas
    if (live && !force) {
      try { await api.goOut(0, null); } catch { setOutFailed(true); setBusy(false); return; }
    }
    if (trip.recording) await trip.finish();
    const b = signOutBlock(store(), 'barista');
    if (b) { setBlock(b); setBusy(false); return; }
    await api.signOut();
    clearStored(store(), keysToClear('barista'));
    setBusy(false);
    go('/micra/barista');
  };
  const withdraw = async () => {
    setWithdrawing(true);
    setError(null);
    try {
      if (trip.recording) await trip.finish();
      await trip.consent(false);
    } catch (e) { setError(e.message); }
    setWithdrawing(false);
  };
  // Salir en el mapa: el barista lo prende o lo apaga desde aquí, cuando quiera
  const togglePublic = async () => {
    setPubBusy(true);
    setError(null);
    try { const r = await api.setPublic(!isPublic); setPubOverride(!!r?.public); onExtras?.(); } catch (e) { setError(e.missing ? 'Esto abre muy pronto: por ahora escríbele al equipo.' : e.message); }
    setPubBusy(false);
  };
  const share = () => platform.share({ title: `${first} en Micra`, text: 'Apártame tus tintos en Micra y te los tengo listos cuando pase:', url });

  return (
    <div className="mapp-profile" data-testid="barista-profile">
      <header className="mapp-phead">
        <span className="mapp-av is-big" aria-hidden="true">{initials(day.name)}</span>
        <div>
          <p className="mapp-kicker">{asId ? 'Perfil del barista' : 'Mi perfil'}</p>
          <h1 className="mapp-title is-small">{day.name}</h1>
          <p className="mapp-muted">{[p.referencia ?? day.zone, p.localidad ?? day.localidad].filter(Boolean).join(' · ') || 'Sin punto de venta todavía'}</p>
        </div>
      </header>

      <section className="mapp-glass" aria-label="Tu cuenta">
        <p className="mapp-cota">{asId ? 'Su cuenta' : 'Tu cuenta'}</p>
        <dl className="mapp-plist">
          <Row label="Celular" testid="profile-phone">{phone || 'Sin celular registrado'}</Row>
          {own && <Row label="Entras" testid="profile-method">{user === undefined ? '…' : METHOD_LABEL[method] ?? 'Con tu cuenta'}</Row>}
          <Row label="Horario">{hours ? `Sueles pasar ${hours}` : 'Sin horario'}</Row>
        </dl>
        <p className="mapp-fine">¿Cambió tu número, tu punto o tu horario? Escríbele al equipo de Micra y lo cambiamos.</p>
      </section>

      <section className="mapp-glass" aria-label="Tus precios" data-testid="profile-prices">
        <p className="mapp-cota">Lo que vendes</p>
        {menu.length === 0 && <p className="mapp-muted">Todavía no tienes precios.</p>}
        <ProductGrid menu={menu} asId={asId} extrasCount={menu.filter((m) => m.custom).length} onChanged={onExtras} />
        {edit === 'prices'
          ? renderPrices({ onSaved: () => { setEdit(null); onReload(); } })
          : <button type="button" className="mapp-link" onClick={() => setEdit('prices')}>Cambiar precios de tinto, perico y aromática</button>}
      </section>

      <section className="mapp-glass" aria-label="Cómo te pagan">
        <p className="mapp-cota">Cómo te pagan</p>
        {edit === 'pay'
          ? <PayMethods methods={extras?.payments} asId={asId} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); onExtras?.(); }} />
          : <>
            <p className="mapp-muted" data-testid="profile-pay">{extras?.payments?.length ? methodsLabel(extras.payments) : 'Efectivo'}</p>
            <button type="button" className="mapp-link" onClick={() => setEdit('pay')}>Cambiar cómo me pagan</button>
          </>}
      </section>

      <section className="mapp-glass" aria-label="Tu meta y tu racha">
        <p className="mapp-cota">Tu camino</p>
        <dl className="mapp-plist">
          <Row label="Meta del día">{goal} tazas · hoy llevas {cupsLabel(board.cups)}</Row>
          <Row label="Racha" testid="profile-streak">{streak.count > 0 ? streakLabel(streak) : 'Empieza hoy'}</Row>
          <Row label="Nivel">{LEVELS[0].id} · {LEVELS[0].name} ({path.done} de {path.total} lecciones)</Row>
        </dl>
        <span className="mapp-row-btns">
          <button type="button" className="mapp-link" onClick={() => go('/micra/barista')}>Cambiar mi meta</button>
          <button type="button" className="mapp-link" onClick={() => go('/micra/barista/aprende')}>Ir a Aprende</button>
        </span>
      </section>

      <section className="mapp-glass" aria-label="Tus permisos" data-testid="profile-consents">
        <p className="mapp-cota">Tus permisos</p>
        <dl className="mapp-plist">
          <Row label="Salir en el mapa público" testid="profile-public">{isPublic ? `Sí${p.public_at ? `, desde el ${fecha(p.public_at)}` : ''}` : 'No'}</Row>
          <Row label="Tu ubicación al salir a vender" testid="profile-location">{consentAt ? `Permitida desde el ${fecha(consentAt)}` : 'No la compartes'}</Row>
        </dl>
        <p className="mapp-fine">
          {isPublic ? 'Los clientes ven tu nombre de pila, tu punto y tus precios.' : 'Los clientes no te ven todavía. Actívalo aquí o al tocar «Salí a vender».'}
          {' '}Tu ubicación solo se usa mientras tienes activo «Salí a vender».
        </p>
        {own && (
          <button type="button" className={`mapp-btn is-small ${isPublic ? 'is-ghost' : 'is-cta'}`} onClick={togglePublic} disabled={pubBusy} data-testid="profile-public-toggle">
            {pubBusy ? 'Un momento…' : isPublic ? 'Dejar de salir en el mapa' : 'Salir en el mapa de Micra'}
          </button>
        )}
        {own && consentAt && (
          <button type="button" className="mapp-btn is-small is-stop" onClick={withdraw} disabled={withdrawing} data-testid="consent-withdraw">{withdrawing ? 'Retirando…' : 'Retirar permiso de ubicación'}</button>
        )}
      </section>

      <section className="mapp-glass mapp-share" aria-label="Tu enlace">
        <p className="mapp-cota">Pídeme por Micra</p>
        <p>Tu QR con tu dibujo (termo, vasito, carrito, sombrilla o caminando) y tu enlace: así tus clientes te encuentran y te apartan.</p>
        <code data-testid="profile-link">{url.replace(/^https?:\/\//, '')}</code>
        <span className="mapp-row-btns">
          <button type="button" className="mapp-btn is-small is-cta" onClick={() => go('/micra/barista/qr')} data-testid="profile-qr">Mi QR</button>
          <button type="button" className="mapp-btn is-small" onClick={share}>Compartir enlace</button>
          <button type="button" className="mapp-link" onClick={() => go(baristaPath(day.id))}>Ver como cliente</button>
        </span>
      </section>

      {error && <p className="mapp-error" role="alert">{error}</p>}
      <Privacy />

      {own ? (
        confirm ? (
          <Confirm
            title="Cerrar sesión"
            block={block}
            busy={busy}
            onRetry={retry}
            onCancel={() => { setConfirm(false); setBlock(null); setOutFailed(false); }}
            confirmLabel={outFailed ? 'Cerrar sesión igual' : live ? 'Ya volví y cerrar sesión' : 'Sí, cerrar sesión'}
            onConfirm={() => signOut({ force: outFailed })}
          >
            {outFailed
              ? <p className="mapp-error" role="alert">Sin señal: no pudimos avisar «Ya volví». Si cierras sesión igual, sigues en el mapa hasta las {new Date(day.live_until).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })}.</p>
              : live && <p data-testid="signout-live">Estás en <b>Salí a vender</b>. Al cerrar sesión marcamos «Ya volví» y Micra deja de usar tu ubicación.</p>}
            <p className="mapp-muted">Tus ventas, fiados y apartados quedan guardados en tu cuenta. Para volver a entrar, usa tu celular y el código del SMS.</p>
          </Confirm>
        ) : (
          <button type="button" className="mapp-btn is-ghost mapp-signout" onClick={openConfirm} data-testid="signout">Cerrar sesión</button>
        )
      ) : (
        <p className="mapp-fine">Estás actuando como {first}. Tu sesión se cierra en <button type="button" className="mapp-link" onClick={() => go('/micra/equipo/perfil')}>Equipo › Mi perfil</button>.</p>
      )}
    </div>
  );
}

/* ── Cliente ─────────────────────────────────────────────────────────── */

/**
 * El cliente no tiene cuenta: su perfil es lo que guarda este celular (nombre,
 * sus baristas, la tarjeta de sellos, la zona). Borrarlo no toca sus apartados:
 * esos quedan con el barista.
 */
export function ClientProfile({ go, who }) {
  const [name, setName] = useState(api.savedName);
  const [saved, setSaved] = useState(false);
  const [favs, setFavs] = useState(api.favorites);
  const [list, setList] = useState(null);
  const [zoneOff, setZoneOff] = useState(seekOff);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { api.listBaristas().then((l) => setList(l ?? [])).catch(() => setList([])); }, []);

  const session = who?.session ?? null;
  const team = !!(who?.barista || who?.admin);
  // Con sesión y sin ser barista ni equipo (p. ej. Google en modo cliente): cerrar sesión borra todo
  const plainSession = !!session && !team;
  const nameOf = (id) => (list ?? []).find((b) => b.id === id)?.name;

  const saveName = (e) => {
    e.preventDefault();
    api.saveName(name.trim());
    setName(name.trim());
    setSaved(true);
  };
  const removeFav = (id) => {
    const next = favs.filter((x) => x !== id);
    api.setFavorites(next);
    setFavs(next);
  };
  const toggleZone = () => { setSeekOff(!zoneOff); setZoneOff(!zoneOff); };
  const wipe = async () => {
    setBusy(true);
    clearStored(store(), keysToClear('client'));
    if (plainSession) await api.signOut();
    setName('');
    setFavs([]);
    setZoneOff(false);
    setConfirm(false);
    setDone(true);
    setBusy(false);
  };
  const wipeLabel = plainSession ? 'Cerrar sesión' : 'Borrar mis datos de este celular';

  return (
    <div className="mapp-client mapp-profile" data-testid="client-profile">
      <header className="mapp-phead">
        <span className="mapp-av is-big" aria-hidden="true">{name ? initials(name) : '☕'}</span>
        <div>
          <p className="mapp-kicker">Mi perfil · en este celular</p>
          <h1 className="mapp-title is-small">{name ? name : 'Hola'}</h1>
          <p className="mapp-muted">Sin cuenta: Micra recuerda tu nombre y tus baristas solo en este celular.</p>
        </div>
      </header>

      {done && <p className="mapp-notice" role="status" data-testid="wiped">Listo: este celular ya no guarda tus datos de Micra.{plainSession ? ' Cerraste sesión.' : ''}</p>}

      <form className="mapp-glass" onSubmit={saveName} aria-label="Tu nombre">
        <label className="mapp-field">
          <span>Tu nombre (así te llama el barista)</span>
          <input value={name} onChange={(e) => { setName(e.target.value.slice(0, 40)); setSaved(false); }} autoComplete="given-name" placeholder="Ej.: Sebas, oficina 302" />
        </label>
        <span className="mapp-row-btns">
          <button type="submit" className="mapp-btn is-small" disabled={name.trim() === api.savedName()}>Guardar nombre</button>
          {saved && <span className="mapp-fine" role="status">Guardado</span>}
        </span>
      </form>

      <section className="mapp-glass" aria-label="Mis baristas" data-testid="profile-favs">
        <p className="mapp-cota">Mis baristas · {favs.length}</p>
        {favs.length === 0 && <p className="mapp-muted">Toca ★ en la página de un barista para tenerlo arriba en la lista.</p>}
        <ul className="mapp-holds">
          {favs.map((id) => (
            <li key={id}>
              <span className="mapp-av" aria-hidden="true">{initials(nameOf(id) ?? '?')}</span>
              <div><b>{nameOf(id) ?? (list ? 'Ya no sale en Micra' : '…')}</b></div>
              <span className="mapp-hold-act">
                {nameOf(id) && <button type="button" className="mapp-link" onClick={() => go(baristaPath(id))}>Ver</button>}
                <button type="button" className="mapp-btn is-small is-stop" onClick={() => removeFav(id)} aria-label={`Quitar a ${nameOf(id) ?? 'este barista'}`}>Quitar</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {!done && <StampsCard />}

      <button type="button" className="mapp-glass mapp-nextlesson" onClick={() => go('/micra/apartados')}>
        <span className="mapp-nextlesson-ico" aria-hidden="true">☕</span>
        <span><b>Mis apartados</b><small>Lo que apartaste hoy y en qué va</small></span>
        <i aria-hidden="true">›</i>
      </button>

      <section className="mapp-glass" aria-label="Mi zona">
        <p className="mapp-cota">Mi zona</p>
        <label className="mapp-check">
          <input type="checkbox" checked={!zoneOff} onChange={toggleZone} data-testid="zone-toggle" />
          <span>Mostrar mi zona a los baristas</span>
        </label>
        <p className="mapp-fine">Con «Cerca de mí», tu zona aproximada (unos 400 m) les dice a los baristas dónde quieren café. Nunca tu ubicación exacta ni tu nombre.</p>
      </section>

      <Privacy />

      {confirm ? (
        <Confirm title={wipeLabel} busy={busy} confirmLabel={plainSession ? 'Sí, cerrar sesión' : 'Sí, borrar'} onConfirm={wipe} onCancel={() => setConfirm(false)}>
          <p>Se borra de este celular: tu nombre, tus baristas, tu tarjeta de sellos y tu preferencia de zona.</p>
          <p className="mapp-muted">Lo que apartaste sigue con el barista: págale al recibir como siempre. Desde este celular ya no lo verás ni podrás cancelarlo.</p>
        </Confirm>
      ) : (
        <button type="button" className="mapp-btn is-ghost mapp-signout" onClick={() => setConfirm(true)} data-testid="client-wipe">{wipeLabel}</button>
      )}
      {team && (
        <p className="mapp-fine">
          Tu sesión de {who.barista ? 'barista' : 'equipo'} se cierra en{' '}
          <button type="button" className="mapp-link" onClick={() => go(who.barista ? '/micra/barista/perfil' : '/micra/equipo/perfil')}>{who.barista ? 'Barista' : 'Equipo'} › Mi perfil</button>.
        </p>
      )}
    </div>
  );
}

/* ── Equipo ──────────────────────────────────────────────────────────── */

/** La sesión del dueño: con qué cuenta entró y cerrarla (sin perder fichas ni ventas sin subir). */
export function OwnerProfile({ go, onSignedOut }) {
  const user = useUser();
  const [confirm, setConfirm] = useState(false);
  const [block, setBlock] = useState(null);
  const [busy, setBusy] = useState(false);
  const method = signInMethod(user);
  const open = () => { setBlock(signOutBlock(store(), 'owner')); setConfirm(true); };
  const signOut = async () => {
    setBusy(true);
    const b = signOutBlock(store(), 'owner');
    if (b) { setBlock(b); setBusy(false); return; }
    await api.signOut();
    clearStored(store(), keysToClear('owner'));
    onSignedOut?.();
    setBusy(false);
    go('/micra');
  };
  return (
    <div className="mapp-owner mapp-profile" data-testid="owner-profile">
      <header className="mapp-phead">
        <span className="mapp-av is-big" aria-hidden="true">{initials(user?.email?.split('@')[0] ?? 'Equipo')}</span>
        <div>
          <p className="mapp-kicker">Mi perfil · equipo</p>
          <h1 className="mapp-title is-small">Tu cuenta</h1>
        </div>
      </header>
      <section className="mapp-glass" aria-label="Tu cuenta">
        <dl className="mapp-plist">
          <Row label="Cuenta" testid="owner-account">{user === undefined ? '…' : user?.email || maskPhone(user?.phone) || 'Equipo de Micra'}</Row>
          <Row label="Entras">{METHOD_LABEL[method] ?? 'Con tu cuenta'}</Row>
          <Row label="Rol">Dueño</Row>
        </dl>
        <p className="mapp-fine">Para ver Micra como un barista, usa «Actuar como» en <button type="button" className="mapp-link" onClick={() => go('/micra/equipo')}>Equipo › Hoy</button>.</p>
      </section>
      <Privacy />
      {confirm ? (
        <Confirm title="Cerrar sesión" block={block} busy={busy} onCancel={() => setConfirm(false)} confirmLabel="Sí, cerrar sesión" onConfirm={signOut}>
          <p className="mapp-muted">Sales del equipo en este celular. Las fichas y ventas ya guardadas quedan en la base.</p>
        </Confirm>
      ) : (
        <button type="button" className="mapp-btn is-ghost mapp-signout" onClick={open} data-testid="signout">Cerrar sesión</button>
      )}
    </div>
  );
}

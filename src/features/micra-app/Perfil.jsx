import { useEffect, useState } from 'react';
import { initials, menuOf, windowLabel, baristaPath, cupsLabel, bogota } from './micraApp.js';
import { streakLabel, lessonPath, LEVELS } from './motivation.js';
import { lessonsFor } from '../school/lessons.js';
import { readSeen } from '../school/progress.js';
import { maskPhone, signInMethod, METHOD_LABEL, signOutBlock, blockText, keysToClear, clearStored } from './perfil.js';
import { promoDue, promoSeen } from './promo.js';
import { seekOff, setSeekOff } from './seek.js';
import * as api from './api.js';
import platform from './platform.js';
import { StampsCard } from './Loyalty.jsx';
import { ProductGrid, PayMethods } from './BaristaFlow.jsx';
import { methodsLabel } from './flow.js';
import Termo from './Termo.jsx';
import ColdBrewPromo from './ColdBrew.jsx';
import {
  IconQr, IconShare, IconEye, IconWallet, IconTag, IconCard, IconUser, IconTarget, IconShield, IconHelp, IconLock,
  IconVideo, IconCap, IconCan, IconCup, IconHeart, IconToday, IconGift, IconPin, IconThermo, IconBag, IconClipboard,
  IconCamera, IconOut,
} from './icons.jsx';

// «Mi perfil» y «Cerrar sesión» de Micra, para el barista, el cliente (sin
// cuenta: lo que guarda el celular) y el equipo. Como el perfil de las apps de
// domicilios: el saludo arriba, una tarjeta destacada y secciones con accesos
// en cuadrícula; lo que se edita (precios, pagos, permisos, nombre, zona) se
// abre en una hoja de abajo. Llega aparte (la app está al borde del límite del
// bundle). Las confirmaciones van dentro de la página: window.confirm no es
// confiable en la app instalada (WebView).
// Lo puro (celular a medias, qué se borra, cuándo no se deja salir) en perfil.js.

const store = () => { try { return window.localStorage; } catch { return null; } };
const fecha = (iso) => new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' });
const PRIVACY = () => platform.siteUrl('/privacidad');

function useUser() {
  const [user, setUser] = useState(undefined); // undefined: cargando · null: sin sesión
  useEffect(() => { api.currentUser().then(setUser).catch(() => setUser(null)); }, []);
  return user;
}

/** El WhatsApp del equipo, para «Ayuda». */
function useHelp(text) {
  const [number, setNumber] = useState(null);
  useEffect(() => { api.teamWhatsApp().then(setNumber).catch(() => setNumber('573152125327')); }, []);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : undefined;
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

/** El saludo: el círculo, el nombre grande y «¡Hola!» debajo. */
function Hello({ av, name, sub, subTestid }) {
  return (
    <header className="mapp-hello2">
      <span className="mapp-hello2-av" aria-hidden="true">{av}</span>
      <div>
        <h1 className="mapp-hello2-name">{name}</h1>
        <p className="mapp-hello2-sub" data-testid={subTestid}>{sub}</p>
      </div>
    </header>
  );
}

/** La tarjeta destacada de arriba (como la del club): título, una línea y su botón. */
function Featured({ mark, title, text, action, onAction, testid }) {
  return (
    <section className="mapp-pclub" aria-label={title} data-testid={testid}>
      <h2><span className="mapp-pclub-mark" aria-hidden="true">{mark}</span>{title}</h2>
      <p>{text}</p>
      {action && <button type="button" className="mapp-btn is-small is-cta" onClick={onAction}>{action}</button>}
    </section>
  );
}

/** Una sección: tarjeta con su título y los accesos de a tres. */
function Group({ title, children }) {
  return (
    <section className="mapp-pgroup" aria-label={title}>
      <h2>{title}</h2>
      <div className="mapp-pgrid3">{children}</div>
    </section>
  );
}

/**
 * Un acceso: el ícono arriba y el nombre abajo. Abre una hoja o una pantalla
 * (onClick) o un enlace (href). `count` va en rojo antes del nombre; `dot`
 * avisa que falta algo.
 */
function Tile({ icon: Icon, label, onClick, href, count, dot = false, testid, external = false }) {
  const body = (
    <>
      <Icon />
      {dot && <i className="mapp-ptile-dot" aria-hidden="true" />}
      <span>{count != null && <b>{count} </b>}{label}</span>
    </>
  );
  if (href !== undefined) {
    return <a className="mapp-ptile" href={href} data-testid={testid} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}</a>;
  }
  return <button type="button" className="mapp-ptile" onClick={onClick} data-testid={testid}>{body}</button>;
}

/** La hoja de abajo con el detalle de un acceso. */
function Sheet({ title, onClose, children, testid }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label={title} data-testid={testid}>
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <section className="mapp-sheet is-scroll">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <header className="mapp-sheet-head">
          <h2 className="mapp-title is-small">{title}</h2>
          <button type="button" className="mapp-link" onClick={onClose}>Listo</button>
        </header>
        {children}
      </section>
    </div>
  );
}

/** El pie, como el de las apps: la marca y quién la hace. */
function Foot() {
  return (
    <footer className="mapp-pfoot">
      <span className="mapp-pfoot-brand"><span className="mapp-brand-mark"><Termo /></span><b>micra<i>.</i></b></span>
      <p>Una app de ACERO.press · Bogotá</p>
      <p>
        Tus datos se tratan según la Ley 1581 de 2012: puedes conocerlos, corregirlos o pedir que los borremos.{' '}
        <a className="mapp-link" href={PRIVACY()} target="_blank" rel="noreferrer" data-testid="privacy-link">Política de privacidad</a>
      </p>
    </footer>
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
 * Su perfil: el saludo, su camino de barista y los accesos (su QR, su plata,
 * sus datos, meta, permisos y ayuda) con cerrar sesión al final. Vive dentro de
 * BaristaHome (pestaña «perfil») porque cerrar sesión necesita lo de ahí: salir
 * del mapa, el recorrido y la cola de ventas sin subir.
 */
export function BaristaProfile({ day, asId = null, trip, live, pending, flush, onReload, renderPrices, go, streak, goal, board, extras = null, menu: fullMenu = null, onExtras }) {
  const own = !asId;
  const user = useUser();
  const [profile, setProfile] = useState(null);
  const [publicCard, setPublicCard] = useState(null);
  const [sheet, setSheet] = useState(null); // 'datos' | 'precios' | 'pagos' | 'meta' | 'permisos'
  const [edit, setEdit] = useState(null); // dentro de la hoja: 'prices' | 'pay'
  const [promo, setPromo] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [block, setBlock] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [outFailed, setOutFailed] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const help = useHelp(`Hola, equipo de Micra. Soy ${day.name.split(' ')[0]}, barista. Necesito ayuda con `);

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
  const where = [p.referencia ?? day.zone, p.localidad ?? day.localidad].filter(Boolean).join(' · ');
  const closeSheet = () => { setSheet(null); setEdit(null); };

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
    // Salir del mapa: sin esto seguiría ahí hasta 4 horas
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
      <Hello
        av={initials(day.name)} name={day.name}
        sub={asId ? `Perfil del barista${where ? ` · ${where}` : ''}` : `¡Hola!${where ? ` · ${where}` : ''}`}
      />

      <Featured
        testid="profile-camino" mark={LEVELS[0].id}
        title={`Barista de calle · ${LEVELS[0].name}`}
        text={`🔥 ${streak.count > 0 ? streakLabel(streak) : 'Empieza tu racha hoy'} · ${path.done} de ${path.total} lecciones`}
        action="Aprender" onAction={() => go('/micra/barista/aprende')}
      />

      <Group title="Tu negocio">
        <Tile icon={IconQr} label="Mi QR" onClick={() => go('/micra/barista/qr')} testid="profile-qr" />
        <Tile icon={IconShare} label="Compartir enlace" onClick={share} />
        <Tile icon={IconEye} label="Ver como cliente" onClick={() => go(baristaPath(day.id))} />
      </Group>

      <Group title="Tu plata">
        <Tile icon={IconWallet} label="Mi plata" onClick={() => go('/micra/barista/cuenta')} />
        <Tile icon={IconTag} label="Lo que vendo" onClick={() => setSheet('precios')} testid="tile-precios" />
        <Tile icon={IconCard} label="Cómo me pagan" onClick={() => setSheet('pagos')} testid="tile-pagos" />
      </Group>

      <Group title="Mi cuenta">
        <Tile icon={IconUser} label="Mis datos" onClick={() => setSheet('datos')} testid="tile-datos" />
        <Tile icon={IconTarget} label="Mi meta" onClick={() => setSheet('meta')} testid="tile-meta" />
        <Tile icon={IconShield} label="Permisos" onClick={() => setSheet('permisos')} dot={!isPublic || !consentAt} testid="tile-permisos" />
        <Tile icon={IconHelp} label="Ayuda" href={help} external />
        <Tile icon={IconLock} label="Privacidad" href={PRIVACY()} external />
      </Group>

      <Group title="Otros">
        <Tile icon={IconVideo} label="Video con filtro" onClick={() => go('/micra/video')} />
        <Tile icon={IconCap} label="Escuela" href={platform.siteUrl('/escuela')} />
        <Tile icon={IconCan} label="Cold brew" onClick={() => setPromo(true)} testid="tile-coldbrew" />
      </Group>

      {error && <p className="mapp-error" role="alert">{error}</p>}

      {own ? (
        confirm ? (
          <Confirm
            title="Cerrar sesión"
            block={block}
            busy={busy}
            onRetry={retry}
            onCancel={() => { setConfirm(false); setBlock(null); setOutFailed(false); }}
            confirmLabel={outFailed ? 'Cerrar sesión igual' : live ? 'Salir del mapa y cerrar sesión' : 'Sí, cerrar sesión'}
            onConfirm={() => signOut({ force: outFailed })}
          >
            {outFailed
              ? <p className="mapp-error" role="alert">Sin señal: no pudimos sacarte del mapa. Si cierras sesión igual, sigues en el mapa hasta las {new Date(day.live_until).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })}.</p>
              : live && <p data-testid="signout-live">Estás en <b>Salí a vender</b>. Al cerrar sesión te sacamos del mapa y Micra deja de usar tu ubicación.</p>}
            <p className="mapp-muted">Tus ventas, fiados y apartados quedan guardados en tu cuenta. Para volver a entrar, usa tu celular y el código del SMS.</p>
          </Confirm>
        ) : (
          <button type="button" className="mapp-btn is-ghost mapp-signout" onClick={openConfirm} data-testid="signout">Cerrar sesión</button>
        )
      ) : (
        <p className="mapp-fine">Estás actuando como {first}. Tu sesión se cierra en <button type="button" className="mapp-link" onClick={() => go('/micra/equipo/perfil')}>Equipo › Mi perfil</button>.</p>
      )}

      <Foot />

      {sheet === 'datos' && (
        <Sheet title={asId ? 'Sus datos' : 'Mis datos'} onClose={closeSheet} testid="sheet-datos">
          <dl className="mapp-plist">
            <Row label="Celular" testid="profile-phone">{phone || 'Sin celular registrado'}</Row>
            {own && <Row label="Entras" testid="profile-method">{user === undefined ? '…' : METHOD_LABEL[method] ?? 'Con tu cuenta'}</Row>}
            <Row label="Punto">{where || 'Sin punto de venta todavía'}</Row>
            <Row label="Horario">{hours ? `Sueles pasar ${hours}` : 'Sin horario'}</Row>
            <Row label="Tu enlace"><code data-testid="profile-link">{url.replace(/^https?:\/\//, '')}</code></Row>
          </dl>
          <p className="mapp-fine">¿Cambió tu número, tu punto o tu horario? Escríbele al equipo de Micra y lo cambiamos.</p>
        </Sheet>
      )}

      {sheet === 'precios' && (
        <Sheet title="Lo que vendo" onClose={closeSheet} testid="sheet-precios">
          <div data-testid="profile-prices">
            {menu.length === 0 && <p className="mapp-muted">Todavía no tienes precios.</p>}
            <ProductGrid menu={menu} asId={asId} extrasCount={menu.filter((m) => m.custom).length} onChanged={onExtras} />
            {edit === 'prices'
              ? renderPrices({ onSaved: () => { setEdit(null); onReload(); } })
              : <button type="button" className="mapp-link" onClick={() => setEdit('prices')}>Cambiar precios de tinto, perico y aromática</button>}
          </div>
        </Sheet>
      )}

      {sheet === 'pagos' && (
        <Sheet title="Cómo me pagan" onClose={closeSheet} testid="sheet-pagos">
          {edit === 'pay'
            ? <PayMethods methods={extras?.payments} asId={asId} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); onExtras?.(); }} />
            : <>
              <p className="mapp-muted" data-testid="profile-pay">{extras?.payments?.length ? methodsLabel(extras.payments) : 'Efectivo'}</p>
              <p className="mapp-fine">Tus clientes ven el medio en tu tarjeta; el número se lo das en persona.</p>
              <button type="button" className="mapp-btn is-small" onClick={() => setEdit('pay')}>Cambiar cómo me pagan</button>
            </>}
        </Sheet>
      )}

      {sheet === 'meta' && (
        <Sheet title="Mi meta" onClose={closeSheet} testid="sheet-meta">
          <dl className="mapp-plist">
            <Row label="Meta del día">{goal} tazas · hoy llevas {cupsLabel(board.cups)}</Row>
            <Row label="Racha" testid="profile-streak">{streak.count > 0 ? streakLabel(streak) : 'Empieza hoy'}</Row>
            <Row label="Nivel">{LEVELS[0].id} · {LEVELS[0].name} ({path.done} de {path.total} lecciones)</Row>
          </dl>
          <span className="mapp-row-btns">
            <button type="button" className="mapp-btn is-small" onClick={() => go('/micra/barista')}>Cambiar mi meta</button>
            <button type="button" className="mapp-link" onClick={() => go('/micra/barista/aprende')}>Ir a Aprende</button>
          </span>
        </Sheet>
      )}

      {sheet === 'permisos' && (
        <Sheet title="Permisos" onClose={closeSheet} testid="profile-consents">
          <dl className="mapp-plist">
            <Row label="Salir en el mapa público" testid="profile-public">{isPublic ? `Sí${p.public_at ? `, desde el ${fecha(p.public_at)}` : ''}` : 'No'}</Row>
            <Row label="Tu ubicación al salir a vender" testid="profile-location">{consentAt ? `Permitida desde el ${fecha(consentAt)}` : 'No la compartes'}</Row>
          </dl>
          <p className="mapp-fine">
            {isPublic ? 'Los clientes ven tu nombre de pila, tu punto y tus precios.' : 'Los clientes no te ven todavía. Actívalo aquí o al tocar «Salí a vender».'}
            {' '}Tu ubicación solo se usa mientras tienes activo «Salí a vender».
          </p>
          {error && <p className="mapp-error" role="alert">{error}</p>}
          {own && (
            <button type="button" className={`mapp-btn is-small ${isPublic ? 'is-ghost' : 'is-cta'}`} onClick={togglePublic} disabled={pubBusy} data-testid="profile-public-toggle">
              {pubBusy ? 'Un momento…' : isPublic ? 'Dejar de salir en el mapa' : 'Salir en el mapa de Micra'}
            </button>
          )}
          {own && consentAt && (
            <button type="button" className="mapp-btn is-small is-stop" onClick={withdraw} disabled={withdrawing} data-testid="consent-withdraw">{withdrawing ? 'Retirando…' : 'Retirar permiso de ubicación'}</button>
          )}
        </Sheet>
      )}

      {promo && <ColdBrewPromo onClose={() => setPromo(false)} />}
    </div>
  );
}

/* ── Cliente ─────────────────────────────────────────────────────────── */

/**
 * El cliente no tiene cuenta: su perfil es lo que guarda este celular (nombre,
 * sus baristas, la tarjeta de sellos, la zona). Borrarlo no toca sus apartados:
 * esos quedan con el barista. Al abrirlo, una vez al día, sale el banner de la
 * lata de cold brew.
 */
export function ClientProfile({ go, who }) {
  const [name, setName] = useState(api.savedName);
  const [saved, setSaved] = useState(false);
  const [favs, setFavs] = useState(api.favorites);
  const [list, setList] = useState(null);
  const [zoneOff, setZoneOff] = useState(seekOff);
  const [sheet, setSheet] = useState(null); // 'nombre' | 'baristas' | 'zona'
  const [promo, setPromo] = useState(() => promoDue(store(), bogota().day));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const help = useHelp('Hola, equipo de Micra. Necesito ayuda con ');
  useEffect(() => { api.listBaristas().then((l) => setList(l ?? [])).catch(() => setList([])); }, []);
  // Visto hoy apenas sale: aunque se cierre la app sin tocar la X, mañana vuelve
  useEffect(() => { if (promo) promoSeen(store(), bogota().day); }, [promo]);

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
  const invite = () => platform.share({ title: 'Micra', text: 'Aparta tu tinto con los baristas de la calle y te lo tienen listo cuando pasan:', url: platform.siteUrl('/micra') });
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
      <Hello av={name ? initials(name) : '☕'} name={name || 'Tu perfil'} sub="¡Hola! Micra te recuerda solo en este celular." />

      {done && <p className="mapp-notice" role="status" data-testid="wiped">Listo: este celular ya no guarda tus datos de Micra.{plainSession ? ' Cerraste sesión.' : ''}</p>}

      {/* La tarjeta destacada: los sellos (10 tazas = 1 tinto gratis) */}
      {!done && <StampsCard />}

      <Group title="Mi café">
        <Tile icon={IconCup} label="Mis apartados" onClick={() => go('/micra/apartados')} />
        <Tile icon={IconHeart} label="Mis baristas" count={favs.length || null} onClick={() => setSheet('baristas')} testid="tile-baristas" />
        <Tile icon={IconToday} label="Hoy en el café" onClick={() => go('/micra/hoy')} />
        <Tile icon={IconGift} label="Invita amigos" onClick={invite} />
      </Group>

      <Group title="Mi cuenta">
        <Tile icon={IconUser} label="Mi nombre" onClick={() => setSheet('nombre')} dot={!name} testid="tile-nombre" />
        <Tile icon={IconPin} label="Mi zona" onClick={() => setSheet('zona')} testid="tile-zona" />
        <Tile icon={IconHelp} label="Ayuda" href={help} external />
        <Tile icon={IconLock} label="Privacidad" href={PRIVACY()} external />
      </Group>

      <Group title="Otros">
        <Tile icon={IconThermo} label="Sé barista" onClick={() => go('/micra/barista')} />
        <Tile icon={IconCan} label="Cold brew" onClick={() => setPromo(true)} testid="tile-coldbrew" />
        <Tile icon={IconCap} label="Escuela" href={platform.siteUrl('/escuela')} />
        <Tile icon={IconBag} label="Tienda" href={platform.siteUrl('/#beans')} />
      </Group>

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

      <Foot />

      {sheet === 'nombre' && (
        <Sheet title="Mi nombre" onClose={() => setSheet(null)} testid="sheet-nombre">
          <form onSubmit={saveName} aria-label="Tu nombre">
            <label className="mapp-field">
              <span>Tu nombre (así te llama el barista)</span>
              <input value={name} onChange={(e) => { setName(e.target.value.slice(0, 40)); setSaved(false); }} autoComplete="given-name" placeholder="Ej.: Sebas, oficina 302" />
            </label>
            <span className="mapp-row-btns">
              <button type="submit" className="mapp-btn is-small" disabled={name.trim() === api.savedName()}>Guardar nombre</button>
              {saved && <span className="mapp-fine" role="status">Guardado</span>}
            </span>
          </form>
        </Sheet>
      )}

      {sheet === 'baristas' && (
        <Sheet title={`Mis baristas · ${favs.length}`} onClose={() => setSheet(null)} testid="profile-favs">
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
        </Sheet>
      )}

      {sheet === 'zona' && (
        <Sheet title="Mi zona" onClose={() => setSheet(null)} testid="sheet-zona">
          <label className="mapp-check">
            <input type="checkbox" checked={!zoneOff} onChange={toggleZone} data-testid="zone-toggle" />
            <span>Mostrar mi zona a los baristas</span>
          </label>
          <p className="mapp-fine">Con «Cerca de mí», tu zona aproximada (unos 400 m) les dice a los baristas dónde quieren café. Nunca tu ubicación exacta ni tu nombre.</p>
        </Sheet>
      )}

      {promo && <ColdBrewPromo onClose={() => setPromo(false)} />}
    </div>
  );
}

/* ── Equipo ──────────────────────────────────────────────────────────── */

/** La sesión del dueño: sus herramientas, con qué cuenta entró y cerrarla (sin perder fichas ni ventas sin subir). */
export function OwnerProfile({ go, onSignedOut }) {
  const user = useUser();
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [block, setBlock] = useState(null);
  const [busy, setBusy] = useState(false);
  const method = signInMethod(user);
  const account = user === undefined ? '…' : user?.email || maskPhone(user?.phone) || 'Equipo de Micra';
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
      <Hello av={initials(user?.email?.split('@')[0] ?? 'Equipo')} name="Equipo" sub={account} subTestid="owner-account" />

      <Group title="El equipo">
        <Tile icon={IconToday} label="Hoy" onClick={() => go('/micra/equipo')} />
        <Tile icon={IconClipboard} label="Estudio" onClick={() => go('/micra/estudio')} />
        <Tile icon={IconCamera} label="Cámara" onClick={() => go('/micra/camara')} />
        <Tile icon={IconPin} label="Ficha rápida" onClick={() => go('/micra/ficha')} />
        <Tile icon={IconOut} label="Panel" href={platform.siteUrl('/admin')} />
      </Group>

      <Group title="Mi cuenta">
        <Tile icon={IconUser} label="Mi cuenta" onClick={() => setSheet(true)} testid="tile-cuenta" />
        <Tile icon={IconLock} label="Privacidad" href={PRIVACY()} external />
      </Group>

      {confirm ? (
        <Confirm title="Cerrar sesión" block={block} busy={busy} onCancel={() => setConfirm(false)} confirmLabel="Sí, cerrar sesión" onConfirm={signOut}>
          <p className="mapp-muted">Sales del equipo en este celular. Las fichas y ventas ya guardadas quedan en la base.</p>
        </Confirm>
      ) : (
        <button type="button" className="mapp-btn is-ghost mapp-signout" onClick={open} data-testid="signout">Cerrar sesión</button>
      )}

      <Foot />

      {sheet && (
        <Sheet title="Mi cuenta" onClose={() => setSheet(false)} testid="sheet-cuenta">
          <dl className="mapp-plist">
            <Row label="Cuenta">{account}</Row>
            <Row label="Entras">{METHOD_LABEL[method] ?? 'Con tu cuenta'}</Row>
            <Row label="Rol">Dueño</Row>
          </dl>
          <p className="mapp-fine">Para ver Micra como un barista, usa «Actuar como» en <button type="button" className="mapp-link" onClick={() => go('/micra/equipo')}>Equipo › Hoy</button>.</p>
        </Sheet>
      )}
    </div>
  );
}

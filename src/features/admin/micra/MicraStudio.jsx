import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { autoTexts, FORMATS, igKind, loadPhotoBitmap, parseRecipe } from '../espresaleCard.js';
import { clearMicraIntent, MICRA_INTENT_EVENT, PRESETS, presetOf, readMicraIntent } from '../micraFilters.js';
import { setLeaveGuard } from '../leaveGuard.js';
import { currentSlot, movableSlots, slotPatch } from './cardLayout.js';
import { DEFAULT_TEXTS, ELEMENT_META, elementTextKey, isDefaultLook, loadPrefs, savePrefs, textTargets } from './cardModel.js';
import { buildAltText, buildCaption, money, moneyShort, PAY_METHODS, primaryDest, PUBLISH_ARIA, PUBLISH_LABEL } from './captions.js';
import { useCardLook } from './useCardLook.js';
import { canShareFiles, useCardOutput } from './useCardOutput.js';
import { useMicraData, variantsOf } from './useMicraData.js';
import { useSale } from './useSale.js';
import MicraCamera from './MicraCamera.jsx';
import MicraEditor from './MicraEditor.jsx';
import ContextBar from './ContextBar.jsx';
import ToolRail from './ToolRail.jsx';
import TextEditor from './TextEditor.jsx';
import SaleSheet from './SaleSheet.jsx';
import ShareSheet from './ShareSheet.jsx';
import StickerTray from './StickerTray.jsx';
import LayersSheet from './LayersSheet.jsx';
import BackgroundSheet from './BackgroundSheet.jsx';
import FormatSheet from './FormatSheet.jsx';
import FilterSheet from './FilterSheet.jsx';
import { IconBack, IconCamera, IconDownload, IconShare, IconUndo } from './icons.jsx';
import './micra.css';

// Micra Studio: la cámara y el editor de la tarjeta para redes, en una sola
// pantalla (reemplaza la consola de botones).
//  1. Cámara: la tarjeta es el filtro sobre el video; venta rápida con `$`.
//  2. Editor: tocar cualquier pieza para editarla, arrastrarla a otra
//     posición o a la papelera; riel con Texto, Stickers, Capas, Fondo y
//     Zonas; abajo, la venta, publicar en un toque y «Enviar a».

const TEXT_IDS = ['title', 'subtitle', 'free', 'handle', 'place', 'fig', 'panel'];
const COACH_KEY = 'micra_coach_v1';
const flag = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return true; } };
const setFlag = (k) => { try { localStorage.setItem(k, '1'); } catch { /* sin almacenamiento */ } };

function useDesktop() {
  const q = '(min-width: 1180px)'; // inspector acoplado solo si cabe al lado de la barra lateral
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const m = matchMedia(q);
    const fn = () => setOn(m.matches);
    m.addEventListener?.('change', fn);
    return () => m.removeEventListener?.('change', fn);
  }, []);
  return on;
}

export default function MicraStudio({ onExit, onOpenTool }) {
  const [prefs] = useState(loadPrefs);
  const { varieties, weather, now, minuteKey } = useMicraData();
  const desktop = useDesktop();
  const canShare = useMemo(canShareFiles, []);

  // ── Qué tarjeta ──
  const [stage, setStage] = useState('camera'); // camera | edit
  const [kind, setKind] = useState('recipe');
  const [varietyId, setVarietyId] = useState(null);
  const [presetIds, setPresetIds] = useState({ invite: PRESETS.invite[0].id, announce: PRESETS.announce[0].id });
  const [format, setFormat] = useState(prefs.format);
  const [camMode, setCamMode] = useState(prefs.camMode);
  const [capture, setCapture] = useState(null); // { file, type, url, duration }
  const [photo, setPhoto] = useState(null);
  const [bg, setBg] = useState('plain');
  const [trimStart, setTrimStart] = useState(0);
  const [cobrand, setCobrand] = useState(null); // { img, name }

  // ── Interfaz ──
  const [selection, setSelection] = useState(null);
  const [sheet, setSheet] = useState(() => (readMicraIntent() === 'sale' ? 'sale' : null));
  const [textKey, setTextKey] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [zones, setZones] = useState('off');
  const [caption, setCaption] = useState(null);
  const [hashtags, setHashtags] = useState(prefs.hashtags);
  const [toast, setToast] = useState(null);
  const [job, setJob] = useState(null); // { state: 'countdown'|'run'|'done'|'error', text, n?, retry? }
  const [drawn, setDrawn] = useState(null);
  const [coach, setCoach] = useState(() => !flag(COACH_KEY));
  const [ticketFlash, setTicketFlash] = useState(false);
  const cardRef = useRef(null);
  const countdown = useRef(0);
  useEffect(() => () => clearInterval(countdown.current), []);
  // Número de la tarjeta en pantalla: cambia al volver a la cámara o cambiar de filtro
  const cardIdRef = useRef(0);
  const publishingRef = useRef(false);
  const galleryRef = useRef(null);
  const cobrandRef = useRef(null);
  const recordingRef = useRef(false);

  const variety = useMemo(
    () => (varieties ?? []).find((v) => String(v.id) === String(varietyId)) ?? varieties?.[0] ?? null,
    [varieties, varietyId]
  );
  const preset = kind === 'recipe' ? null : presetOf(kind, presetIds[kind]);
  const onPhoto = stage === 'camera' ? camMode !== 'plain' : bg === 'media' && !!capture;
  const look = useCardLook({ kind, preset, onPhoto, hasCobrand: !!cobrand, saved: prefs });
  const { elements, texts } = look;
  const sale = useSale({ varieties, varietyId: variety?.id, kind, onVariety: setVarietyId, initialPay: prefs.pay });

  // Intención de entrada (⌘K «Registrar una venta») y la que llega con Micra ya abierto
  useEffect(() => {
    clearMicraIntent();
    const onIntent = (e) => { if (e.detail === 'sale') { clearMicraIntent(); setSheet('sale'); } };
    window.addEventListener(MICRA_INTENT_EVENT, onIntent);
    return () => window.removeEventListener(MICRA_INTENT_EVENT, onIntent);
  }, []);

  // Cambiar de filtro borra los textos propios del filtro (título, subtítulo, nota)
  const filterId = `${kind}:${variety?.id ?? ''}:${preset?.id ?? ''}`;
  const firstFilter = useRef(true);
  useEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false;
      if (preset?.freeText) look.act({ type: 'filterChanged', freeText: preset.freeText });
      return;
    }
    look.act({ type: 'filterChanged', freeText: preset?.freeText });
    setCaption(null);
    sale.releaseCard();
    cardIdRef.current += 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterId]);

  // Preferencias del celular (formato, modo, pago, etiquetas y diseño), sin escribir en cada tecla
  useEffect(() => {
    const id = setTimeout(() => savePrefs({ format, camMode, pay: sale.payMethod, hashtags, overrides: look.overrides, texts }), 400);
    return () => clearTimeout(id);
  }, [format, camMode, sale.payMethod, hashtags, look.overrides, texts]);

  // ── Avisos ──
  const toastTimer = useRef(0);
  const showToast = useCallback((t) => {
    clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ ...t, id });
    toastTimer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), t.ttl ?? 4000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  // Lo que dicen los avisos, en una región viva que no se desmonta
  const [announce, setAnnounce] = useState('');
  const say = useCallback((text) => {
    setAnnounce('');
    if (text) setTimeout(() => setAnnounce(text), 60);
  }, []);
  // Un aviso con «Deshacer» de una edición se cierra con la siguiente edición
  useEffect(() => {
    if (toast?.seq !== undefined && toast.seq !== look.seq) setToast(null);
  }, [look.seq, toast]);

  useEffect(() => { if (toast) say(toast.action ? `${toast.text}. ${toast.action.label} disponible.` : toast.text); }, [toast?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const jobSay = job?.text ?? '';
  useEffect(() => { if (jobSay) say(jobSay); }, [jobSay]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Textos de la tarjeta ──
  const kindText = kind === 'recipe' ? '' : texts[kind] || '';
  const autos = useMemo(() => autoTexts({ kind, preset, variety, text: kindText, format, date: now }), [kind, preset, variety, kindText, format, now]);
  const priceText = sale.priceFor(variety?.id);
  const firstVariant = useMemo(() => {
    const line = sale.lines.find((l) => String(l.varietyId) === String(variety?.id) && l.variant);
    return line?.variant ?? variantsOf(variety)[0] ?? null;
  }, [sale.lines, variety]);
  const filterExtra = kind === 'recipe' && firstVariant ? `${firstVariant.label} ${money(firstVariant.price)}` : null;
  const autoCaption = useMemo(() => buildCaption({ kind, preset, text: kindText, variety, weather, now }), [kind, preset, kindText, variety, weather, now]);
  const captionBase = caption ?? autoCaption;
  const altText = useMemo(() => buildAltText({
    formatLabel: FORMATS[format].label,
    title: texts.title ?? autos.title,
    recipe: kind === 'recipe' ? parseRecipe(variety?.recipe_text || '') : null,
  }), [format, texts.title, autos.title, kind, variety]);

  // ── Dibujo del editor ──
  const videoMode = bg === 'media' && capture?.type === 'video';
  const photoPending = bg === 'media' && capture?.type === 'image' && !photo;
  const shownPrice = elements.price.shown ? priceText : null;
  const drawArgs = useMemo(() => ({
    variety, weather, format, kind, preset, texts, elements, priceText: shownPrice,
    photo: bg === 'media' && capture?.type === 'image' ? photo : null,
    videoOverlay: videoMode,
    cobrand: cobrand?.img ?? null,
  }), [variety, weather, format, kind, preset, texts, elements, shownPrice, bg, capture, photo, videoMode, cobrand]);
  const hold = !!(textKey || confirm || (sheet && !desktop));
  const timeShown = elements.block.shown && elements.block.cells.time;
  // El minuto redibuja solo si se ve la hora, y espera a que no haya hojas ni selección
  const tickRef = useRef('fijo');
  if (!timeShown) tickRef.current = 'fijo';
  else if (!hold && !selection) tickRef.current = minuteKey;
  const tick = tickRef.current;
  // Lo que invalida el video grabado y lo guardado en Publicaciones (no el minuto)
  const cardKey = useMemo(() => JSON.stringify({
    filterId, format, bg, url: capture?.url, trimStart, o: look.overrides[kind], texts, price: shownPrice, cobrand: cobrand?.name ?? null,
  }), [filterId, format, bg, capture, trimStart, look.overrides, kind, texts, shownPrice, cobrand]);

  const out = useCardOutput({
    getCanvas: () => cardRef.current,
    videoMode,
    captureUrl: capture?.url,
    trimStart,
    format,
    caption: captionBase,
    hashtags,
    name: preset?.name ?? variety?.name,
    altText,
    cardKey,
  });

  // La selección se suelta si su pieza dejó de mostrarse (no antes de que se dibuje una recién puesta)
  useEffect(() => {
    if (selection && !elements[selection]?.shown) setSelection(null);
  }, [elements, selection]);

  // ── Toma ──
  const captureUrlRef = useRef(null);
  const dropCapture = useCallback(() => {
    captureUrlRef.current = null;
    setCapture((c) => { if (c?.url) URL.revokeObjectURL(c.url); return null; });
    setPhoto((p) => { p?.close?.(); return null; });
    setBg('plain');
    setTrimStart(0);
  }, []);
  useEffect(() => () => { dropCapture(); }, [dropCapture]);

  const takeCapture = useCallback((file) => {
    recordingRef.current = false;
    setSelection(null);
    setSheet(null);
    if (!file) { setBg('plain'); setStage('edit'); return; }
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const url = URL.createObjectURL(file);
    captureUrlRef.current = url;
    setCapture((c) => { if (c?.url) URL.revokeObjectURL(c.url); return { file, type, url, duration: null }; });
    setPhoto((p) => { p?.close?.(); return null; });
    setBg('media');
    setTrimStart(0);
    setStage('edit');
    if (type === 'image') {
      // Si llegó otra toma mientras esta se leía, esta se descarta
      loadPhotoBitmap(file).then((img) => {
        if (captureUrlRef.current === url) setPhoto(img);
        else img.close?.();
      }).catch(() => {
        if (captureUrlRef.current !== url) return;
        showToast({ text: 'No se pudo leer la foto.' });
        setBg('plain');
      });
    } else {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        const duration = Number.isFinite(v.duration) ? v.duration : null;
        setCapture((c) => (c?.url === url ? { ...c, duration } : c));
        v.removeAttribute('src');
        v.load();
      };
      v.src = url;
    }
  }, [showToast]);

  const cardSaleRef = useRef(null);
  cardSaleRef.current = sale.cardSale;
  const goCamera = useCallback(({ newCard: fresh = false } = {}) => {
    clearInterval(countdown.current);
    cardIdRef.current += 1;
    // Solo sigue a la vista lo que todavía corre (subiendo/publicando)
    setJob((j) => (j?.state === 'run' ? j : null));
    // Otra toma de la misma tarjeta conserva su venta y su pie de foto; una
    // tarjeta ya publicada no: lo que sigue es el próximo cliente
    if (fresh || cardSaleRef.current?.published) {
      sale.releaseCard();
      setCaption(null);
    }
    dropCapture();
    setSelection(null);
    setSheet(null);
    setZones('off');
    setStage('camera');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropCapture, sale.releaseCard]);
  const back = useCallback(() => {
    if (capture) setConfirm({ type: 'discard' });
    else goCamera();
  }, [capture, goCamera]);

  const busyJob = job?.state === 'run' || out.progress !== null;
  const countdownOn = job?.state === 'countdown';
  const exit = useCallback(() => {
    if (busyJob) setConfirm({ type: 'leave' });
    else onExit?.();
  }, [busyJob, onExit]);
  const videoBusy = out.progress !== null;
  useEffect(() => {
    if (!busyJob) return undefined;
    const msg = videoBusy ? 'Se está preparando el video. Si sales, se cancela.' : 'Se está publicando la tarjeta. Si sales, sigue en segundo plano.';
    setLeaveGuard(() => window.confirm(msg));
    return () => setLeaveGuard(null);
  }, [busyJob, videoBusy]);
  useEffect(() => {
    if (!busyJob) return undefined;
    const fn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [busyJob]);

  // ── Piezas ──
  const setEl = (id, patch) => look.act({ type: 'set', id, patch });
  const hideEl = (id) => {
    setSelection(null);
    if (id === 'cobrand') { setCobrand(null); return; }
    look.act({ type: 'hide', id });
    showToast({ text: `Se ocultó: ${ELEMENT_META[id].label}`, action: { label: 'Deshacer', run: look.undo }, seq: look.seq + 1 });
  };
  const showEl = (id) => {
    // Un cajetín sin celdas vuelve con todas
    if (id === 'block' && !Object.values(elements.block.cells).some(Boolean)) {
      look.act({ type: 'set', id, patch: { visible: true, cells: { weather: true, time: true, date: true, sign: true } } });
      return;
    }
    look.act({ type: 'show', id });
  };
  const toggleEl = (id) => (elements[id].visible && elements[id].available !== false ? hideEl(id) : showEl(id));
  const resetEl = (id) => {
    const key = elementTextKey(id, kind, texts);
    const resetText = key && ['title', 'subtitle', 'fig', 'note', 'sign'].includes(key) ? { [key]: null } : null;
    look.act({ type: 'resetElement', id, texts: resetText });
  };
  const slotStep = (id, dir) => {
    const list = movableSlots(elements, id, onPhoto);
    if (list.length < 2) return;
    const i = list.indexOf(currentSlot(elements, id, onPhoto));
    const next = list[Math.max(0, Math.min(list.length - 1, i + dir))];
    if (next && next !== list[i]) setEl(id, slotPatch(id, next, onPhoto));
  };
  const toSlot = (id, slot) => {
    if (currentSlot(elements, id, onPhoto) !== slot) setEl(id, slotPatch(id, slot, onPhoto));
  };
  const select = (id) => {
    setSelection(id);
    if (id && coach) { setCoach(false); setFlag(COACH_KEY); }
  };
  const editText = (idOrKey) => {
    const key = ELEMENT_META[idOrKey] ? elementTextKey(idOrKey, kind, texts) : idOrKey;
    if (key) setTextKey(key);
  };

  const targets = useMemo(() => textTargets(kind, preset, elements), [kind, preset, elements]);
  const commitText = (patch, style) => {
    const p = { ...patch };
    const patches = {};
    if (style.free && Object.keys(style.free).length) patches.free = { ...style.free };
    if ('free' in p) patches.free = { ...(patches.free || {}), visible: !!p.free };
    if (style.titleColor) patches.title = { color: style.titleColor };
    // Mención o ubicación vacías: el sticker se quita y vuelve el texto de siempre
    for (const k of ['handle', 'place']) {
      if (k in p && !p[k]) { p[k] = DEFAULT_TEXTS[k]; patches[k] = { visible: false }; }
    }
    setTextKey(null);
    if (!Object.keys(p).length && !Object.keys(patches).length) return;
    look.act({ type: 'textsAndSet', texts: p, patches });
  };

  // ── Venta ──
  const payLabel = PAY_METHODS.find((m) => m.id === sale.payMethod)?.label;
  const linkedSale = sale.linkedSale({ kind, varietyId: variety?.id });
  const linkedOrderId = linkedSale?.orderId ?? null;
  // La venta de esta tarjeta (la enlazable o la que ya se publicó con ella)
  const saleSold = linkedSale ?? sale.cardSale;
  const onSaleRegistered = (rec) => {
    // Cierra la hoja de venta (no la de «Enviar a» que se abrió para compartir)
    if (!desktop) setSheet((s) => (s === 'sale' ? null : s));
    setTicketFlash(true);
    setTimeout(() => setTicketFlash(false), 6000);
    showToast({
      text: rec.stockError ? `✓ Venta registrada · ${money(rec.total)} (el inventario no se actualizó)` : `✓ Venta registrada · ${money(rec.total)}`,
      ttl: 6000,
      action: {
        label: 'Deshacer',
        run: () => sale.voidLast(rec)
          .then(() => showToast({ text: 'Venta anulada · el inventario volvió a su lugar.' }))
          .catch((e) => showToast({ text: /se anuló/.test(e.message) ? e.message : `No se anuló: ${e.message}`, ttl: 6000 })),
      },
    });
  };
  const ticketLabel = ticketFlash ? '✓' : sale.priced ? moneyShort(sale.total) : '$';

  // ── Publicar ──
  const guardLogo = (fn) => {
    if (elements.logo.shown) { fn(); return; }
    setConfirm({ type: 'noLogo', onYes: fn });
  };
  const quickDest = primaryDest(format, canShare);
  const igK = igKind(format, videoMode);

  const publishNow = async (orderId) => {
    clearInterval(countdown.current);
    if (publishingRef.current) return { ok: false, aborted: true };
    publishingRef.current = true;
    const cardId = cardIdRef.current;
    const retry = () => publishRef.current(orderId);
    setJob({ state: 'run', text: 'Subiendo la tarjeta…' });
    try {
      const r = await out.publishIG({ orderId, onStage: (s) => s === 'publish' && setJob({ state: 'run', text: `Publicando en Instagram · ${PUBLISH_LABEL[igK]}…` }) });
      if (r.ok) {
        if (orderId) sale.markPublished(orderId, { sameCard: cardIdRef.current === cardId && stageRef.current === 'edit' });
        setJob({ state: 'done', text: `✓ ${r.text}` });
      } else setJob({ state: 'error', text: r.pending ? r.text : `✕ No se publicó: ${r.text}`, retry: r.pending ? null : retry });
      return r;
    } catch (e) {
      if (e?.name === 'AbortError') { setJob(null); return { ok: false, aborted: true }; }
      setJob({ state: 'error', text: `✕ No se publicó: ${e.message}`, retry });
      return { ok: false, text: e.message };
    } finally {
      publishingRef.current = false;
    }
  };
  // La cuenta regresiva publica con lo que haya al terminar (formato, pie de foto, tarjeta)
  const publishRef = useRef(null);
  publishRef.current = publishNow;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const quickPublish = (orderId = linkedOrderId) => {
    if (publishingRef.current || countdownOn) return;
    if (videoMode) {
      // El video se graba primero (la grabación ya es la espera)
      setJob({ state: 'run', text: 'Preparando video…', video: true });
      out.ensureCardVideo().then(() => publishNow(orderId)).catch((e) => {
        if (e?.name === 'AbortError') setJob(null);
        else setJob({ state: 'error', text: `✕ No se publicó: ${e.message}`, retry: () => quickPublish(orderId) });
      });
      return;
    }
    let n = 3;
    setJob({ state: 'countdown', n, text: `Publicando en Instagram · ${PUBLISH_LABEL[igK]}…` });
    clearInterval(countdown.current);
    countdown.current = setInterval(() => {
      n -= 1;
      if (n > 0) { setJob((j) => (j?.state === 'countdown' ? { ...j, n } : j)); return; }
      clearInterval(countdown.current);
      if (stageRef.current !== 'edit') { setJob(null); return; }
      publishRef.current(orderId);
    }, 1000);
  };
  const cancelJob = () => {
    clearInterval(countdown.current);
    out.cancelVideo();
    setJob(null);
  };
  // Descargar: con video, la grabación muestra su avance y se puede cancelar
  const runDownload = () => {
    if (videoMode && !out.cardVideo) setJob({ state: 'run', text: 'Preparando video…', video: true });
    return out.download()
      .then(() => setJob((j) => (j?.video ? null : j)))
      .catch((e) => {
        setJob((j) => (j?.video ? null : j));
        if (e?.name !== 'AbortError') showToast({ text: e.message });
      });
  };
  const quick = () => {
    if (quickDest === 'ig') { guardLogo(() => quickPublish()); return; }
    if (quickDest === 'share') {
      if (videoMode && !out.cardVideo) { setSheet('share'); return; }
      out.share().catch((e) => showToast({ text: e.message }));
      return;
    }
    runDownload();
  };
  const quickLabel = quickDest === 'ig' ? PUBLISH_LABEL[igK] : quickDest === 'share' ? 'Compartir' : 'Descargar';
  const quickAria = quickDest === 'ig' ? PUBLISH_ARIA[igK] : quickLabel;
  const QuickIcon = quickDest === 'ig' ? IconCamera : quickDest === 'share' ? IconShare : IconDownload;

  const newCard = () => {
    setJob(null);
    look.act({ type: 'newCard' });
    sale.newCard();
    goCamera({ newCard: true });
  };

  // ── Teclado: Esc recorre la cadena (y el panel flotante nunca se cierra detrás) ──
  const keys = useRef(null);
  keys.current = { confirm, textKey, sheet, selection, stage, back, exit, countdown: job?.state === 'countdown', cancelJob };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('.ax-palette')) return;
      e.stopPropagation();
      e.preventDefault();
      const k = keys.current;
      if (recordingRef.current) return;
      // Dentro del inspector acoplado (escritorio), Esc solo suelta el campo: no sale de Micra
      if (!k.sheet && !k.confirm && !k.textKey && !k.countdown && e.target?.closest?.('.mst-dock')) { e.target.blur?.(); return; }
      if (k.confirm) setConfirm(null);
      else if (k.countdown) k.cancelJob();
      else if (k.textKey) setTextKey(null);
      else if (k.sheet) setSheet(null);
      else if (k.selection) setSelection(null);
      else if (k.stage === 'edit') k.back();
      else k.exit();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  // Editor (escritorio): ⌘/Ctrl+Z deshace, ⌘/Ctrl+S descarga, V abre la venta
  const editKeys = useRef(null);
  editKeys.current = { undo: look.undo, canUndo: look.canUndo, download: runDownload, busy: busyJob };
  useEffect(() => {
    if (stage !== 'edit' || textKey || (sheet && !desktop)) return undefined;
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea, select')) return;
      const k = editKeys.current;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (k.canUndo) k.undo(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (!k.busy) k.download(); }
      else if (!mod && !e.altKey && e.key.toLowerCase() === 'v') setSheet('sale');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, textKey, sheet, desktop]);

  // Arrastrar una foto o un video al estudio (escritorio)
  const onDrop = (e) => {
    const file = [...(e.dataTransfer?.files ?? [])].find((f) => /^(image|video)\//.test(f.type));
    if (!file) return;
    e.preventDefault();
    takeCapture(file);
  };

  const pickFile = (e, fn) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) fn(file);
  };
  const takeCobrand = async (file) => {
    try {
      const img = await loadPhotoBitmap(file, 600);
      setCobrand((c) => { c?.img?.close?.(); return { img, name: `${file.name}-${file.size}` }; });
      showEl('cobrand');
    } catch {
      showToast({ text: 'No se pudo leer el logo.' });
    }
  };

  // ── Hojas ──
  const dockDefault = desktop && !sheet ? (stage === 'edit' ? 'layers' : 'sale') : null;
  const activeSheet = sheet ?? dockDefault;
  const docked = desktop;
  const closeSheet = () => setSheet(null);
  const previews = {
    logo: elements.logo.variant === 'type' ? 'ACERO.press' : null,
    fig: texts.fig ?? autos.fig,
    title: texts.title ?? autos.title,
    subtitle: texts.subtitle ?? autos.subtitle,
    free: texts.free,
    price: priceText,
    handle: texts.handle,
    place: texts.place,
    panel: kind === 'announce' ? kindText || autos.note : texts.note ?? autos.note,
    block: texts.sign ?? 'ACERO.press',
  };
  const fitNote = selection ? drawn?.notes?.[selection] : null;

  const renderSheet = () => {
    switch (activeSheet) {
      case 'sale':
        return (
          <SaleSheet
            sale={sale}
            varieties={varieties}
            context={stage === 'edit' ? 'editor' : 'camera'}
            docked={docked}
            onClose={closeSheet}
            onRegistered={onSaleRegistered}
            sendLabel={quickDest === 'share' ? 'Registrar y compartir' : quickDest === 'download' ? 'Registrar y descargar' : 'Registrar y publicar'}
            onRegisterAndSend={async () => {
              if (quickDest === 'share') {
                // El menú de compartir necesita el toque: la venta va en paralelo
                sale.register({ attach: true }).then((rec) => rec && onSaleRegistered(rec))
                  .catch((e) => showToast({ text: `No se registró la venta: ${e.message}`, ttl: 6000 }));
                setSheet(null);
                if (videoMode && !out.cardVideo) setSheet('share');
                else out.share().catch((e) => showToast({ text: e.message }));
                return;
              }
              const rec = await sale.register({ attach: true });
              if (!rec) return;
              onSaleRegistered(rec);
              setSheet(null);
              if (quickDest === 'ig') guardLogo(() => (videoMode ? quickPublish(rec.orderId) : publishNow(rec.orderId)));
              else runDownload();
            }}
            linked={saleSold}
            onSend={() => { setSheet(null); quick(); }}
            sendBusy={busyJob || countdownOn}
            sendOnlyLabel={quickDest === 'ig' ? `Publicar · ${quickLabel}` : quickLabel}
          />
        );
      case 'format':
        return <FormatSheet format={format} onFormat={setFormat} onClose={closeSheet} docked={docked} />;
      case 'share':
        return (
          <ShareSheet
            out={out} sale={sale} kind={kind} format={format} videoMode={videoMode} cardRef={cardRef} cardKey={cardKey}
            caption={caption} autoCaption={autoCaption} setCaption={setCaption} hashtags={hashtags} setHashtags={setHashtags}
            linkedOrderId={linkedOrderId} canShare={canShare} onRegistered={onSaleRegistered}
            onPublish={({ orderId }) => publishNow(orderId)}
            busy={busyJob || countdownOn}
            linkedPhone={saleSold?.phone ?? null}
            onNewCard={newCard}
            onOpenPublications={() => onOpenTool?.('publications')}
            guardLogo={guardLogo}
            onClose={closeSheet}
            docked={docked}
          />
        );
      case 'stickers':
        return (
          <StickerTray
            elements={elements} texts={texts} priceText={priceText} hasCobrand={!!cobrand}
            onFree={() => { setSheet(null); setTextKey('free'); }}
            onShow={(id) => { showEl(id); setSheet(null); setSelection(id); }}
            onSelect={(id) => { setSheet(null); setSelection(id); }}
            onSale={() => setSheet('sale')}
            onCobrand={() => cobrandRef.current?.click()}
            onClose={closeSheet}
            docked={docked}
          />
        );
      case 'layers':
        return (
          <LayersSheet
            elements={elements} kind={kind} previews={previews} fit={drawn?.fit}
            onToggle={toggleEl}
            onSelect={(id) => { setSheet(null); setSelection(id); }}
            onStyle={(styleId) => look.act({ type: 'style', styleId })}
            onReset={() => { look.act({ type: 'resetKind' }); showToast({ text: 'Diseño restablecido', action: { label: 'Deshacer', run: look.undo }, seq: look.seq + 1 }); }}
            canReset={!isDefaultLook(look.overrides, kind)}
            onClose={closeSheet}
            docked={docked}
          />
        );
      case 'background':
        return (
          <BackgroundSheet
            bg={bg} capture={capture} thumbUrl={capture?.type === 'image' ? capture.url : null}
            onBg={(b) => setBg(b)}
            onRetake={() => goCamera()}
            onGallery={() => galleryRef.current?.click()}
            elements={elements} onToggle={toggleEl}
            trimStart={trimStart} onTrim={setTrimStart} duration={capture?.duration}
            onClose={closeSheet}
            docked={docked}
          />
        );
      case 'filter':
        return (
          <FilterSheet
            kind={kind} onKind={setKind} varieties={varieties} varietyId={variety?.id} onVariety={setVarietyId}
            presetId={preset?.id} onPreset={(id) => setPresetIds((p) => ({ ...p, [kind]: id }))}
            onClose={closeSheet}
            docked={docked}
          />
        );
      default:
        return null;
    }
  };

  const confirmBox = confirm && (() => {
    const C = {
      discard: { text: '¿Descartar la toma?', yes: 'Descartar', no: 'Seguir editando', run: () => goCamera() },
      noLogo: { text: 'La tarjeta sale sin logo. ¿Publicar igual?', yes: 'Publicar igual', no: 'Mostrar el logo', run: confirm.onYes, onNo: () => showEl('logo') },
      leave: out.progress !== null
        ? { text: 'Se está preparando el video. Si sales, se cancela.', yes: 'Salir y cancelar', no: 'Quedarme', run: () => { out.cancelVideo(); setLeaveGuard(null); onExit?.(); } }
        : { text: 'Se está publicando la tarjeta. Si sales, sigue en segundo plano.', yes: 'Salir', no: 'Quedarme', run: () => { setLeaveGuard(null); onExit?.(); } },
    }[confirm.type];
    return (
      <div className="mst-confirm-back">
        <div className="mst-confirm" role="alertdialog" aria-modal="true" aria-label={C.text}>
          <p>{C.text}</p>
          <div className="msheet-row">
            <button type="button" className="msheet-btn is-ghost" onClick={() => { setConfirm(null); C.onNo?.(); }} autoFocus>{C.no}</button>
            <button type="button" className="msheet-btn is-primary" onClick={() => { setConfirm(null); C.run?.(); }}>{C.yes}</button>
          </div>
        </div>
      </div>
    );
  })();

  const jobPill = job && (
    <div className={`mst-job is-${job.state}`}>
      <span>
        {job.video && out.progress !== null ? `Preparando video ${Math.round(out.progress * 100)} %` : job.text}
        {job.state === 'countdown' ? ` ${job.n}` : ''}
      </span>
      {(job.state === 'countdown' || job.video) && job.state !== 'done' && job.state !== 'error' && (
        <button type="button" className="mst-toast-action" onClick={cancelJob}>Cancelar</button>
      )}
      {job.state === 'error' && job.retry && <button type="button" className="mst-toast-action" onClick={() => { const again = job.retry; setJob(null); again(); }}>Reintentar</button>}
      {(job.state === 'done' || job.state === 'error') && (
        <button type="button" className="mst-toast-action" onClick={() => setJob(null)} aria-label="Cerrar aviso">×</button>
      )}
    </div>
  );

  const filterLabel = kind === 'recipe' ? `Receta · ${variety?.name ?? '—'}` : `${kind === 'invite' ? 'Invitación' : 'Anuncio'} · ${preset?.name}`;

  return (
    <div
      className={`mstudio is-${stage} ${job ? 'has-job' : ''}`}
      data-still={(stage === 'edit' ? !videoMode : camMode === 'plain') ? 'true' : 'false'}
      onDragOver={(e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) e.preventDefault(); }}
      onDrop={onDrop}
    >
      <div className="mst-col">
        {stage === 'camera' ? (
          <MicraCamera
            varieties={varieties}
            variety={variety}
            onVariety={setVarietyId}
            kind={kind}
            onKind={setKind}
            presetId={preset?.id}
            onPreset={(id) => setPresetIds((p) => ({ ...p, [kind]: id }))}
            format={format}
            onOpenFormat={() => setSheet('format')}
            weather={weather}
            elements={elements}
            texts={texts}
            priceText={priceText}
            filterExtra={filterExtra}
            cobrand={cobrand?.img ?? null}
            mode={camMode}
            onMode={setCamMode}
            paused={hold}
            onCapture={takeCapture}
            onEditText={(key) => setTextKey(key)}
            onOpenSale={() => setSheet('sale')}
            ticketLabel={ticketLabel}
            onExit={exit}
            onRecording={(r) => { recordingRef.current = r; }}
          />
        ) : (
          <>
            <header className="mst-top" hidden={!!textKey}>
              <button type="button" className="mc-round" onClick={back} aria-label="Volver a la cámara"><IconBack /></button>
              <button type="button" className="mst-filterchip" onClick={() => setSheet('filter')} aria-label={`Filtro: ${filterLabel}. Cambiar`}>
                <span>{filterLabel}</span> ▾
              </button>
              <button type="button" className="mc-pill" onClick={() => setSheet('format')} aria-label={`Formato: ${FORMATS[format].label}. Cambiar`}>
                <i className="mc-ratio" style={{ '--r': FORMATS[format].w / FORMATS[format].h }} aria-hidden="true" />{FORMATS[format].short}
              </button>
              <button type="button" className="mc-round mst-undo" onClick={look.undo} disabled={!look.canUndo} aria-label="Deshacer"><IconUndo /></button>
            </header>

            <MicraEditor
              cardRef={cardRef}
              drawArgs={drawArgs}
              tick={tick}
              pending={photoPending}
              onDrawn={setDrawn}
              drawn={drawn}
              format={format}
              videoUrl={videoMode ? capture.url : null}
              trimStart={trimStart}
              hold={hold}
              selection={selection}
              onSelect={select}
              onEditText={editText}
              onSlot={toSlot}
              onSlotStep={slotStep}
              onHide={hideEl}
              isText={(id) => TEXT_IDS.includes(id)}
              zones={zones}
              altText={altText}
            >
              {coach && !selection && drawn && <p className="mst-coach">Toca cualquier parte de la tarjeta para editarla</p>}
            </MicraEditor>

            {!selection && !textKey && (
              <ToolRail
                onText={() => setTextKey('free')}
                onStickers={() => setSheet('stickers')}
                onLayers={() => setSheet('layers')}
                onBackground={() => setSheet('background')}
                zones={zones}
                onZones={() => setZones((z) => (z === 'off' ? 'zones' : z === 'zones' ? 'app' : 'off'))}
              />
            )}

            {textKey ? null : selection ? (
              <ContextBar
                id={selection}
                el={elements}
                kind={kind}
                onPhoto={onPhoto}
                note={fitNote}
                onSet={(patch) => setEl(selection, patch)}
                onHide={() => hideEl(selection)}
                onEdit={(key) => editText(key ?? selection)}
                onReset={() => resetEl(selection)}
                onSale={() => setSheet('sale')}
                onCobrand={() => cobrandRef.current?.click()}
                onDone={() => setSelection(null)}
              />
            ) : (
              <footer className="mst-bottom">
                <button type="button" className={`mst-salepill ${saleSold ? 'is-sold' : ''}`} onClick={() => setSheet('sale')} aria-label={saleSold ? `Vendido ${money(saleSold.total)}` : sale.priced ? `Venta: ${money(sale.total)}, ${payLabel}` : 'Venta'}>
                  {variety?.image_url ? <img src={variety.image_url} alt="" /> : <i aria-hidden="true">$</i>}
                  {saleSold ? (
                    <span><small>✓ Vendido</small><b>{money(saleSold.total)}</b></span>
                  ) : sale.priced ? (
                    <span><small>Venta · {payLabel}</small><b>{money(sale.total)}</b></span>
                  ) : (
                    <span><b>Venta</b></span>
                  )}
                </button>
                <button type="button" className="mst-quick" onClick={quick} disabled={busyJob || job?.state === 'countdown' || photoPending} aria-label={quickAria}>
                  <QuickIcon /><span>{quickLabel}</span>
                </button>
                <button type="button" className="mst-send" onClick={() => setSheet('share')}>Enviar a ›</button>
              </footer>
            )}
          </>
        )}

        {jobPill}
        {toast && (
          <div className="mst-toast" key={toast.id}>
            <span>{toast.text}</span>
            {toast.action && <button type="button" className="mst-toast-action" onClick={() => { setToast(null); toast.action.run(); }}>{toast.action.label}</button>}
          </div>
        )}
        {textKey && (
          <TextEditor
            targets={targets}
            initialKey={textKey}
            values={texts}
            autos={autos}
            placeholders={{ invite: preset?.placeholder, announce: preset?.placeholder, free: 'Escribe algo…', handle: '@aceropress', place: 'Chapinero, Bogotá' }}
            freeLook={elements.free}
            titleColor={elements.title.color}
            onCommit={commitText}
            onCancel={() => setTextKey(null)}
          />
        )}
        {confirmBox}
      </div>

      {activeSheet && <div className={`mst-dock ${docked ? 'is-docked' : ''}`}>{renderSheet()}</div>}
      <div className="mst-sr" role="status" aria-live="polite" aria-atomic="true">{announce}</div>

      <input ref={galleryRef} type="file" accept="image/*,video/*" hidden onChange={(e) => pickFile(e, takeCapture)} />
      <input ref={cobrandRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e, takeCobrand)} />
    </div>
  );
}

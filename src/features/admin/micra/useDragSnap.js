import { useRef } from 'react';
import { hitCandidates } from './cardLayout.js';

// Gestos sobre la tarjeta del editor, sin redibujar nada mientras se mueve:
//  - toque (< 8 px y < 500 ms): selecciona la pieza bajo el dedo; tocar de
//    nuevo la seleccionada abre su texto (si tiene) o pasa a la de abajo;
//  - doble toque (< 280 ms y < 24 px): abre el texto;
//  - arrastrar (> 8 px): la pieza se selecciona, aparecen sus posiciones y la
//    papelera; al soltar se acomoda en la más cercana (< 120 px) o se oculta.
// El seguimiento del dedo se escribe directo en el DOM (style.transform y
// clases), así React no se entera de cada movimiento.

const TAP_PX = 8;
const TAP_MS = 500;
const DOUBLE_MS = 280;
const DOUBLE_PX = 24;
const SNAP_PX = 120;
const NEAR_HYST = 12;
const TRASH_HOT = 56;
const FINGER_PAD = 22; // medio dedo (44 px) alrededor de las piezas pequeñas

export function useDragSnap({ layerRef, selRef, getState, onSelect, onEditText, onSlot, onHide, onDrag, onHover, isText }) {
  const g = useRef(null);
  const lastTap = useRef(null);

  const toCanvas = (rect, cx, cy) => {
    const { W, H } = getState().drawn;
    return { x: ((cx - rect.left) / rect.width) * W, y: ((cy - rect.top) / rect.height) * H, k: W / rect.width };
  };

  const slotEls = () => [...(layerRef.current?.querySelectorAll('.mst-slot') ?? [])];
  const trashEl = () => layerRef.current?.querySelector('.mst-trash');

  const onPointerDown = (e) => {
    const st = getState();
    // Un segundo dedo cancela el gesto en curso (no se reemplaza por otro)
    if (g.current) {
      const s = g.current;
      g.current = null;
      if (s.dragging) finishDrag(s, true);
      return;
    }
    if (st.disabled || !st.drawn || e.button > 0) return;
    const rect = layerRef.current.getBoundingClientRect();
    const p = toCanvas(rect, e.clientX, e.clientY);
    const cands = hitCandidates(st.layout, p.x, p.y, FINGER_PAD * p.k);
    g.current = { pointerId: e.pointerId, id: cands[0] ?? null, cands, x0: e.clientX, y0: e.clientY, t0: performance.now(), rect, k: p.k, dragging: false, near: null, hot: false, armed: false };
    layerRef.current.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const s = g.current;
    if (s && e.pointerId !== s.pointerId) return;
    if (!s) {
      // Escritorio: el contorno de la pieza bajo el mouse
      if (e.pointerType === 'mouse' && getState().drawn) {
        const rect = layerRef.current.getBoundingClientRect();
        const p = toCanvas(rect, e.clientX, e.clientY);
        onHover?.(hitCandidates(getState().layout, p.x, p.y)[0] ?? null);
      }
      return;
    }
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.dragging) {
      if (!s.id || Math.hypot(dx, dy) <= TAP_PX) return;
      s.dragging = true;
      onSelect(s.id);
      onDrag(s.id);
    }
    const sel = selRef.current;
    if (sel) { sel.style.transition = 'none'; sel.style.transform = `translate(${dx}px, ${dy}px)`; }

    // Papelera: cerca del centro de abajo. Solo se activa después de que el dedo
    // estuvo fuera de ella (lo que empieza encima, como el cajetín, no cae solo)
    const trash = trashEl();
    if (trash) {
      const tr = trash.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (tr.left + tr.width / 2), e.clientY - (tr.top + tr.height / 2));
      if (d >= TRASH_HOT) s.armed = true;
      s.hot = s.armed && d < TRASH_HOT;
      trash.classList.toggle('is-hot', s.hot);
    }
    // Posición más cercana al centro de la pieza arrastrada (con histéresis)
    const box = getState().layout.find((b) => b.id === s.id);
    const slots = getState().slots?.[s.id] ?? [];
    if (box && slots.length) {
      const cx = box.x + box.w / 2 + dx * s.k;
      const cy = box.y + box.h / 2 + dy * s.k;
      let best = null;
      for (const sl of slots) {
        const d = Math.hypot(sl.x + sl.w / 2 - cx, sl.y + sl.h / 2 - cy) / s.k;
        if (!best || d < best.d) best = { slot: sl.slot, d };
      }
      const cur = s.near && slots.find((sl) => sl.slot === s.near);
      const curD = cur ? Math.hypot(cur.x + cur.w / 2 - cx, cur.y + cur.h / 2 - cy) / s.k : Infinity;
      if (s.hot || !best || best.d > SNAP_PX) s.near = null;
      else if (!s.near || best.d + NEAR_HYST < curD) s.near = best.slot;
      for (const el of slotEls()) el.classList.toggle('is-near', el.dataset.slot === s.near);
    }
  };

  const springBack = () => {
    const sel = selRef.current;
    if (!sel) return;
    sel.style.transition = 'transform .18s ease';
    sel.style.transform = '';
  };

  const finishDrag = (s, cancelled) => {
    onDrag(null);
    if (!cancelled && s.hot) { springBack(); onHide(s.id); return; }
    if (!cancelled && s.near) {
      const sel = selRef.current;
      if (sel) { sel.style.transition = 'none'; sel.style.transform = ''; }
      onSlot(s.id, s.near);
      return;
    }
    springBack();
  };

  const onPointerUp = (e) => {
    const s = g.current;
    if (!s || e.pointerId !== s.pointerId) return;
    g.current = null;
    if (s.dragging) { finishDrag(s, false); return; }
    const now = performance.now();
    if (now - s.t0 > TAP_MS) return;
    const st = getState();
    const prev = lastTap.current;
    const dbl = prev && now - prev.t < DOUBLE_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_PX && prev.id === s.id;
    lastTap.current = { t: now, x: e.clientX, y: e.clientY, id: s.id };
    if (!s.id) { onSelect(null); return; }
    if (dbl && isText(s.id)) { lastTap.current = null; onEditText(s.id); return; }
    if (s.id === st.selection) {
      if (isText(s.id)) { lastTap.current = null; onEditText(s.id); return; }
      // Lo que está debajo de la seleccionada
      if (s.cands.length > 1) onSelect(s.cands[(s.cands.indexOf(st.selection) + 1) % s.cands.length]);
      return;
    }
    onSelect(s.id);
  };

  const onPointerCancel = (e) => {
    const s = g.current;
    if (!s || e.pointerId !== s.pointerId) return;
    g.current = null;
    if (s.dragging) finishDrag(s, true);
  };

  const onPointerLeave = (e) => { if (e.pointerType === 'mouse' && !g.current) onHover?.(null); };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave };
}

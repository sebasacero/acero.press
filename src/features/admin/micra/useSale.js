import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { recordMicraSale, voidMicraSale } from '../../../shared/lib/instagram.js';
import { money, waDigits } from './captions.js';
import { variantsOf } from './useMicraData.js';

// Venta en barra desde Micra: un ticket de una o varias líneas (café +
// presentación + cantidad), método de pago recordado y WhatsApp opcional.
// Una venta registrada NO se borra al cambiar de filtro (antes se perdía y
// invitaba a registrarla dos veces) y queda "enlazable" 10 minutos: la
// siguiente tarjeta de Receta de esa variedad se publica con su pedido.

const LINK_MS = 10 * 60 * 1000;
const UP = (t) => String(t || '').toLocaleUpperCase('es-CO');
let nextKey = 1;
const newLine = (variety) => ({ key: nextKey++, varietyId: variety?.id ?? null, variantId: variantsOf(variety)[0]?.id ?? null, qty: 1 });

export function useSale({ varieties, varietyId, kind, onVariety, initialPay = 'cash' }) {
  const byId = useMemo(() => new Map((varieties ?? []).map((v) => [String(v.id), v])), [varieties]);
  const varietyOf = useCallback((id) => byId.get(String(id)) ?? null, [byId]);
  const [lines, setLines] = useState([]);
  const [payMethod, setPayMethod] = useState(initialPay);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState(null);
  const [last, setLast] = useState(null); // { orderId, total, lines:[{variantId, qty, label}], varietyIds, at, published }
  const [attachedOrderId, setAttachedOrderId] = useState(null);
  const [stock, setStock] = useState(null); // { [variantId]: { qty, low } }

  // La primera línea sigue al filtro de la cámara
  useEffect(() => {
    if (!varieties) return;
    const v = varietyOf(varietyId) ?? varieties[0] ?? null;
    setLines((cur) => {
      if (!cur.length) return [newLine(v)];
      if (!v || String(cur[0].varietyId) === String(v.id)) return cur;
      return [{ ...newLine(v), key: cur[0].key }, ...cur.slice(1)];
    });
  }, [varieties, varietyId, varietyOf]);

  const resolved = useMemo(() => lines.map((l) => {
    const variety = varietyOf(l.varietyId);
    const variants = variantsOf(variety);
    const variant = variants.find((x) => x.id === l.variantId) ?? null;
    return { ...l, variety, variants, variant, subtotal: variant ? Number(variant.price) * l.qty : 0 };
  }), [lines, varietyOf]);
  const total = resolved.reduce((s, l) => s + l.subtotal, 0);
  const priced = resolved.length > 0 && resolved.every((l) => l.variant);

  const setLine = useCallback((i, patch) => {
    setLines((cur) => cur.map((l, j) => {
      if (j !== i) return l;
      const next = { ...l, ...patch };
      // Otra variedad: su presentación más barata
      if (patch.varietyId !== undefined && String(patch.varietyId) !== String(l.varietyId)) {
        next.variantId = variantsOf(varietyOf(patch.varietyId))[0]?.id ?? null;
      }
      if (next.qty < 1) next.qty = 1;
      if (next.qty > 99) next.qty = 99;
      return next;
    }));
    // En Receta, la variedad de la primera línea ES el filtro (en los dos sentidos)
    if (i === 0 && patch.varietyId !== undefined && kind === 'recipe') onVariety?.(patch.varietyId);
  }, [kind, onVariety, varietyOf]);

  const addLine = useCallback(() => setLines((cur) => [...cur, newLine(varietyOf(cur[cur.length - 1]?.varietyId) ?? varieties?.[0])]), [varieties, varietyOf]);
  const removeLine = useCallback((i) => setLines((cur) => (cur.length > 1 ? cur.filter((_, j) => j !== i) : cur)), []);
  const resetTicket = useCallback(() => {
    setLines([newLine(varietyOf(varietyId) ?? varieties?.[0] ?? null)]);
    setError(null);
  }, [varieties, varietyId, varietyOf]);

  // Stock: se carga al abrir la venta por primera vez
  const loadStock = useCallback(async () => {
    const ids = (varieties ?? []).flatMap((v) => variantsOf(v).map((x) => x.id));
    if (!ids.length) return;
    const { data, error: e } = await supabase.from('inventory').select('variant_id, stock_qty, low_stock_threshold').in('variant_id', ids);
    if (e) return;
    setStock(Object.fromEntries((data ?? []).map((r) => [r.variant_id, { qty: r.stock_qty, low: r.low_stock_threshold }])));
  }, [varieties]);
  const stockFor = useCallback((variantId) => stock?.[variantId] ?? null, [stock]);
  const moveLocalStock = (changes) => setStock((s) => {
    if (!s) return s;
    const next = { ...s };
    for (const { variantId, change } of changes) if (next[variantId]) next[variantId] = { ...next[variantId], qty: Math.max(0, next[variantId].qty + change) };
    return next;
  });
  /** Líneas que piden más de lo que hay en el inventario. */
  const shortages = useCallback(() => resolved.filter((l) => {
    const st = l.variant && stock?.[l.variant.id];
    return st && st.qty < l.qty;
  }), [resolved, stock]);

  /** Registra el ticket. `attach`: la venta queda pegada a la tarjeta del editor. */
  const register = useCallback(async ({ attach = false } = {}) => {
    if (busyRef.current || !priced) return null;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const payload = resolved.map((l) => ({ variant: l.variant, productName: l.variety?.name ?? '', qty: l.qty }));
    try {
      const r = await recordMicraSale({ lines: payload, paymentMethod: payMethod, phone: waDigits(phone) });
      const rec = {
        orderId: r.orderId,
        total: r.total,
        lines: payload.map((l) => ({ variantId: l.variant.id, qty: l.qty, label: `${l.productName} · ${l.variant.label}` })),
        varietyIds: [...new Set(resolved.map((l) => String(l.varietyId)))],
        at: Date.now(),
        published: false,
      };
      setLast(rec);
      if (attach) setAttachedOrderId(r.orderId);
      moveLocalStock(rec.lines.map((l) => ({ variantId: l.variantId, change: -l.qty })));
      setLines([newLine(varietyOf(varietyId) ?? varieties?.[0] ?? null)]);
      return rec;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [priced, resolved, payMethod, phone, varietyId, varieties, varietyOf]);

  /** «Deshacer»: anula una venta (la última, si no se dice cuál) y devuelve el inventario. */
  const lastRef = useRef(null);
  lastRef.current = last;
  const voidLast = useCallback(async (rec = lastRef.current) => {
    if (!rec) return;
    await voidMicraSale({ orderId: rec.orderId, lines: rec.lines });
    moveLocalStock(rec.lines.map((l) => ({ variantId: l.variantId, change: l.qty })));
    setAttachedOrderId((id) => (id === rec.orderId ? null : id));
    setLast((l) => (l?.orderId === rec.orderId ? null : l));
  }, []);

  /** Pedido que va con la tarjeta que se publica (o null). */
  const linkedOrderId = useCallback(({ kind: k, varietyId: vid }) => {
    if (attachedOrderId) return attachedOrderId;
    if (k !== 'recipe' || !last || last.published) return null;
    if (!last.varietyIds.includes(String(vid)) || Date.now() - last.at > LINK_MS) return null;
    return last.orderId;
  }, [attachedOrderId, last]);
  const markPublished = useCallback((orderId) => {
    setLast((l) => (l && l.orderId === orderId ? { ...l, published: true } : l));
  }, []);
  /** «Nueva tarjeta»: ticket nuevo; la venta enlazable sigue si no se usó. */
  const newCard = useCallback(() => {
    setAttachedOrderId(null);
    resetTicket();
  }, [resetTicket]);

  // Texto del sticker de precio: la presentación del ticket para la variedad del filtro
  const priceFor = useCallback((vid) => {
    const line = resolved.find((l) => String(l.varietyId) === String(vid) && l.variant);
    const variant = line?.variant ?? variantsOf(varietyOf(vid))[0];
    return variant ? `${UP(variant.label)} · ${money(variant.price)}` : null;
  }, [resolved, varietyOf]);

  return {
    lines: resolved, setLine, addLine, removeLine, resetTicket, newCard,
    payMethod, setPayMethod, phone, setPhone,
    total, priced, priceFor, stock, stockFor, loadStock, shortages,
    busy, error, setError, register, last, attachedOrderId, linkedOrderId, voidLast, markPublished,
  };
}

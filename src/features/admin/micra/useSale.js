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
  const [last, setLast] = useState(null); // { orderId, total, lines, stock:[{variantId, applied}], varietyIds, at, published }
  const [attached, setAttached] = useState(null); // venta pegada a la tarjeta del editor
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
  // Ticket nuevo: el café del filtro, una unidad y sin el WhatsApp del cliente anterior
  const resetTicket = useCallback(() => {
    setLines([newLine(varietyOf(varietyId) ?? varieties?.[0] ?? null)]);
    setPhone('');
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
  /** Líneas cuya presentación no alcanza (sumando todas las líneas de esa presentación). */
  const shortages = useCallback(() => {
    const want = new Map();
    for (const l of resolved) if (l.variant) want.set(l.variant.id, (want.get(l.variant.id) || 0) + l.qty);
    return resolved.filter((l) => {
      const st = l.variant && stock?.[l.variant.id];
      return st && st.qty < want.get(l.variant.id);
    });
  }, [resolved, stock]);

  /**
   * Registra el ticket. `attach`: la venta queda pegada a la tarjeta del
   * editor (y reemplaza a la que estuviera pegada).
   */
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
        stock: r.stock,
        stockError: r.stockError,
        varietyIds: [...new Set(resolved.map((l) => String(l.varietyId)))],
        phone: waDigits(phone) || null, // para «Enviar a › WhatsApp» de esta tarjeta
        at: Date.now(),
        published: false,
      };
      setLast(rec);
      setAttached(attach ? rec : null);
      moveLocalStock(r.stock.map((x) => ({ variantId: x.variantId, change: x.applied })));
      // El siguiente cliente arranca con el mismo café y presentación, una unidad
      const first = lines[0];
      setLines([{ ...(first ?? newLine(varietyOf(varietyId))), key: nextKey++, qty: 1 }]);
      setPhone('');
      return rec;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [priced, resolved, payMethod, phone, lines, varietyId, varietyOf]);

  /** «Deshacer»: anula una venta (la última, si no se dice cuál) y devuelve el inventario. Una sola vez por venta. */
  const lastRef = useRef(null);
  lastRef.current = last;
  const voided = useRef(new Set());
  const voidLast = useCallback(async (rec = lastRef.current) => {
    if (!rec || voided.current.has(rec.orderId)) return;
    voided.current.add(rec.orderId);
    let partial = null;
    try {
      const r = await voidMicraSale({ orderId: rec.orderId, stock: rec.stock });
      if (!r.alreadyVoided) moveLocalStock(rec.stock.map((x) => ({ variantId: x.variantId, change: -x.applied })));
    } catch (e) {
      // Si el pedido no se anuló, se puede volver a intentar; si se anuló pero falló el inventario, no
      if (!/se anuló/.test(e.message)) { voided.current.delete(rec.orderId); throw e; }
      partial = e;
    }
    setAttached((a) => (a?.orderId === rec.orderId ? null : a));
    setLast((l) => (l?.orderId === rec.orderId ? null : l));
    if (partial) throw partial;
  }, []);
  const isVoided = useCallback((orderId) => voided.current.has(orderId), []);

  /** Venta que va con la tarjeta que se publica (o null): la pegada a la tarjeta, o la última de esa variedad en 10 min. */
  const linkedSale = useCallback(({ kind: k, varietyId: vid }) => {
    if (attached && !attached.published) return attached;
    if (k !== 'recipe' || !last || last.published) return null;
    if (!last.varietyIds.includes(String(vid)) || Date.now() - last.at > LINK_MS) return null;
    return last;
  }, [attached, last]);
  const linkedOrderId = useCallback((q) => linkedSale(q)?.orderId ?? null, [linkedSale]);
  /**
   * Ya se publicó con este pedido: no se vuelve a enlazar a otra tarjeta, pero
   * esta tarjeta sigue mostrándose vendida (para no invitar a registrarla otra vez).
   */
  const markPublished = useCallback((orderId) => {
    const l = lastRef.current;
    setLast((x) => (x && x.orderId === orderId ? { ...x, published: true } : x));
    setAttached((a) => (a?.orderId === orderId ? { ...a, published: true } : l?.orderId === orderId ? { ...l, published: true } : a));
  }, []);
  /** Se dejó la tarjeta (volver a la cámara): la venta pegada a ella se suelta. */
  const releaseCard = useCallback(() => setAttached(null), []);
  /** «Nueva tarjeta»: ticket nuevo; la venta enlazable sigue si no se usó. */
  const newCard = useCallback(() => {
    setAttached(null);
    resetTicket();
  }, [resetTicket]);

  // Texto del sticker de precio: la presentación del ticket para la variedad del filtro
  const priceFor = useCallback((vid) => {
    const line = resolved.find((l) => String(l.varietyId) === String(vid) && l.variant);
    const variant = line?.variant ?? variantsOf(varietyOf(vid))[0];
    return variant ? `${UP(variant.label)} · ${money(variant.price)}` : null;
  }, [resolved, varietyOf]);

  return {
    lines: resolved, setLine, addLine, removeLine, resetTicket, newCard, releaseCard,
    payMethod, setPayMethod, phone, setPhone,
    total, priced, priceFor, stock, stockFor, loadStock, shortages,
    busy, error, setError, register, last, linkedSale, linkedOrderId, voidLast, isVoided, markPublished,
    cardSale: attached, // la venta de la tarjeta en el editor (publicada o no)
  };
}

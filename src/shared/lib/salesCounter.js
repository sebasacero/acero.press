import { supabase } from './supabaseClient.js';

/**
 * Devuelve { coffee_bag: {qty, amount}, aeropress_equipment: {qty, amount}, total: number }.
 * Solo cuenta ventas confirmadas/completadas (nunca pedidos pendientes).
 */
export async function fetchSalesCounts() {
  const { data, error } = await supabase.rpc('get_sales_counts');

  const counts = {
    coffee_bag: { qty: 0, amount: 0 },
    aeropress_equipment: { qty: 0, amount: 0 },
  };
  if (error) {
    console.error('Error trayendo el contador de ventas:', error.message);
    return { ...counts, total: 0 };
  }
  (data ?? []).forEach((row) => {
    if (row.category in counts) {
      counts[row.category] = { qty: Number(row.total_qty), amount: Number(row.total_amount) };
    }
  });
  const total = counts.coffee_bag.amount + counts.aeropress_equipment.amount;
  return { ...counts, total };
}

/**
 * Últimas ventas confirmadas, para el historial del odómetro. Solo trae datos
 * ya agregados y no sensibles (categoría, nombre del producto, monto, fecha).
 */
export async function fetchRecentSales(limit = 20) {
  const { data, error } = await supabase.rpc('get_recent_sales', { sale_limit: limit });
  if (error) {
    console.error('Error trayendo el historial de ventas:', error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: `${row.product_name}-${row.sold_at}`,
    type: row.category === 'aeropress_equipment' ? 'prep' : 'bag',
    label: row.product_name,
    amount: Number(row.amount),
    at: row.sold_at ? new Date(row.sold_at).getTime() : Date.now(),
  }));
}


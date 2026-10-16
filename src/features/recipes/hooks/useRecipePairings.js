import { useEffect, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { fetchProductsByIds } from '../../../shared/lib/catalog.js';

/**
 * Café recomendado y kit de cada receta campeona (tabla recipe_pairings).
 * Devuelve { [año]: { coffee, size, extras: [producto], note } } con los
 * productos ya listos para el carrito. Si la tabla aún no existe o una receta
 * no tiene emparejamiento, esa receta simplemente no muestra kit.
 */
export default function useRecipePairings() {
  const [pairings, setPairings] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('recipe_pairings').select('recipe_year, coffee_id, coffee_size, kit_ids, note');
      if (error || !data?.length) return;
      const ids = [...new Set(data.flatMap((r) => [r.coffee_id, ...(r.kit_ids ?? [])]).filter(Boolean))];
      const products = await fetchProductsByIds(ids);
      const byUuid = Object.fromEntries(products.map((p) => [p.uuid, p]));
      const out = {};
      for (const r of data) {
        const coffee = byUuid[r.coffee_id];
        if (!coffee) continue; // café borrado u oculto: sin kit
        out[r.recipe_year] = {
          coffee,
          size: coffee.prices[r.coffee_size] != null ? r.coffee_size : coffee.sizes[0],
          extras: (r.kit_ids ?? []).map((id) => byUuid[id]).filter(Boolean),
          note: r.note ?? null,
        };
      }
      if (active) setPairings(out);
    })();
    return () => { active = false; };
  }, []);

  return pairings;
}

import { useEffect, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { fetchCoffeeVarieties, fetchAeropressProducts } from '../../../shared/lib/catalog.js';
import { resolvePairings } from '../../../shared/lib/pairing.js';
import recipes from '../data/recipes.js';

/**
 * Café recomendado y kit de cada receta campeona.
 * Prioridad: manual (Panel → Recetas) > agente (ajuste con ventas y mercado)
 * > automático (regla de la página, sin IA). Así toda receta tiene kit en
 * cuanto haya cafés en el catálogo.
 * Devuelve { [año]: { coffee, size, extras: [producto], note, source } }.
 */
export default function useRecipePairings() {
  const [pairings, setPairings] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      const [coffees, gear, rows] = await Promise.all([
        fetchCoffeeVarieties(),
        fetchAeropressProducts(),
        supabase.from('recipe_pairings').select('*').then(({ data, error }) => (error ? [] : data ?? [])),
      ]);
      const out = resolvePairings(recipes, coffees, gear, rows);
      if (active) setPairings(out);
    })();
    return () => { active = false; };
  }, []);

  return pairings;
}

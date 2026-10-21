import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { mapLayers, summarize } from './streetMap.js';

/** Lee el mapa del estudio. Si la función no existe aún o falla, devuelve null (el mapa dibuja el ejemplo). */
export async function fetchStreetMap(days = 90) {
  try {
    const { data, error } = await supabase.rpc('micra_street_map', { p_days: days });
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// Las capas reales del mapa del estudio de calle, cargadas una vez. Mientras
// el estudio está vacío (o la función aún no existe), `layers` queda en null y
// el mapa dibuja su demanda de ejemplo, como siempre.
export function useStreetMap(days = 90) {
  const [state, setState] = useState({ layers: null, summary: null, loading: true });
  useEffect(() => {
    let alive = true;
    fetchStreetMap(days).then((map) => {
      if (!alive) return;
      const layers = mapLayers(map);
      setState({ layers: layers.real ? layers : null, summary: summarize(map), loading: false });
    });
    return () => { alive = false; };
  }, [days]);
  return state;
}

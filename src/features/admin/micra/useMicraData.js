import { useEffect, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { fetchBogotaWeather } from '../../../shared/lib/weather.js';

/** Variedades del catálogo, clima de Bogotá (una vez) y un reloj de 30 s. */
export function useMicraData() {
  const [varieties, setVarieties] = useState(null);
  const [weather, setWeather] = useState({ tempC: null, condition: '', icon: '' });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    supabase
      .from('products')
      .select('id, name, recipe_text, image_url, product_variants(id, label, price, active)')
      .eq('category', 'coffee_bag')
      .eq('active', true)
      .then(({ data, error }) => {
        if (error) console.error('Error cargando variedades:', error.message);
        if (alive) setVarieties(data ?? []);
      });
    fetchBogotaWeather().then((w) => { if (alive) setWeather(w); });
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return { varieties, weather, now, minuteKey: `${now.getHours()}:${now.getMinutes()}` };
}

/** Presentaciones activas de una variedad, de la más barata a la más cara. */
export const variantsOf = (variety) => (variety?.product_variants ?? [])
  .filter((v) => v.active)
  .sort((a, b) => Number(a.price) - Number(b.price));

// Open-Meteo es una API pública y gratuita de clima que no requiere API key.
// https://open-meteo.com
const BOGOTA_LAT = 4.711;
const BOGOTA_LON = -74.0721;

const WEATHER_CODES = {
  0: { es: 'Despejado', icon: '☀️' },
  1: { es: 'Mayormente despejado', icon: '🌤️' },
  2: { es: 'Parcialmente nublado', icon: '⛅' },
  3: { es: 'Nublado', icon: '☁️' },
  45: { es: 'Neblina', icon: '🌫️' },
  48: { es: 'Neblina', icon: '🌫️' },
  51: { es: 'Llovizna', icon: '🌦️' },
  53: { es: 'Llovizna', icon: '🌦️' },
  55: { es: 'Llovizna', icon: '🌦️' },
  61: { es: 'Lluvia ligera', icon: '🌧️' },
  63: { es: 'Lluvia', icon: '🌧️' },
  65: { es: 'Lluvia fuerte', icon: '🌧️' },
  80: { es: 'Chubascos', icon: '🌦️' },
  81: { es: 'Chubascos', icon: '🌦️' },
  82: { es: 'Chubascos fuertes', icon: '⛈️' },
  95: { es: 'Tormenta', icon: '⛈️' },
};

export async function fetchBogotaWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${BOGOTA_LAT}&longitude=${BOGOTA_LON}&current=temperature_2m,weather_code`;
    const res = await fetch(url);
    const data = await res.json();
    const temp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const info = WEATHER_CODES[code] || { es: 'Variable', icon: '🌡️' };
    return { tempC: temp, condition: info.es, icon: info.icon };
  } catch (err) {
    console.error('Error trayendo el clima de Bogotá:', err);
    return { tempC: null, condition: 'Bogotá', icon: '🌡️' };
  }
}

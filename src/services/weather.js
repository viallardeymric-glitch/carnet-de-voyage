// Météo actuelle et du jour (Open-Meteo, gratuit, sans clé).
const CODES = {
  0: ['Ciel dégagé', 'sunny'], 1: ['Plutôt dégagé', 'partly-sunny'], 2: ['Nuageux', 'partly-sunny'],
  3: ['Couvert', 'cloudy'], 45: ['Brouillard', 'cloudy'], 48: ['Brouillard givrant', 'cloudy'],
  51: ['Bruine', 'rainy'], 53: ['Bruine', 'rainy'], 55: ['Bruine forte', 'rainy'],
  61: ['Pluie faible', 'rainy'], 63: ['Pluie', 'rainy'], 65: ['Forte pluie', 'rainy'],
  71: ['Neige faible', 'snow'], 73: ['Neige', 'snow'], 75: ['Forte neige', 'snow'],
  80: ['Averses', 'rainy'], 81: ['Averses', 'rainy'], 82: ['Fortes averses', 'thunderstorm'],
  95: ['Orage', 'thunderstorm'],
};

export async function getWeather({ lat, lon }) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  const j = await res.json();
  const code = j.current?.weather_code ?? 0;
  const [label, icon] = CODES[code] || ['Variable', 'partly-sunny'];
  return {
    temp: Math.round(j.current?.temperature_2m),
    min: Math.round(j.daily?.temperature_2m_min?.[0]),
    max: Math.round(j.daily?.temperature_2m_max?.[0]),
    rainChance: j.daily?.precipitation_probability_max?.[0] ?? null,
    wind: Math.round(j.current?.wind_speed_10m ?? 0),
    label,
    icon,
    rainy: code >= 51 || (j.current?.precipitation ?? 0) > 0,
  };
}

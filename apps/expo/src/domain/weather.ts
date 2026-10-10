// Météo : lecture d'une réponse Open-Meteo (https://open-meteo.com, licence CC BY 4.0) et conseils de journée.
// Logique pure et défensive : une réponse incomplète donne moins d'informations, jamais un plantage.
// Ce sont des PRÉVISIONS (modèles météo), jamais une mesure : l'interface le dit.

export const FORECAST_DAYS = 16;

export type Sky = 'clair' | 'nuageux' | 'brouillard' | 'bruine' | 'pluie' | 'neige' | 'orage';
/** Nom d'icône de l'appli (voir ui/Icon). */
export type WeatherIcon = 'sunny' | 'partlySunny' | 'cloudy' | 'fog' | 'rainy' | 'snow' | 'storm' | 'thermometer';

const WMO: Record<number, { label: string; sky: Sky; icon: WeatherIcon }> = {
  0: { label: 'Ciel dégagé', sky: 'clair', icon: 'sunny' }, 1: { label: 'Plutôt dégagé', sky: 'clair', icon: 'partlySunny' },
  2: { label: 'Partiellement nuageux', sky: 'nuageux', icon: 'partlySunny' }, 3: { label: 'Couvert', sky: 'nuageux', icon: 'cloudy' },
  45: { label: 'Brouillard', sky: 'brouillard', icon: 'fog' }, 48: { label: 'Brouillard givrant', sky: 'brouillard', icon: 'fog' },
  51: { label: 'Bruine légère', sky: 'bruine', icon: 'rainy' }, 53: { label: 'Bruine', sky: 'bruine', icon: 'rainy' }, 55: { label: 'Bruine forte', sky: 'bruine', icon: 'rainy' },
  56: { label: 'Bruine verglaçante', sky: 'bruine', icon: 'rainy' }, 57: { label: 'Bruine verglaçante forte', sky: 'bruine', icon: 'rainy' },
  61: { label: 'Pluie légère', sky: 'pluie', icon: 'rainy' }, 63: { label: 'Pluie', sky: 'pluie', icon: 'rainy' }, 65: { label: 'Pluie forte', sky: 'pluie', icon: 'rainy' },
  66: { label: 'Pluie verglaçante', sky: 'pluie', icon: 'rainy' }, 67: { label: 'Pluie verglaçante forte', sky: 'pluie', icon: 'rainy' },
  71: { label: 'Neige légère', sky: 'neige', icon: 'snow' }, 73: { label: 'Neige', sky: 'neige', icon: 'snow' }, 75: { label: 'Neige forte', sky: 'neige', icon: 'snow' }, 77: { label: 'Grains de neige', sky: 'neige', icon: 'snow' },
  80: { label: 'Averses légères', sky: 'pluie', icon: 'rainy' }, 81: { label: 'Averses', sky: 'pluie', icon: 'rainy' }, 82: { label: 'Averses violentes', sky: 'pluie', icon: 'storm' },
  85: { label: 'Averses de neige', sky: 'neige', icon: 'snow' }, 86: { label: 'Fortes averses de neige', sky: 'neige', icon: 'snow' },
  95: { label: 'Orage', sky: 'orage', icon: 'storm' }, 96: { label: 'Orage et grêle', sky: 'orage', icon: 'storm' }, 99: { label: 'Orage et forte grêle', sky: 'orage', icon: 'storm' },
};

export function describeCode(code: number | null | undefined): { label: string; sky: Sky; icon: WeatherIcon } {
  return (code != null ? WMO[code] : undefined) ?? { label: 'Météo indisponible', sky: 'nuageux', icon: 'thermometer' };
}

export interface HourForecast { time: string; temp: number | null; feels: number | null; rainProb: number | null; code: number | null; wind: number | null; humidity: number | null }
export interface DayForecast { date: string; code: number | null; min: number | null; max: number | null; rainProb: number | null }
export interface CurrentWeather { temp: number | null; feels: number | null; code: number | null; wind: number | null; humidity: number | null; rain: number | null }
export interface Forecast { current: CurrentWeather | null; days: DayForecast[]; hours: HourForecast[]; /** Heure de récupération (ms), ajoutée par la couche données : sert à afficher la fraîcheur. */ fetchedAt?: number }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/** Adresse de la requête (aucune clé d'API n'est nécessaire pour l'offre gratuite). */
export function forecastUrl(lat: number, lng: number): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4), longitude: lng.toFixed(4), timezone: 'auto', forecast_days: String(FORECAST_DAYS),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,precipitation',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}

export function parseForecast(json: unknown): Forecast {
  const root = obj(json);
  const c = obj(root.current);
  const current: CurrentWeather | null = Object.keys(c).length ? {
    temp: num(c.temperature_2m), feels: num(c.apparent_temperature), code: num(c.weather_code), wind: num(c.wind_speed_10m), humidity: num(c.relative_humidity_2m), rain: num(c.precipitation),
  } : null;
  const d = obj(root.daily);
  const days = arr(d.time).map((t, i): DayForecast => ({
    date: String(t), code: num(arr(d.weather_code)[i]), min: num(arr(d.temperature_2m_min)[i]), max: num(arr(d.temperature_2m_max)[i]), rainProb: num(arr(d.precipitation_probability_max)[i]),
  }));
  const h = obj(root.hourly);
  const hours = arr(h.time).map((t, i): HourForecast => ({
    time: String(t), temp: num(arr(h.temperature_2m)[i]), feels: num(arr(h.apparent_temperature)[i]), rainProb: num(arr(h.precipitation_probability)[i]),
    code: num(arr(h.weather_code)[i]), wind: num(arr(h.wind_speed_10m)[i]), humidity: num(arr(h.relative_humidity_2m)[i]),
  }));
  return { current, days, hours };
}

/** Une date est couverte si elle est dans les 16 prochains jours (aujourd'hui compris). */
export function isCovered(date: string, today: string): boolean {
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return diff >= 0 && diff < FORECAST_DAYS;
}

export const OUTDOOR_ROOTS = ['nature', 'sport'];
export const RAIN_THRESHOLD = 60;

export interface DayWeather {
  day: DayForecast;
  /** Première et dernière heure (de 9 h à 21 h) où la pluie est probable, sinon null. */
  rainFrom: number | null;
  rainTo: number | null;
  advice: string | null;
}

const hourOf = (time: string): number => Number(time.slice(11, 13));

/** Météo d'un jour et conseil : pluie probable + une activité de plein air prévue → privilégier l'intérieur. */
export function weatherForDay(f: Forecast, date: string, roots: (string | null)[]): DayWeather | null {
  const day = f.days.find((d) => d.date === date);
  if (!day) return null;
  const wet = f.hours.filter((h) => h.time.startsWith(date) && hourOf(h.time) >= 9 && hourOf(h.time) <= 21 && (h.rainProb ?? 0) >= RAIN_THRESHOLD);
  const rainFrom = wet.length ? hourOf(wet[0].time) : null;
  const rainTo = wet.length ? hourOf(wet[wet.length - 1].time) : null;
  const risky = rainFrom !== null || describeCode(day.code).sky === 'orage' || describeCode(day.code).sky === 'neige';
  const outdoor = roots.some((r) => r != null && OUTDOOR_ROOTS.includes(r));
  let advice: string | null = null;
  if (risky && outdoor) advice = rainFrom !== null ? `Pluie probable de ${rainFrom} h à ${rainTo! + 1} h : garde les activités d'intérieur pour ce moment-là.` : 'Météo instable : prévois une activité d\'intérieur en secours.';
  else if (rainFrom !== null) advice = `Pluie probable de ${rainFrom} h à ${rainTo! + 1} h : prends un parapluie.`;
  return { day, rainFrom, rainTo, advice };
}

/** Résumé court d'une journée : « 14° / 21° ». */
export const tempRange = (d: DayForecast): string => (d.min != null && d.max != null ? `${Math.round(d.min)}° / ${Math.round(d.max)}°` : d.max != null ? `${Math.round(d.max)}°` : '—');

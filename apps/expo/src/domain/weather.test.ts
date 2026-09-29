import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCode, forecastUrl, isCovered, parseForecast, tempRange, weatherForDay } from './weather.ts';

const hours = (date: string, rainy: number[]) => Array.from({ length: 24 }, (_, h) => ({ t: `${date}T${String(h).padStart(2, '0')}:00`, p: rainy.includes(h) ? 80 : 10 }));
function fixture(date = '2026-10-14', rainy: number[] = []) {
  const hs = hours(date, rainy);
  return {
    current: { temperature_2m: 18.4, apparent_temperature: 17, weather_code: 3, wind_speed_10m: 12, relative_humidity_2m: 70, precipitation: 0 },
    daily: { time: [date], weather_code: [61], temperature_2m_max: [21.2], temperature_2m_min: [14.1], precipitation_probability_max: [80] },
    hourly: { time: hs.map((h) => h.t), precipitation_probability: hs.map((h) => h.p), temperature_2m: hs.map(() => 17), apparent_temperature: hs.map(() => 16), weather_code: hs.map(() => 3), wind_speed_10m: hs.map(() => 10), relative_humidity_2m: hs.map(() => 60) },
  };
}

test('adresse de requête : coordonnées, fuseau automatique, 16 jours, sans clé', () => {
  const u = forecastUrl(38.7223, -9.1393);
  assert.match(u, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
  assert.match(u, /latitude=38\.7223/); assert.match(u, /longitude=-9\.1393/); assert.match(u, /forecast_days=16/); assert.match(u, /timezone=auto/);
  assert.ok(!/key/i.test(u));
});

test('lecture de la réponse', () => {
  const f = parseForecast(fixture());
  assert.equal(f.current?.temp, 18.4);
  assert.equal(f.days[0].max, 21.2);
  assert.equal(f.hours.length, 24);
  assert.equal(tempRange(f.days[0]), '14° / 21°');
});

test('réponse vide ou incohérente : aucun plantage', () => {
  for (const bad of [null, undefined, 'x', 42, {}, { daily: { time: ['2026-10-14'] } }, { hourly: { time: 'nope' } }]) {
    const f = parseForecast(bad);
    assert.ok(Array.isArray(f.days) && Array.isArray(f.hours));
  }
  assert.equal(parseForecast({}).current, null);
  assert.equal(parseForecast({ daily: { time: ['2026-10-14'] } }).days[0].max, null);
});

test('codes météo connus et inconnus', () => {
  assert.equal(describeCode(0).sky, 'clair');
  assert.equal(describeCode(95).sky, 'orage');
  assert.equal(describeCode(63).label, 'Pluie');
  assert.equal(describeCode(1234).label, 'Météo indisponible');
  assert.equal(describeCode(null).sky, 'nuageux');
});

test('couverture des prévisions : aujourd\'hui à J+15, jamais le passé', () => {
  assert.equal(isCovered('2026-10-01', '2026-10-01'), true);
  assert.equal(isCovered('2026-10-16', '2026-10-01'), true);
  assert.equal(isCovered('2026-10-17', '2026-10-01'), false);
  assert.equal(isCovered('2026-09-30', '2026-10-01'), false);
});

test('pluie l\'après-midi + activité de plein air : conseil d\'intérieur avec la plage horaire', () => {
  const w = weatherForDay(parseForecast(fixture('2026-10-14', [14, 15, 16])), '2026-10-14', ['nature', 'culture'])!;
  assert.equal(w.rainFrom, 14); assert.equal(w.rainTo, 16);
  assert.match(w.advice ?? '', /14 h à 17 h.*intérieur/);
});

test('pluie sans plein air : simple parapluie ; jour sec : aucun conseil', () => {
  const rainy = weatherForDay(parseForecast(fixture('2026-10-14', [10])), '2026-10-14', ['culture'])!;
  assert.match(rainy.advice ?? '', /parapluie/);
  const dry = weatherForDay(parseForecast(fixture('2026-10-14', [])), '2026-10-14', ['nature'])!;
  assert.equal(dry.rainFrom, null);
  assert.equal(dry.advice, null);
});

test('pluie la nuit (hors 9 h–21 h) ignorée ; date absente = null', () => {
  const night = weatherForDay(parseForecast(fixture('2026-10-14', [2, 3, 23])), '2026-10-14', ['nature'])!;
  assert.equal(night.rainFrom, null);
  assert.equal(weatherForDay(parseForecast(fixture()), '2026-12-25', []), null);
});

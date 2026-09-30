// Prévisions météo (Open-Meteo, offre gratuite sans clé). Mémorisées 30 minutes par lieu pour économiser les appels.
// ATTENTION licence : l'offre gratuite est réservée à un usage NON commercial ; une publication commerciale sur le Play Store
// demande un abonnement Open-Meteo (ou un autre fournisseur). Voir docs/BACKEND.md. Seul ce fichier appelle le service.
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { forecastUrl, parseForecast } from '../domain/weather.ts';
import type { Forecast } from '../domain/weather.ts';

const TTL = 30 * 60_000;
const STORE = 'waypoint.weather.';
const cache = new Map<string, { at: number; forecast: Forecast }>();

export async function fetchForecast(lat: number, lng: number): Promise<{ forecast: Forecast | null; error: string | null }> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  let hit = cache.get(key);
  // Dernière prévision connue sur l'appareil : affichée hors connexion, avec son heure de mise à jour.
  if (!hit) {
    try {
      const raw = await AsyncStorage.getItem(STORE + key);
      if (raw) { const saved = JSON.parse(raw) as { at: number; forecast: Forecast }; hit = saved; cache.set(key, saved); }
    } catch { /* stockage indisponible : on continue sans */ }
  }
  if (hit && Date.now() - hit.at < TTL) return { forecast: hit.forecast, error: null };
  try {
    const res = await fetch(forecastUrl(lat, lng), { signal: AbortSignal.timeout(8000) });
    if (res.status === 429) return { forecast: hit?.forecast ?? null, error: 'Trop de demandes météo : réessaie dans quelques minutes.' };
    if (!res.ok) return { forecast: hit?.forecast ?? null, error: 'Le service météo ne répond pas pour le moment.' };
    const forecast = { ...parseForecast(await res.json()), fetchedAt: Date.now() };
    cache.set(key, { at: Date.now(), forecast });
    void AsyncStorage.setItem(STORE + key, JSON.stringify({ at: Date.now(), forecast })).catch(() => {});
    return { forecast, error: null };
  } catch {
    return { forecast: hit?.forecast ?? null, error: 'Météo indisponible (connexion ?). Les prévisions reviendront avec le réseau.' };
  }
}

export interface Spot { id: number; lat: number; lng: number }

/** Prévisions de chaque ville du voyage, chargées une fois. */
export function useForecasts(spots: Spot[]): { forecasts: Map<number, Forecast>; loading: boolean; error: string | null } {
  const key = spots.map((s) => `${s.id}:${s.lat}:${s.lng}`).join('|');
  const stable = useMemo(() => spots, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- suivi par contenu
  const [state, setState] = useState<{ forecasts: Map<number, Forecast>; loading: boolean; error: string | null }>({ forecasts: new Map(), loading: stable.length > 0, error: null });
  useEffect(() => {
    let alive = true;
    if (!stable.length) { setState({ forecasts: new Map(), loading: false, error: null }); return; }
    setState((s) => ({ ...s, loading: true }));
    void Promise.all(stable.map(async (s) => ({ id: s.id, ...(await fetchForecast(s.lat, s.lng)) }))).then((all) => {
      if (!alive) return;
      const forecasts = new Map<number, Forecast>();
      for (const r of all) if (r.forecast) forecasts.set(r.id, r.forecast);
      setState({ forecasts, loading: false, error: all.find((r) => r.error)?.error ?? null });
    });
    return () => { alive = false; };
  }, [stable]);
  return state;
}

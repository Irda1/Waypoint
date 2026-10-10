// Photo des villes sans photo en base : cherchée sur Wikipédia (français, puis anglais) au moment où le voyage s'affiche,
// gardée sur l'appareil pour les fois suivantes. Pendant la recherche (ou si rien ne convient), l'écran garde la photo du pays.
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { photoFromSummary } from '../domain/cityPhoto.ts';
import type { FoundPhoto, WikiSummary } from '../domain/cityPhoto.ts';
import type { CityCover } from './cityCover';

const KEY = 'waypoint.cityphoto.v1.';
const TIMEOUT_MS = 6000;
// Un échec est retenté au plus une fois par semaine.
const RETRY_MS = 7 * 24 * 3600 * 1000;

interface City { city_id: number; name: string; lat: number; lng: number; cover: CityCover | null }
type Cached = { photo: FoundPhoto | null; at: number };

async function lookup(name: string, lat: number, lng: number): Promise<FoundPhoto | null> {
  for (const lang of ['fr', 'en']) {
    try {
      const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}?redirect=true`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      const photo = photoFromSummary((await res.json()) as WikiSummary, lat, lng);
      if (photo) return photo;
    } catch { /* réseau lent ou coupé : on essaie la langue suivante */ }
  }
  return null;
}

/** Photos trouvées pour les villes qui n'en ont pas en base, par identifiant de ville (les autres sont absentes de la carte). */
export function useCityPhotos(cities: City[]): Map<number, CityCover> {
  const [found, setFound] = useState<Map<number, CityCover>>(new Map());
  const missing = useMemo(() => cities.filter((c) => !c.cover && c.name), [cities]);
  const key = missing.map((c) => c.city_id).join(',');
  useEffect(() => {
    let alive = true;
    for (const c of missing) {
      void (async () => {
        let cached: Cached | null = null;
        try { const raw = await AsyncStorage.getItem(KEY + c.city_id); cached = raw ? (JSON.parse(raw) as Cached) : null; } catch { /* stockage indisponible */ }
        let photo = cached?.photo ?? null;
        if (!cached || (!cached.photo && Date.now() - cached.at > RETRY_MS)) {
          photo = await lookup(c.name, c.lat, c.lng);
          try { await AsyncStorage.setItem(KEY + c.city_id, JSON.stringify({ photo, at: Date.now() } satisfies Cached)); } catch { /* idem */ }
        }
        if (alive && photo) setFound((m) => new Map(m).set(c.city_id, photo));
      })();
    }
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return found;
}

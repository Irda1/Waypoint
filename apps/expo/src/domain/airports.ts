import { AIRPORTS } from './airportData.ts';

/** Distance maximale entre le centre d'une ville et son aéroport pour dire qu'elle est desservie. */
const MAX_KM = 40;

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Code IATA de l'aéroport (vols réguliers) le plus proche d'une ville, s'il est à moins de `maxKm` (40 km par défaut) ; sinon null. */
export function airportNear(lat: number, lng: number, maxKm: number = MAX_KM): string | null {
  let best: string | null = null, bestKm = maxKm;
  for (const [aLat, aLng, iata] of AIRPORTS) {
    if (Math.abs(aLat - lat) > maxKm / 111 + 0.1) continue; // coup d'œil rapide sur la latitude
    const d = km(lat, lng, aLat, aLng);
    if (d < bestKm) { bestKm = d; best = iata; }
  }
  return best;
}

/** Aéroport le plus proche d'une ville (à moins de `maxKm`), avec sa distance ; null s'il n'y en a pas. */
function nearest(lat: number, lng: number, maxKm: number): { iata: string; km: number } | null {
  let best: { iata: string; km: number } | null = null;
  for (const [aLat, aLng, iata] of AIRPORTS) {
    if (Math.abs(aLat - lat) > maxKm / 111 + 0.1) continue;
    const d = km(lat, lng, aLat, aLng);
    if (d < (best?.km ?? maxKm)) best = { iata, km: d };
  }
  return best;
}

/**
 * Villes qui portent l'icône avion : chaque aéroport n'est attribué qu'à une seule ville parmi celles dont il est
 * l'aéroport le plus proche (sinon toutes les petites villes autour d'une grande en héritaient). `cities` est classé
 * par importance (la plus importante d'abord) : l'aéroport va à la plus importante, pas à la plus proche
 * (Haneda est dans l'arrondissement d'Ōta, mais c'est l'aéroport de Tokyo).
 */
export function airportCities(cities: ReadonlyArray<{ id: number; lat: number; lng: number }>, maxKm: number = MAX_KM): Set<number> {
  const owner = new Map<string, number>();
  for (const c of cities) {
    const a = nearest(c.lat, c.lng, maxKm);
    if (a && !owner.has(a.iata)) owner.set(a.iata, c.id);
  }
  return new Set(owner.values());
}

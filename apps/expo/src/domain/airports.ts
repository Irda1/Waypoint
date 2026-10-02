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

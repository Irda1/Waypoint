import { AIRPORTS } from './airportData.ts';

/** Distance maximale entre le centre d'une ville et son aéroport pour dire qu'elle est desservie. */
const MAX_KM = 40;

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Code IATA de l'aéroport (vols réguliers) le plus proche d'une ville, s'il est à moins de 40 km ; sinon null. */
export function airportNear(lat: number, lng: number): string | null {
  let best: string | null = null, bestKm = MAX_KM;
  for (const [aLat, aLng, iata] of AIRPORTS) {
    if (Math.abs(aLat - lat) > 0.6) continue; // coup d'œil rapide : ~65 km de latitude
    const d = km(lat, lng, aLat, aLng);
    if (d < bestKm) { bestKm = d; best = iata; }
  }
  return best;
}

// Itinéraires à pied : logique pure (testable avec Node). Le service est un serveur OSRM (profil « foot »).
// Les coordonnées sont toujours au format longitude,latitude dans l'adresse.
import type { LatLng } from './types.ts';

export interface WalkRoute { minutes: number; km: number }

export function walkRouteUrl(base: string, a: LatLng, b: LatLng): string {
  const p = (c: LatLng) => `${c.lng.toFixed(5)},${c.lat.toFixed(5)}`;
  return `${base.replace(/\/+$/, '')}/route/v1/foot/${p(a)};${p(b)}?overview=false`;
}

/** Durée (arrondie à la minute supérieure) et distance d'un trajet à pied ; null si la réponse n'est pas exploitable. */
export function parseWalkRoute(json: unknown): WalkRoute | null {
  const route = (json as { code?: string; routes?: { duration?: number; distance?: number }[] } | null);
  const r = route?.code === 'Ok' ? route.routes?.[0] : undefined;
  if (!r || typeof r.duration !== 'number' || typeof r.distance !== 'number' || r.duration < 0 || r.distance < 0) return null;
  return { minutes: Math.max(1, Math.ceil(r.duration / 60)), km: Math.round(r.distance / 10) / 100 };
}

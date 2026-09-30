// Itinéraires à pied réels (serveur OSRM public, profil « foot », sans clé). Un seul fichier appelle le service.
// ATTENTION usage : ce serveur public est prévu pour un usage léger (environ une requête par seconde, pas de garantie) ;
// avant une ouverture au public, héberger son propre serveur OSRM/Valhalla ou passer à un service payant, puis
// changer EXPO_PUBLIC_ROUTING_URL. En cas d'échec, l'appli garde l'estimation (« ≈ … · estimé »).
import { useEffect, useMemo, useState } from 'react';
import { parseWalkRoute, walkRouteUrl } from '../domain/routes.ts';
import type { WalkRoute } from '../domain/routes.ts';
import type { LatLng } from '../domain/types.ts';

const BASE = process.env.EXPO_PUBLIC_ROUTING_URL || 'https://routing.openstreetmap.de/routed-foot';
const cache = new Map<string, WalkRoute | null>();
let queue: Promise<unknown> = Promise.resolve();

const keyOf = (a: LatLng, b: LatLng) => `${a.lat.toFixed(5)},${a.lng.toFixed(5)};${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;

/** Une requête à la fois, espacées d'au moins 1 s ; les échecs sont mémorisés pour ne pas insister. */
export function fetchWalkRoute(a: LatLng, b: LatLng): Promise<WalkRoute | null> {
  const key = keyOf(a, b);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const job = queue.then(async () => {
    if (cache.has(key)) return cache.get(key) ?? null;
    let result: WalkRoute | null = null;
    try {
      const res = await fetch(walkRouteUrl(BASE, a, b), { signal: AbortSignal.timeout(8000) });
      if (res.ok) result = parseWalkRoute(await res.json());
    } catch { /* hors ligne ou service indisponible : on garde l'estimation */ }
    cache.set(key, result);
    await new Promise((r) => setTimeout(r, 1000));
    return result;
  });
  queue = job.catch(() => null);
  return job;
}

export interface Leg { key: string; from: LatLng; to: LatLng }

/** Itinéraires à pied des trajets donnés, par clé ; les trajets pas encore calculés sont absents de la table. */
export function useWalkRoutes(legs: Leg[]): Map<string, WalkRoute> {
  const sig = legs.map((l) => `${l.key}=${keyOf(l.from, l.to)}`).join('|');
  const stable = useMemo(() => legs, [sig]); // eslint-disable-line react-hooks/exhaustive-deps -- suivi par contenu
  const [routes, setRoutes] = useState<Map<string, WalkRoute>>(new Map());
  useEffect(() => {
    let alive = true;
    void (async () => {
      for (const l of stable) {
        const r = await fetchWalkRoute(l.from, l.to);
        if (!alive) return;
        if (r) setRoutes((prev) => new Map(prev).set(l.key, r));
      }
    })();
    return () => { alive = false; };
  }, [stable]);
  return routes;
}

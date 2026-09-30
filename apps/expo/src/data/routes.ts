// Itinéraires réels (serveur OSRM public de FOSSGIS, profils à pied, vélo et voiture, sans clé). Un seul fichier appelle le service.
// ATTENTION usage : ce serveur public est prévu pour un usage léger (environ une requête par seconde, pas de garantie) ;
// avant une ouverture au public, héberger son propre serveur OSRM/Valhalla ou passer à un service payant, puis
// changer EXPO_PUBLIC_ROUTING_URL. Les durées sont HORS circulation. En cas d'échec, l'appli garde l'estimation.
import { useEffect, useMemo, useState } from 'react';
import { PROFILE_OF, osrmUrl, parseOsrm } from '../domain/routes.ts';
import type { Mode, RealRoute, RealRoutes } from '../domain/routes.ts';
import type { LatLng } from '../domain/types.ts';

const BASE = process.env.EXPO_PUBLIC_ROUTING_URL || 'https://routing.openstreetmap.de';
const cache = new Map<string, RealRoute | null>();
let queue: Promise<unknown> = Promise.resolve();

const keyOf = (mode: string, a: LatLng, b: LatLng) => `${mode}:${a.lat.toFixed(5)},${a.lng.toFixed(5)};${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;

/** Une requête à la fois, espacées d'au moins 1 s ; les échecs sont mémorisés pour ne pas insister. */
export function fetchRoute(mode: Exclude<Mode, 'transit'>, a: LatLng, b: LatLng): Promise<RealRoute | null> {
  const key = keyOf(mode, a, b);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const job = queue.then(async () => {
    if (cache.has(key)) return cache.get(key) ?? null;
    let result: RealRoute | null = null;
    try {
      const res = await fetch(osrmUrl(BASE, PROFILE_OF[mode], a, b), { signal: AbortSignal.timeout(8000) });
      if (res.ok) result = parseOsrm(await res.json());
    } catch { /* hors ligne ou service indisponible : on garde l'estimation */ }
    cache.set(key, result);
    await new Promise((r) => setTimeout(r, 1000));
    return result;
  });
  queue = job.catch(() => null);
  return job;
}

/** Durées réelles à pied, à vélo et en voiture entre deux points, calculées seulement quand `enabled` (volet ouvert). */
export function useRealRoutes(from: LatLng, to: LatLng, enabled: boolean): RealRoutes {
  const sig = `${from.lat},${from.lng};${to.lat},${to.lng}`;
  const [routes, setRoutes] = useState<RealRoutes>({});
  const points = useMemo(() => ({ from, to }), [sig]); // eslint-disable-line react-hooks/exhaustive-deps -- suivi par contenu
  useEffect(() => { setRoutes({}); }, [sig]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void (async () => {
      for (const mode of ['walk', 'bike', 'car'] as const) {
        const r = await fetchRoute(mode, points.from, points.to);
        if (!alive) return;
        if (r) setRoutes((prev) => ({ ...prev, [mode]: r }));
      }
    })();
    return () => { alive = false; };
  }, [enabled, points]);
  return routes;
}

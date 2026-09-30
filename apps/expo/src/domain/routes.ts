// Trajets entre deux étapes : logique pure (testable avec Node).
//  * estimations de la maquette (à vol d'oiseau × 1,3, vitesses moyennes) pour les quatre modes ;
//  * durées réelles (serveur OSRM, hors circulation) pour à pied, vélo et voiture quand elles sont connues ;
//  * liens Google Maps (format officiel « Maps URLs », sans clé) qui affichent ensuite horaires et trafic réels.
import { distanceKm, roundUp5 } from './planning.ts';
import type { LatLng } from './types.ts';

export type Mode = 'walk' | 'bike' | 'transit' | 'car';
export const MODES: readonly Mode[] = ['walk', 'bike', 'transit', 'car'];
export const MODE_LABEL: Record<Mode, string> = { walk: 'À pied', bike: 'À vélo', transit: 'Transports en commun', car: 'Voiture ou taxi' };
const GOOGLE_MODE: Record<Mode, string> = { walk: 'walking', bike: 'bicycling', transit: 'transit', car: 'driving' };

/** Un point de départ ou d'arrivée ; une adresse saisie (hébergement) est préférée aux coordonnées dans le lien Google Maps. */
export interface Point extends LatLng { address?: string | null }

export interface RealRoute { minutes: number; km: number }
export type RealRoutes = Partial<Record<Exclude<Mode, 'transit'>, RealRoute>>;

export interface TravelOption { mode: Mode; label: string; minutes: number; /** Vrai : itinéraire calculé (hors circulation) ; faux : estimation. */ real: boolean }

/** Estimation de la maquette : route = à vol d'oiseau × 1,3 ; 4,5 / 14 / 18 / 25 km/h, plus 8 min d'attente en transports et 5 min pour la voiture. */
export function estimateOptions(a: LatLng, b: LatLng): TravelOption[] {
  const route = distanceKm(a, b) * 1.3;
  const minutes: Record<Mode, number> = {
    walk: Math.max(3, Math.ceil((route / 4.5) * 60)),
    bike: Math.max(3, Math.ceil((route / 14) * 60)),
    transit: roundUp5((route / 18) * 60 + 8),
    car: roundUp5((route / 25) * 60 + 5),
  };
  return MODES.map((mode) => ({ mode, label: MODE_LABEL[mode], minutes: minutes[mode], real: false }));
}

/** Les quatre modes, avec la durée réelle à la place de l'estimation quand elle est connue (jamais pour les transports). */
export function travelOptions(a: LatLng, b: LatLng, real: RealRoutes = {}): TravelOption[] {
  return estimateOptions(a, b).map((o) => {
    const r = o.mode === 'transit' ? undefined : real[o.mode];
    return r ? { ...o, minutes: Math.max(1, r.minutes), real: true } : o;
  });
}

/** Le trajet le plus court ; à durée égale, le plus simple (à pied, vélo, transports, voiture). */
export function fastest(options: TravelOption[]): TravelOption {
  return options.reduce((best, o) => (o.minutes < best.minutes ? o : best));
}

const pointParam = (p: Point): string => (p.address?.trim() ? encodeURIComponent(p.address.trim()) : `${p.lat},${p.lng}`);

export function googleDirectionsUrl(from: Point, to: Point, mode: Mode): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${pointParam(from)}&destination=${pointParam(to)}&travelmode=${GOOGLE_MODE[mode]}`;
}

// ---- Itinéraires réels (OSRM) ----------------------------------------------
export type OsrmProfile = 'foot' | 'bike' | 'car';
export const PROFILE_OF: Record<Exclude<Mode, 'transit'>, OsrmProfile> = { walk: 'foot', bike: 'bike', car: 'car' };

/** Adresse d'une requête sur le serveur public FOSSGIS (`base` = racine du service ; longitude puis latitude). */
export function osrmUrl(base: string, profile: OsrmProfile, a: LatLng, b: LatLng): string {
  const p = (c: LatLng) => `${c.lng.toFixed(5)},${c.lat.toFixed(5)}`;
  return `${base.replace(/\/+$/, '')}/routed-${profile}/route/v1/${profile === 'car' ? 'driving' : profile}/${p(a)};${p(b)}?overview=false`;
}

/** Durée (arrondie à la minute supérieure) et distance ; null si la réponse n'est pas exploitable. */
export function parseOsrm(json: unknown): RealRoute | null {
  const res = json as { code?: string; routes?: { duration?: number; distance?: number }[] } | null;
  const r = res?.code === 'Ok' ? res.routes?.[0] : undefined;
  if (!r || typeof r.duration !== 'number' || typeof r.distance !== 'number' || r.duration < 0 || r.distance < 0) return null;
  return { minutes: Math.max(1, Math.ceil(r.duration / 60)), km: Math.round(r.distance / 10) / 100 };
}

/** « 600 m » (arrondi à 50 m) sous 1 km, sinon « 1,9 km ». */
export function formatKm(km: number): string {
  return km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

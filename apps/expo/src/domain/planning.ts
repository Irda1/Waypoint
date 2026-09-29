// Planification d'une journée — logique de la maquette (trajet(), hh(), horaires de fermeture)
// portée en TypeScript. Fonctions pures : aucune dépendance à l'interface ni au réseau.
import type { LatLng, Place, TripItem } from './types.ts';

// ---- Heures ---------------------------------------------------------------
/** « 09:30 » ou « 09:30:00 » -> minutes depuis minuit ; null si absent ou invalide. */
export function parseTime(value: string | null | undefined): number | null {
  const m = value?.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Minutes -> « HH:MM » (modulo 24 h, comme la maquette). */
export function formatTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export const roundUp5 = (m: number): number => Math.ceil(m / 5) * 5;

// ---- Distances et trajets --------------------------------------------------
/** Distance à vol d'oiseau en km (formule de haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2
    + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

export interface Travel {
  mode: 'walk' | 'transit';
  minutes: number;
  km: number;
  /** Toujours vrai : sans API d'itinéraire, la durée est estimée (à vol d'oiseau × 1,3). */
  estimated: true;
}

/** À pied sous 1,5 km, sinon transports en commun (8 min d'attente comprises). */
export function estimateTravel(a: LatLng, b: LatLng): Travel {
  const km = distanceKm(a, b);
  if (km < 1.5) return { mode: 'walk', minutes: Math.max(3, Math.ceil(((km * 1.3) / 4.5) * 60)), km, estimated: true };
  return { mode: 'transit', minutes: roundUp5(((km * 1.3) / 18) * 60 + 8), km, estimated: true };
}

// ---- Position dans une liste (glisser-déposer) -----------------------------
/**
 * Nouvelle position pour une étape déposée entre deux voisines : le milieu des deux.
 * Une seule ligne est modifiée en base (les autres amis ne voient qu'un changement).
 */
export function positionBetween(before: number | null | undefined, after: number | null | undefined): number {
  if (before == null && after == null) return 1;
  if (before == null) return (after as number) - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}

// ---- Journée -----------------------------------------------------------------
export type DayIssue =
  | { type: 'closed_day'; itemId: string }
  | { type: 'overlap'; itemId: string; minutes: number }
  | { type: 'no_time'; itemId: string };

export interface ScheduledItem {
  item: TripItem;
  place: Place | undefined;
  startMin: number | null;
  endMin: number | null;
  /** Trajet estimé depuis l'étape précédente (null pour la première ou sans coordonnées). */
  travelFromPrevious: Travel | null;
  issues: DayIssue[];
}

/** Jour de la semaine (0 = dimanche) d'une date « AAAA-MM-JJ », sans fuseau horaire. */
export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Organise les étapes d'un plan : tri par heure (puis position), fin = début + durée
 * (durée de l'étape, sinon durée estimée du lieu, sinon 60 min), trajets estimés entre
 * étapes consécutives, et alertes : lieu fermé ce jour-là, chevauchement (trajet compris).
 */
export function scheduleDay(args: {
  date: string;
  plan?: 'A' | 'B' | 'C';
  items: TripItem[];
  places: Map<number, Place>;
}): ScheduledItem[] {
  const plan = args.plan ?? 'A';
  const weekday = weekdayOf(args.date);
  const list = args.items
    .filter((i) => i.plan === plan)
    .map((item) => ({ item, place: item.place_id != null ? args.places.get(item.place_id) : undefined }))
    .sort((a, b) => {
      const ta = parseTime(a.item.start_time) ?? Number.POSITIVE_INFINITY;
      const tb = parseTime(b.item.start_time) ?? Number.POSITIVE_INFINITY;
      return ta - tb || a.item.position - b.item.position;
    });

  const out: ScheduledItem[] = [];
  let previous: ScheduledItem | null = null;
  for (const { item, place } of list) {
    const startMin = parseTime(item.start_time);
    const duration = item.duration_min ?? place?.visit_duration_min ?? 60;
    const endMin = startMin == null ? null : startMin + duration;
    const issues: DayIssue[] = [];
    if (startMin == null) issues.push({ type: 'no_time', itemId: item.id });
    if (place?.closed_days.includes(weekday)) issues.push({ type: 'closed_day', itemId: item.id });

    let travel: Travel | null = null;
    if (previous?.place && place) travel = estimateTravel(previous.place, place);
    if (previous?.endMin != null && startMin != null) {
      const needed = previous.endMin + (travel?.minutes ?? 0);
      if (startMin < needed) issues.push({ type: 'overlap', itemId: item.id, minutes: needed - startMin });
    }
    const scheduled: ScheduledItem = { item, place, startMin, endMin, travelFromPrevious: travel, issues };
    out.push(scheduled);
    previous = scheduled;
  }
  return out;
}

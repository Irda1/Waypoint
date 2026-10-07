// Mode « Simple » : une liste de lieux par ville, une sélection (cœurs) et son budget. Logique pure.
import { dayName, parseOpeningHours } from './openingHours.ts';
import { formatTime, weekdayOf } from './planning.ts';

export interface SimplePlace {
  id: number;
  city_id: number;
  name: string;
  category_code: string;
  lat: number;
  lng: number;
  price_amount: number | null;
  visit_duration_min: number | null;
  closed_days: number[];
  opening_hours: string | null;
  popularity: number;
}

/** Google Maps ouvert sur le lieu (recherche du nom, centrée sur ses coordonnées). */
export const mapsUrl = (p: Pick<SimplePlace, 'name' | 'lat' | 'lng'>): string =>
  `https://www.google.com/maps/search/${encodeURIComponent(p.name)}/@${p.lat},${p.lng},17z`;

/** « Ouvert 09:00–18:00 », « Fermé le lundi » ou null si on ne sait pas. */
export function openingToday(p: Pick<SimplePlace, 'opening_hours' | 'closed_days'>, isoDate: string): string | null {
  const wd = weekdayOf(isoDate);
  if (p.closed_days.includes(wd)) return `Fermé le ${dayName(wd)}`;
  const slots = parseOpeningHours(p.opening_hours)?.[wd];
  if (slots == null) return null;
  if (slots.length === 0) return `Fermé le ${dayName(wd)}`;
  return `Ouvert ${slots.map(([a, b]) => `${formatTime(a % 1440)}–${formatTime(b % 1440)}`).join(', ')}`;
}

/** Lieux d'une ville et/ou d'une grande catégorie (null = tous). */
export function filterPlaces(places: SimplePlace[], f: { cityId: number | null; root: string | null }, rootOf: (code: string) => string): SimplePlace[] {
  return places.filter((p) => (f.cityId == null || p.city_id === f.cityId) && (f.root == null || rootOf(p.category_code) === f.root));
}

export interface SelectionBudget {
  /** Total pour le groupe (prix estimés × voyageurs). */
  total: number;
  /** Par personne. */
  perPerson: number;
  /** Lieux sélectionnés sans prix connu : ils ne comptent pas dans le total. */
  unpriced: number;
  /** Détail par grande catégorie, du plus cher au moins cher. */
  byRoot: { root: string; amount: number; count: number }[];
}

export function selectionBudget(selected: SimplePlace[], travelers: number, rootOf: (code: string) => string): SelectionBudget {
  const n = Math.max(1, travelers);
  const by = new Map<string, { amount: number; count: number }>();
  let cents = 0, unpriced = 0;
  for (const p of selected) {
    if (p.price_amount == null) { unpriced++; continue; }
    const c = Math.round(p.price_amount * 100);
    cents += c;
    const root = rootOf(p.category_code);
    const cur = by.get(root) ?? { amount: 0, count: 0 };
    by.set(root, { amount: cur.amount + c * n / 100, count: cur.count + 1 });
  }
  return {
    total: cents * n / 100, perPerson: cents / 100, unpriced,
    byRoot: [...by.entries()].map(([root, v]) => ({ root, amount: v.amount, count: v.count })).sort((a, b) => b.amount - a.amount),
  };
}

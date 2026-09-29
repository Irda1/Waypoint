// Construction automatique d'un programme : logique pure (aucun réseau, aucune interface), testée avec Node.
// Règles reprises de la maquette Escale : arrivée vers 14 h le premier jour (et les jours de changement de ville),
// visites regroupées par proximité, déjeuner vers 12 h 30, dîner vers 20 h, lieux fermés ce jour-là écartés.
// Les lieux viennent de la base (OpenStreetMap) : durées et prix sont des estimations, jamais des certitudes.

import { distanceKm, estimateTravel, formatTime, parseTime, roundUp5, weekdayOf } from './planning.ts';
import type { Place } from './types.ts';

export interface Candidate {
  place: Place;
  cityId: number;
  /** Catégorie principale (culture, gastronomie, nature…). */
  root: string;
  popularity: number;
}

export interface PlanDay { date: string; cityId: number | null }

export type SlotKind = 'visit' | 'lunch' | 'dinner' | 'arrival';

export interface PlannedItem {
  kind: SlotKind;
  /** Lieu de la base, ou null pour une étape libre (« Déjeuner », « Arrivée »). */
  place: Place | null;
  title: string | null;
  root: string | null;
  startMin: number;
  durationMin: number;
  /** Pourquoi ce lieu : affiché comme badge (« Pour toi », « Incontournable »). */
  badges: ('pour_toi' | 'incontournable')[];
}

export interface PlannedDay {
  date: string;
  cityId: number | null;
  items: PlannedItem[];
  /** Aucun lieu disponible pour ce jour (ville non collectée, ou tout est fermé). */
  empty: boolean;
  /** Jour d'arrivée ou de changement de ville : la journée commence l'après-midi. */
  transfer: boolean;
}

export interface PlanOptions {
  interests: string[];
  travelers: number;
  /** Enveloppe « activités » par jour pour tout le groupe ; au-delà, les visites payantes sont écartées. */
  activityBudgetPerDay?: number | null;
  /** Lieux à ne pas proposer (retirés par l'utilisateur, ou déjà présents dans le voyage). */
  excluded?: Set<number>;
  /** Visites maximum par jour : 3 par défaut, 2 les jours d'arrivée. */
  maxVisits?: number;
}

export const DAY_START = 9 * 60 + 30;
export const ARRIVAL = 14 * 60;
export const LUNCH_AT = 12 * 60 + 30;
export const DINNER_AT = 20 * 60;
const LUNCH_MIN = 75;
const DINNER_MIN = 90;
const DEFAULT_VISIT_MIN = 60;
const VISIT_LIMIT = 19 * 60 + 15;   // on n'enchaîne plus de visite qui finirait après 19 h 15

const FOOD = 'gastronomie';
const NIGHT = 'nocturne';

const durationOf = (p: Place): number => p.visit_duration_min && p.visit_duration_min > 0 ? p.visit_duration_min : DEFAULT_VISIT_MIN;
const isOpen = (p: Place, date: string): boolean => !p.closed_days.includes(weekdayOf(date));

/** Score d'un lieu : popularité relative dans sa ville (0 à 2) + bonus s'il correspond aux envies. */
function scoreOf(c: Candidate, maxPop: number, interests: string[]): number {
  return (maxPop > 0 ? (c.popularity / maxPop) * 2 : 0) + (interests.includes(c.root) ? 2 : 0);
}

interface Scored extends Candidate { score: number; rank: number }

/** Classe les lieux d'une ville : meilleur score d'abord, l'identifiant départage (résultat toujours identique). */
function rankCity(list: Candidate[], interests: string[]): Scored[] {
  const maxPop = list.reduce((m, c) => Math.max(m, c.popularity), 0);
  return list
    .map((c) => ({ ...c, score: scoreOf(c, maxPop, interests), rank: 0 }))
    .sort((a, b) => b.score - a.score || a.place.id - b.place.id)
    .map((c, i) => ({ ...c, rank: i }));
}

function badgesOf(c: Scored, interests: string[]): PlannedItem['badges'] {
  const out: PlannedItem['badges'] = [];
  if (interests.includes(c.root)) out.push('pour_toi');
  if (c.rank < 3) out.push('incontournable');
  return out;
}

/** Ordre des villes : une journée sans ville reprend celle de la veille, sinon celle du lendemain. */
function fillCities(days: PlanDay[]): (number | null)[] {
  const out = days.map((d) => d.cityId);
  for (let i = 1; i < out.length; i++) if (out[i] == null) out[i] = out[i - 1];
  for (let i = out.length - 2; i >= 0; i--) if (out[i] == null) out[i] = out[i + 1];
  return out;
}

export function buildPlan(days: PlanDay[], candidates: Candidate[], opts: PlanOptions): PlannedDay[] {
  const excluded = opts.excluded ?? new Set<number>();
  const cities = fillCities(days);
  const byCity = new Map<number, Scored[]>();
  for (const id of new Set(cities.filter((c): c is number => c != null))) {
    byCity.set(id, rankCity(candidates.filter((c) => c.cityId === id && !excluded.has(c.place.id) && c.place.kind === 'activity'), opts.interests));
  }
  const used = new Set<number>();

  return days.map((day, index): PlannedDay => {
    const cityId = cities[index];
    const transfer = index === 0 || (index > 0 && cityId !== cities[index - 1]);
    const pool = cityId != null ? byCity.get(cityId) ?? [] : [];
    const open = pool.filter((c) => !used.has(c.place.id) && isOpen(c.place, day.date));
    const foods = open.filter((c) => c.root === FOOD);
    const sights = open.filter((c) => c.root !== FOOD && c.root !== NIGHT);
    const items: PlannedItem[] = [];
    const taken = new Set<number>();
    const take = (c: Scored) => { used.add(c.place.id); taken.add(c.place.id); };

    if (!sights.length && !foods.length) return { date: day.date, cityId, items, empty: true, transfer };

    let cursor = transfer ? ARRIVAL : DAY_START;
    if (transfer) items.push({ kind: 'arrival', place: null, title: index === 0 ? 'Arrivée et installation' : 'Arrivée dans la ville', root: null, startMin: ARRIVAL - 30, durationMin: 30, badges: [] });
    const limit = opts.maxVisits ?? 3;
    const maxVisits = transfer ? Math.min(limit, 2) : limit;
    let budgetLeft = opts.activityBudgetPerDay ?? Infinity;
    const rootsToday: string[] = [];
    let last: Scored | null = null;
    let lunchDone = false;
    let visits = 0;

    const nearestFood = (from: Scored | null): Scored | null => {
      const free = foods.filter((f) => !taken.has(f.place.id));
      if (!free.length) return null;
      return free.reduce((best, f) => {
        const d = from ? distanceKm(from.place, f.place) : 0;
        const bd = from ? distanceKm(from.place, best.place) : 0;
        return f.score - 0.4 * d > best.score - 0.4 * bd ? f : best;
      });
    };

    const addMeal = (kind: 'lunch' | 'dinner', at: number) => {
      const spot = nearestFood(last);
      const dur = kind === 'lunch' ? LUNCH_MIN : DINNER_MIN;
      const travel = last && spot ? estimateTravel(last.place, spot.place).minutes : 0;
      const start = Math.max(at, cursor + travel);
      if (spot) { take(spot); items.push({ kind, place: spot.place, title: null, root: FOOD, startMin: roundUp5(start), durationMin: dur, badges: badgesOf(spot, opts.interests) }); last = spot; }
      else items.push({ kind, place: null, title: kind === 'lunch' ? 'Déjeuner' : 'Dîner', root: FOOD, startMin: roundUp5(start), durationMin: dur, badges: [] });
      cursor = roundUp5(start) + dur;
    };

    while (visits < maxVisits) {
      if (!lunchDone && cursor >= LUNCH_AT - 30) { addMeal('lunch', LUNCH_AT); lunchDone = true; continue; }
      // La prochaine visite : bon score, proche de la précédente, pas la même famille que celles du jour.
      let best: Scored | null = null;
      let bestValue = -Infinity;
      for (const c of sights) {
        if (taken.has(c.place.id)) continue;
        const travel = last ? estimateTravel(last.place, c.place).minutes : 0;
        const start = cursor + travel;
        const dur = durationOf(c.place);
        if (start + dur > VISIT_LIMIT) continue;
        const cost = (c.place.price_amount ?? 0) * opts.travelers;
        if (cost > budgetLeft) continue;
        const value = c.score - (last ? 0.25 * distanceKm(last.place, c.place) : 0) - 0.6 * rootsToday.filter((r) => r === c.root).length;
        if (value > bestValue) { best = c; bestValue = value; }
      }
      if (!best) break;
      const travel = last ? estimateTravel(last.place, best.place).minutes : 0;
      const start = roundUp5(cursor + travel);
      const dur = durationOf(best.place);
      take(best);
      budgetLeft -= (best.place.price_amount ?? 0) * opts.travelers;
      rootsToday.push(best.root);
      items.push({ kind: 'visit', place: best.place, title: null, root: best.root, startMin: start, durationMin: dur, badges: badgesOf(best, opts.interests) });
      cursor = start + dur;
      last = best;
      visits++;
    }
    if (!lunchDone && items.some((i) => i.kind === 'visit')) addMeal('lunch', Math.max(LUNCH_AT, cursor));
    if (items.some((i) => i.kind === 'visit') || foods.length) addMeal('dinner', DINNER_AT);

    // Étape de nuit si l'utilisateur aime sortir : un lieu proche du dîner, après 21 h 45.
    if (opts.interests.includes(NIGHT)) {
      const night = open.filter((c) => c.root === NIGHT && !taken.has(c.place.id))[0];
      if (night) { take(night); items.push({ kind: 'visit', place: night.place, title: null, root: NIGHT, startMin: roundUp5(Math.max(cursor + 15, 21 * 60 + 45)), durationMin: durationOf(night.place), badges: badgesOf(night, opts.interests) }); }
    }
    items.sort((a, b) => a.startMin - b.startMin);
    return { date: day.date, cityId, items, empty: false, transfer };
  });
}

/** Coût estimé des visites d'un jour pour tout le groupe (les prix inconnus comptent pour 0). */
export const dayCost = (d: PlannedDay, travelers: number): number =>
  d.items.reduce((s, i) => s + (i.place?.price_amount ?? 0) * travelers, 0);

// ---------------------------------------------------------------- Ranger les horaires d'une journée existante

export interface OrderableItem { id: string; place: Place | null; root: string | null; startTime: string | null; durationMin: number | null; position: number }

/**
 * Donne une heure aux étapes d'un jour qui n'en ont pas. Les étapes qui ont déjà une heure gardent la leur ;
 * les autres s'enchaînent dans l'ordre de la liste (trajets estimés compris), à partir de 9 h 30, avec une pause
 * de déjeuner si l'enchaînement tombe sur 12 h 30. Renvoie uniquement les étapes à modifier.
 */
export function organizeTimes(items: OrderableItem[]): { id: string; startMin: number }[] {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const out: { id: string; startMin: number }[] = [];
  let cursor = DAY_START;
  let previous: Place | null = null;
  for (const it of sorted) {
    const fixed = parseTime(it.startTime);
    const dur = it.durationMin ?? (it.place ? durationOf(it.place) : DEFAULT_VISIT_MIN);
    if (fixed != null) { cursor = Math.max(cursor, fixed + dur); previous = it.place ?? previous; continue; }
    const travel = previous && it.place ? estimateTravel(previous, it.place).minutes : 0;
    let start = roundUp5(cursor + travel);
    if (it.root !== FOOD && start < LUNCH_AT + LUNCH_MIN && start + dur > LUNCH_AT && start >= LUNCH_AT - 30) start = roundUp5(LUNCH_AT + LUNCH_MIN);
    out.push({ id: it.id, startMin: start });
    cursor = start + dur;
    previous = it.place ?? previous;
  }
  return out;
}

export { formatTime };

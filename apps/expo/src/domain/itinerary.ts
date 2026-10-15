// Construction automatique d'un programme : logique pure (aucun réseau, aucune interface), testée avec Node.
// Chaque journée est une boucle : elle part de l'hébergement (sinon du centre de la ville), prend les activités les plus
// proches parmi les mieux notées et celles qui correspondent aux envies, les met dans l'ordre qui fait le moins de trajets
// et revient à l'hébergement du soir. Chaque famille garde son moment (culture en journée, restaurants aux repas, sorties
// le soir) et les horaires d'ouverture connus sont respectés. Un changement de ville commence par le trajet (départ 9 h,
// durée estimée selon la distance) puis l'arrivée ; si l'hôtel du soir est dans une autre ville, la journée finit par le
// trajet vers lui. Les lieux viennent d'OpenStreetMap : durées, prix et trajets sont des estimations, jamais des certitudes.

import { ARRIVAL_TITLES, distanceKm, estimateTravel, formatTime, parseTime, roundUp5, weekdayOf } from './planning.ts';
import { parseOpeningHours } from './openingHours.ts';
import type { WeekHours } from './openingHours.ts';
import type { LatLng, Place } from './types.ts';

export { ARRIVAL_TITLES, isArrivalStep, isFixedStep, isTransferStep } from './planning.ts';

export interface Candidate {
  place: Place;
  cityId: number;
  /** Catégorie principale (culture, gastronomie, nature…). */
  root: string;
  popularity: number;
}

export interface Spot extends LatLng { name: string }

/**
 * `focus` : journée consacrée à un quartier (les visites et repas sont pris autour de lui quand il y en a assez).
 * `stay` : hébergement de la nuit, point d'arrivée de la journée (et de départ du lendemain).
 * `fixed` : jour déjà programmé, gardé seulement pour savoir où l'on dort ; rien n'y est proposé.
 */
export interface PlanDay { date: string; cityId: number | null; focus?: { name: string; lat: number; lng: number } | null; stay?: Spot | null; fixed?: boolean }

export type SlotKind = 'visit' | 'lunch' | 'dinner' | 'arrival' | 'transfer';

export interface PlannedItem {
  kind: SlotKind;
  /** Lieu de la base, ou null pour une étape libre (« Déjeuner », « Arrivée », « Trajet »). */
  place: Place | null;
  title: string | null;
  /** Grande catégorie du lieu (culture…), ou code du moyen de transport d'un trajet (gare, aeroport, transport). */
  root: string | null;
  startMin: number;
  durationMin: number;
  /** Pourquoi ce lieu : affiché comme badge (« Pour toi », « Incontournable »). */
  badges: ('pour_toi' | 'incontournable')[];
  /** Précision sous l'étape (« Train, environ 2 h 55 (estimation, 274 km) »). */
  note?: string | null;
}

export interface PlannedDay {
  date: string;
  cityId: number | null;
  items: PlannedItem[];
  /** Aucun lieu disponible pour ce jour (ville non collectée, ou tout est fermé). */
  empty: boolean;
  /** Jour d'arrivée ou de changement de ville (trajet le matin ou le soir) : moins de visites. */
  transfer: boolean;
  /** Quartier du jour (« Asakusa »), si la journée lui est consacrée. */
  focus?: string;
}

export interface PlanOptions {
  interests: string[];
  travelers: number;
  /** Enveloppe « activités » par jour pour tout le groupe ; au-delà, les visites payantes sont écartées. */
  activityBudgetPerDay?: number | null;
  /** Lieux à ne pas proposer (retirés par l'utilisateur, ou déjà présents dans le voyage). */
  excluded?: Set<number>;
  /** Visites maximum par jour : 3 par défaut (4 au plus), 2 les jours de trajet. */
  maxVisits?: number;
  /** Nom et centre des villes du voyage, pour les trajets ; sans coordonnées, le centre de ses lieux les plus connus. */
  cities?: Map<number, { name: string; lat?: number | null; lng?: number | null }>;
  /** Ville de départ : le premier jour commence par le trajet depuis elle (sinon arrivée vers 14 h). */
  home?: Spot | null;
  /** Vols et trains réservés (voir `bookedLegs`) : ils remplacent l'heure estimée du trajet de leur jour. */
  booked?: BookedLeg[];
}

export const DAY_START = 9 * 60 + 30;
export const ARRIVAL = 14 * 60;
export const LUNCH_AT = 12 * 60 + 30;
export const DINNER_AT = 20 * 60;
/** Départ du trajet vers une nouvelle ville, le matin (après avoir libéré la chambre). */
export const TRANSFER_DEPART = 9 * 60;
const EVENING_ARRIVAL = 18 * 60;   // trajet vers l'hôtel d'une autre ville : arrivée visée avant le dîner
const LUNCH_FROM = 12 * 60;
const LUNCH_LATEST = 13 * 60 + 30;
const LUNCH_MIN = 75;
const DINNER_MIN = 90;
const SETTLE_MIN = 30;
const DEFAULT_VISIT_MIN = 60;
const VISIT_LIMIT = 19 * 60 + 15;   // on n'enchaîne plus de visite qui finirait après 19 h 15
const SAME_CITY_KM = 15;            // ville de départ à moins de 15 km : pas de trajet
const MAX_TRANSFER = 11 * 60;       // au-delà, le trajet se fait la veille : arrivée vers 14 h comme avant
const STAY_CITY_KM = 60;            // un hébergement compte pour la ville du voyage la plus proche, dans ce rayon

const FOOD = 'gastronomie';
/** Rayon d'un quartier : lieux à moins de 2,5 km de son centre. */
const FOCUS_KM = 2.5;
const NIGHT = 'nocturne';

/** Moment de chaque famille d'activités (début au plus tôt, fin au plus tard) ; les restaurants vont aux repas, la vie nocturne après le dîner. */
const WINDOWS: Record<string, [number, number]> = {
  culture: [DAY_START, 18 * 60],
  nature: [9 * 60, 19 * 60], sport: [9 * 60, 19 * 60],
  shopping: [10 * 60, 19 * 60], creatif: [10 * 60, 19 * 60],
  bienetre: [14 * 60, 20 * 60],
  sorties: [13 * 60, 22 * 60],
};
/** Plutôt l'après-midi quand c'est possible. */
const AFTERNOON = new Set(['shopping', 'sorties']);
const windowOf = (root: string): [number, number] => WINDOWS[root] ?? [DAY_START, VISIT_LIMIT];

const durationOf = (p: Place): number => p.visit_duration_min && p.visit_duration_min > 0 ? p.visit_duration_min : DEFAULT_VISIT_MIN;
const isOpen = (p: Place, date: string): boolean => !p.closed_days.includes(weekdayOf(date));
const hm = (min: number): string => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`);

// ---------------------------------------------------------------- Trajets entre villes

export type TransferMode = 'car' | 'train' | 'plane';
export interface Transfer { mode: TransferMode; minutes: number; km: number }

/**
 * Trajet entre deux villes, estimé d'après la distance à vol d'oiseau : train ou voiture sous 150 km, train jusqu'à
 * 700 km, avion au-delà (aéroports et attente compris, porte à porte).
 */
export function estimateTransfer(a: LatLng, b: LatLng): Transfer {
  const km = distanceKm(a, b);
  const minutes = km < 150 ? ((km * 1.3) / 70) * 60 + 15 : km <= 700 ? ((km * 1.2) / 130) * 60 + 20 : 180 + (km / 800) * 60;
  return { mode: km < 150 ? 'car' : km <= 700 ? 'train' : 'plane', minutes: roundUp5(minutes), km };
}
const TRANSFER_LABEL: Record<TransferMode, string> = { car: 'Train ou voiture', train: 'Train', plane: 'Avion' };
/** Catégorie de l'étape (codes de place_categories) : l'icône montre le moyen de transport. */
const TRANSFER_CODE: Record<TransferMode, string> = { car: 'transport', train: 'gare', plane: 'aeroport' };
const transferNote = (t: Transfer): string =>
  `${TRANSFER_LABEL[t.mode]}, environ ${hm(t.minutes)}${t.mode === 'plane' ? ' porte à porte' : ''} (estimation, ${Math.round(t.km)} km)`;

/** Vol ou train réservé : heures locales de départ et, si on la connaît, d'arrivée. */
export interface BookedLeg { date: string; title: string; mode: 'plane' | 'train'; depart: number; arrive: number | null }

/**
 * Vols et trains réservés qui ont une date et une heure de départ. L'heure d'arrivée est lue dans les notes
 * (« arrivée 08:45 », écrit par l'import d'e-mail, ou « arrivée 8h45 » saisi à la main).
 */
export function bookedLegs(list: { kind: string; title: string; starts_on: string | null; start_time: string | null; notes: string | null }[]): BookedLeg[] {
  const out: BookedLeg[] = [];
  for (const b of list) {
    const depart = parseTime(b.start_time);
    if ((b.kind !== 'vol' && b.kind !== 'train') || !b.starts_on || depart == null) continue;
    const m = b.notes?.match(/arriv[ée]e\s*:?\s*(\d{1,2})[:h](\d{2})/i);
    out.push({ date: b.starts_on, title: b.title, mode: b.kind === 'vol' ? 'plane' : 'train', depart, arrive: m ? parseTime(`${m[1]}:${m[2]}`) : null });
  }
  return out;
}
/** Avant un trajet réservé : aller à l'aéroport et embarquer, ou rejoindre la gare ; après : rejoindre l'hébergement. */
const BOOKED_MARGIN = { plane: { before: 150, after: 60 }, train: { before: 30, after: 20 } } as const;
/** Durée du vol ou du train seul (sans les marges), quand l'heure d'arrivée manque. */
const rideMinutes = (mode: 'plane' | 'train', a: LatLng | null, b: LatLng | null): number =>
  !a || !b ? 120 : roundUp5(mode === 'plane' ? (distanceKm(a, b) / 800) * 60 + 30 : ((distanceKm(a, b) * 1.2) / 130) * 60);

// ---------------------------------------------------------------- Choix des lieux

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

/** Restaurant le mieux placé : bonne note, proche de `a` (poids `wa` par km) et de `b` (poids `wb`). */
function pickFood(foods: Scored[], taken: Set<number>, a: LatLng, b: LatLng, wa: number, wb: number): Scored | null {
  let best: Scored | null = null;
  let bestValue = -Infinity;
  for (const f of foods) {
    if (taken.has(f.place.id)) continue;
    const v = f.score - wa * distanceKm(a, f.place) - wb * distanceKm(f.place, b);
    if (v > bestValue) { best = f; bestValue = v; }
  }
  return best;
}

function permutations<T>(list: T[]): T[][] {
  if (list.length <= 1) return [list];
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((p) => [x, ...p]));
}

// ---------------------------------------------------------------- Ordre de la journée

interface DayContext {
  weekday: number;
  /** Heure à laquelle on est libre (début de journée, ou fin de l'arrivée). */
  start: number;
  /** Le trajet depuis le point de départ compte dans l'horaire (vrai après une arrivée ; un matin normal, on part à l'avance). */
  firstLeg: boolean;
  from: LatLng;
  to: LatLng;
  /** Les visites et le déjeuner finissent avant cette heure. */
  end: number;
  /** Déjeuner à placer, au plus tard à cette heure (null : pas de déjeuner). */
  lunchLatest: number | null;
  foods: Scored[];
  taken: Set<number>;
  interests: string[];
  hours: Map<number, WeekHours | null>;
}

interface Simulation { items: PlannedItem[]; cost: number; end: number; pos: LatLng; lunch: Scored | null }

/** Début d'une visite d'après les horaires d'ouverture connus (attendre l'ouverture si besoin) ; null si elle ne tient pas. */
function fitOpening(ctx: DayContext, p: Place, start: number, dur: number): number | null {
  if (!ctx.hours.has(p.id)) ctx.hours.set(p.id, parseOpeningHours(p.opening_hours));
  const slots = ctx.hours.get(p.id)?.[ctx.weekday];
  if (slots == null) return start;
  for (const [a, b] of slots) {
    const s = roundUp5(Math.max(start, a));
    if (s + dur <= b) return s;
  }
  return null;
}

/**
 * Déroule la journée dans l'ordre donné (`null` = déjeuner). Coût : minutes de trajet sur toute la boucle (retour
 * compris), plus la moitié des minutes d'attente, plus un petit malus pour le shopping placé le matin. null si un
 * créneau n'est pas respecté (moment de l'activité, horaires d'ouverture, déjeuner, fin de journée).
 */
function simulate(order: (Scored | null)[], ctx: DayContext): Simulation | null {
  let t = ctx.start;
  let pos = ctx.from;
  let cost = 0;
  let lunch: Scored | null = null;
  const items: PlannedItem[] = [];
  for (let k = 0; k < order.length; k++) {
    const c = order[k];
    const counted = k > 0 || ctx.firstLeg;
    if (c === null) {
      const next = order[k + 1];
      const spot = pickFood(ctx.foods, ctx.taken, pos, next ? next.place : ctx.to, 0.4, 0.2);
      const travel = spot ? estimateTravel(pos, spot.place).minutes : 0;
      const arrive = t + (counted ? travel : 0);
      const start = roundUp5(Math.max(arrive, LUNCH_FROM));
      if (ctx.lunchLatest == null || start > ctx.lunchLatest || start + LUNCH_MIN > ctx.end) return null;
      cost += travel + (start - arrive) / 2;
      items.push(spot
        ? { kind: 'lunch', place: spot.place, title: null, root: FOOD, startMin: start, durationMin: LUNCH_MIN, badges: badgesOf(spot, ctx.interests) }
        : { kind: 'lunch', place: null, title: 'Déjeuner', root: FOOD, startMin: start, durationMin: LUNCH_MIN, badges: [] });
      if (spot) { lunch = spot; pos = spot.place; }
      t = start + LUNCH_MIN;
      continue;
    }
    const travel = estimateTravel(pos, c.place).minutes;
    const arrive = t + (counted ? travel : 0);
    const dur = durationOf(c.place);
    const [open, close] = windowOf(c.root);
    const start = fitOpening(ctx, c.place, roundUp5(Math.max(arrive, open)), dur);
    if (start == null || start + dur > Math.min(close, ctx.end)) return null;
    cost += travel + (start - arrive) / 2 + (AFTERNOON.has(c.root) && start < 14 * 60 ? 20 : 0);
    items.push({ kind: 'visit', place: c.place, title: null, root: c.root, startMin: start, durationMin: dur, badges: badgesOf(c, ctx.interests) });
    t = start + dur;
    pos = c.place;
  }
  cost += estimateTravel(pos, ctx.to).minutes;
  return { items, cost, end: t, pos, lunch };
}

/** Meilleur ordre des visites choisies (et du déjeuner) : celui qui fait le moins de trajets en respectant les créneaux. */
function bestOrder(chosen: Scored[], ctx: DayContext): Simulation | null {
  let best: Simulation | null = null;
  for (const order of permutations<Scored | null>(ctx.lunchLatest != null ? [...chosen, null] : chosen)) {
    const sim = simulate(order, ctx);
    if (sim && (!best || sim.cost < best.cost)) best = sim;
  }
  return best;
}

// ---------------------------------------------------------------- Programme

/** Ville d'une journée ; `cityId` null : hors du voyage (ville de départ, destination d'un trajet réservé). */
interface Stop { cityId: number | null; name: string | null; point: LatLng | null; stay: Spot | null }
/** Trajet entre deux villes : ses heures, puis les marges avant (rejoindre la gare, embarquer) et après (rejoindre l'hébergement). */
interface Leg { title: string; root: string; note: string; depart: number; arrive: number; before: number; after: number }
/** Créneau de visites dans une ville : une boucle de `stop.point` à `to`, entre `start` et `end`. */
interface Slot { stop: Stop; sights: Scored[]; foods: Scored[]; start: number; end: number; firstLeg: boolean; to: LatLng; anchor: LatLng }

export function buildPlan(days: PlanDay[], candidates: Candidate[], opts: PlanOptions): PlannedDay[] {
  const excluded = opts.excluded ?? new Set<number>();
  const cities = fillCities(days);
  const byCity = new Map<number, Scored[]>();
  for (const id of new Set([...cities.filter((c): c is number => c != null), ...(opts.cities?.keys() ?? [])])) {
    byCity.set(id, rankCity(candidates.filter((c) => c.cityId === id && !excluded.has(c.place.id) && c.place.kind === 'activity'), opts.interests));
  }
  // Centre de chaque ville : ses coordonnées si on les connaît, sinon le milieu de ses lieux les mieux classés.
  const centers = new Map<number, LatLng>();
  for (const [id, pool] of byCity) {
    const known = opts.cities?.get(id);
    if (known?.lat != null && known.lng != null) { centers.set(id, { lat: known.lat, lng: known.lng }); continue; }
    const top = pool.slice(0, 15);
    if (top.length) centers.set(id, { lat: top.reduce((s, c) => s + c.place.lat, 0) / top.length, lng: top.reduce((s, c) => s + c.place.lng, 0) / top.length });
  }
  const nameOf = (id: number | null): string | null => (id != null ? opts.cities?.get(id)?.name ?? null : null);
  // Ville de chaque nuit : celle de l'hébergement s'il est renseigné (la ville du voyage la plus proche), sinon celle du jour.
  const nightCity = days.map((d, i) => {
    if (!d.stay) return cities[i];
    let best = cities[i];
    let bestKm = STAY_CITY_KM;
    for (const [id, c] of centers) { const km = distanceKm(d.stay, c); if (km < bestKm) { best = id; bestKm = km; } }
    return best;
  });
  const used = new Set<number>();
  const hours = new Map<number, WeekHours | null>();
  // Lieux encore libres d'une ville ce jour-là.
  const poolOf = (id: number | null, date: string): Scored[] => (id != null ? byCity.get(id) ?? [] : []).filter((c) => !used.has(c.place.id) && isOpen(c.place, date));
  // Trajets réservés d'un jour, réunis en un seul (correspondance : premier départ, dernière arrivée).
  const bookedOn = (date: string): BookedLeg | null => {
    const list = (opts.booked ?? []).filter((b) => b.date === date).sort((a, b) => a.depart - b.depart);
    if (!list.length) return null;
    const n = list.length - 1;
    return { ...list[0], arrive: list[n].arrive, mode: list.some((b) => b.mode === 'plane') ? 'plane' : 'train',
      title: n ? `${list[0].title} (+ ${n} correspondance${n > 1 ? 's' : ''})` : list[0].title };
  };

  return days.map((day, index): PlannedDay => {
    const cityId = cities[index];
    if (day.fixed) return { date: day.date, cityId, items: [], empty: true, transfer: false };
    const pool = cityId != null ? byCity.get(cityId) ?? [] : [];
    const openAll = pool.filter((c) => !used.has(c.place.id) && isOpen(c.place, day.date));
    // Journée de quartier : seulement les lieux autour de lui, s'il y a au moins deux visites possibles.
    const near = day.focus ? openAll.filter((c) => distanceKm(day.focus!, c.place) <= FOCUS_KM) : [];
    const focused = near.filter((c) => c.root !== FOOD && c.root !== NIGHT).length >= 2;
    const open = focused ? near : openAll;
    const focus = focused ? day.focus!.name : undefined;
    const foods = open.filter((c) => c.root === FOOD);
    const sights = open.filter((c) => c.root !== FOOD && c.root !== NIGHT);
    const items: PlannedItem[] = [];
    const taken = new Set<number>();
    const take = (c: Scored) => { used.add(c.place.id); taken.add(c.place.id); };

    if (!sights.length && !foods.length) return { date: day.date, cityId, items, empty: true, transfer: false, focus };

    const center = cityId != null ? centers.get(cityId) ?? null : null;
    const here = nameOf(cityId);
    const stayHere = day.stay && nightCity[index] === cityId ? day.stay : null;
    const prevCity = index > 0 ? nightCity[index - 1] : null;
    const prevStay = index > 0 ? days[index - 1].stay ?? null : null;
    const tonight = nightCity[index];
    const booked = bookedOn(day.date);

    // Où l'on se réveille et où l'on dort, quand ce n'est pas la ville du jour (`cityId` null : hors du voyage).
    let wake: Stop | null = null;
    let sleep: Stop | null = null;
    let arrivalOnly = false;
    if (index === 0) {
      if (opts.home && center && distanceKm(opts.home, center) >= SAME_CITY_KM) wake = { cityId: null, name: opts.home.name, point: opts.home, stay: null };
      else if (!opts.home || !center) arrivalOnly = true;
    } else if (prevCity !== cityId) {
      wake = { cityId: prevCity, name: nameOf(prevCity), point: prevStay ?? (prevCity != null ? centers.get(prevCity) ?? null : null), stay: prevStay };
    }
    if (day.stay && tonight != null && tonight !== cityId) sleep = { cityId: tonight, name: nameOf(tonight), point: day.stay, stay: day.stay };
    const main: Stop = { cityId, name: here, point: (!wake && !arrivalOnly && prevCity === cityId ? prevStay : null) ?? stayHere ?? center ?? sights[0]?.place ?? foods[0].place, stay: stayHere };

    // Trajet réservé ce jour-là : celui du matin s'il part avant midi, sinon celui du soir. Sans changement de ville prévu,
    // c'est une arrivée le premier jour (ville de départ inconnue), sinon un départ (retour, excursion).
    let bookedRole: 'in' | 'out' | null = null;
    if (booked) {
      bookedRole = (wake || arrivalOnly) && !(sleep && booked.depart >= 12 * 60) ? 'in' : 'out';
      if (bookedRole === 'in' && !wake) { wake = { cityId: null, name: null, point: null, stay: null }; arrivalOnly = false; }
      if (bookedRole === 'out' && !sleep) sleep = { cityId: null, name: null, point: null, stay: null };
    }
    const estimate = (a: Stop, b: Stop): Transfer | null => {
      if (!a.name || !b.name || !a.point || !b.point) return null;
      const t = estimateTransfer(a.point, b.point);
      return t.minutes <= MAX_TRANSFER ? t : null;
    };
    const inEst = wake && bookedRole !== 'in' ? estimate(wake, main) : null;
    if (wake && bookedRole !== 'in' && !inEst) { wake = null; arrivalOnly = true; }
    const outEst = sleep && bookedRole !== 'out' ? estimate(main, sleep) : null;
    if (sleep && bookedRole !== 'out' && !outEst) sleep = null;

    const legOf = (a: Stop, b: Stop, est: Transfer | null, departAt: (minutes: number) => number): Leg => {
      if (!est && booked) {
        const known = booked.arrive != null && booked.arrive > booked.depart;
        const arrive = known ? booked.arrive! : Math.min(booked.depart + rideMinutes(booked.mode, a.point, b.point), 1439);
        return { title: booked.title, root: TRANSFER_CODE[booked.mode], depart: booked.depart, arrive, ...BOOKED_MARGIN[booked.mode],
          note: `Réservé · arrivée ${known ? formatTime(arrive) : `vers ${formatTime(arrive)} (estimation)`}` };
      }
      const depart = departAt(est!.minutes);
      return { title: `Trajet ${a.name} → ${b.name}`, root: TRANSFER_CODE[est!.mode], depart, arrive: depart + est!.minutes, before: 15, after: 0, note: transferNote(est!) };
    };
    const settle = (at: number, stay: Spot | null) =>
      items.push({ kind: 'arrival', place: null, title: ARRIVAL_TITLES[0], root: null, startMin: at, durationMin: SETTLE_MIN, badges: [], note: stay ? `${stay.name} : on dépose les bagages` : null });
    const pushLeg = (leg: Leg) => items.push({ kind: 'transfer', place: null, title: leg.title, root: leg.root, startMin: leg.depart, durationMin: leg.arrive - leg.depart, badges: [], note: leg.note });

    // Trajet du matin (départ 9 h), arrivée et installation à son arrivée ; trajet du soir pour arriver vers 18 h.
    const inLeg = wake ? legOf(wake, main, inEst, () => TRANSFER_DEPART) : null;
    let ready = DAY_START;
    if (inLeg) { pushLeg(inLeg); settle(inLeg.arrive + inLeg.after, stayHere); ready = inLeg.arrive + inLeg.after + SETTLE_MIN; }
    else if (arrivalOnly) { settle(ARRIVAL - SETTLE_MIN, stayHere); ready = ARRIVAL; }
    const outLeg = sleep ? legOf(main, sleep, outEst, (m) => Math.max(ready, Math.floor((EVENING_ARRIVAL - m) / 5) * 5)) : null;
    if (outLeg) { pushLeg(outLeg); if (sleep!.cityId != null) settle(outLeg.arrive + outLeg.after, sleep!.stay); }

    // Les créneaux de visite, dans l'ordre de la journée : avant le trajet du matin (dans la ville quittée), dans la ville
    // du jour, après le trajet du soir (dans la nouvelle ville). Chaque boucle part de l'hébergement et y revient.
    const windows: Slot[] = [];
    const add = (stop: Stop | null, pool: Scored[], start: number, end: number, firstLeg: boolean, to: LatLng | null, anchor?: LatLng) => {
      if (stop?.cityId != null && stop.point && end - start >= 60) windows.push({ stop, sights: pool.filter((c) => c.root !== FOOD && c.root !== NIGHT), foods: pool.filter((c) => c.root === FOOD), start, end, firstLeg, to: to ?? stop.point, anchor: anchor ?? stop.point });
    };
    if (inLeg && wake) add(wake, poolOf(wake.cityId, day.date), DAY_START, inLeg.depart - inLeg.before, false, null);
    add(main, open, ready, outLeg ? outLeg.depart - outLeg.before : VISIT_LIMIT, inLeg != null || arrivalOnly, outLeg ? null : stayHere, focused ? day.focus! : undefined);
    if (outLeg && sleep) add(sleep, poolOf(sleep.cityId, day.date), outLeg.arrive + outLeg.after + SETTLE_MIN, VISIT_LIMIT, true, null);
    // Déjeuner dans le premier créneau qui couvre midi (un peu plus tard juste après une arrivée) ; sinon on mange en route.
    const lunchSlot = windows.find((w) => w.start <= ARRIVAL + SETTLE_MIN && w.end >= LUNCH_FROM + LUNCH_MIN);
    const ctxOf = (w: Slot): DayContext => ({
      weekday: weekdayOf(day.date), start: w.start, firstLeg: w.firstLeg, from: w.stop.point!, to: w.to, end: w.end,
      lunchLatest: w === lunchSlot ? Math.max(LUNCH_LATEST, w.start + 30) : null, foods: w.foods, taken, interests: opts.interests, hours,
    });

    // Les visites : les plus proches de l'hébergement (ou du quartier) parmi les mieux notées, une famille à la fois,
    // ajoutées tant qu'un ordre respecte tous les créneaux ; le plus long créneau d'abord.
    const transferDay = inLeg != null || outLeg != null || arrivalOnly;
    const limit = Math.min(opts.maxVisits ?? 3, 4);
    let left = transferDay ? Math.min(limit, 2) : limit;
    const price = (c: Scored) => (c.place.price_amount ?? 0) * opts.travelers;
    let budgetLeft = opts.activityBudgetPerDay ?? Infinity;
    const plans = new Map<Slot, Simulation>();
    let visits = 0;
    for (const w of [...windows].sort((a, b) => (b.end - b.start) - (a.end - a.start))) {
      const ctx = ctxOf(w);
      const chosen: Scored[] = [];
      while (chosen.length < left) {
        const value = (c: Scored) => c.score - 0.25 * distanceKm(w.anchor, c.place)
          - (chosen.length ? 0.1 * Math.min(...chosen.map((x) => distanceKm(x.place, c.place))) : 0)
          - 0.6 * chosen.filter((x) => x.root === c.root).length;
        const ranked = w.sights
          .filter((c) => !taken.has(c.place.id) && !chosen.includes(c) && price(c) <= budgetLeft)
          .map((c) => ({ c, v: value(c) }))
          .sort((a, b) => b.v - a.v || a.c.place.id - b.c.place.id)
          .slice(0, 25);
        let found: { c: Scored; sim: Simulation } | null = null;
        for (const { c } of ranked) {
          const sim = bestOrder([...chosen, c], ctx);
          if (sim) { found = { c, sim }; break; }
        }
        if (!found) break;
        chosen.push(found.c);
        plans.set(w, found.sim);
        budgetLeft -= price(found.c);
      }
      for (const c of chosen) take(c);
      const lunch = plans.get(w)?.lunch;
      if (lunch) take(lunch);
      left -= chosen.length;
      visits += chosen.length;
    }
    // Pas de visite dans le créneau de midi mais ailleurs dans la journée : le déjeuner seul.
    if (lunchSlot && !plans.has(lunchSlot) && visits) {
      const sim = bestOrder([], ctxOf(lunchSlot));
      if (sim) { plans.set(lunchSlot, sim); if (sim.lunch) take(sim.lunch); }
    }
    for (const sim of plans.values()) items.push(...sim.items);

    // Dîner dans la ville où l'on dort, près de l'hébergement ; avant de partir si l'on quitte le voyage tard le soir.
    const endOf = (list: PlannedItem[]) => list.reduce((m, i) => Math.max(m, i.startMin + i.durationMin), DAY_START);
    const last = sleep ?? main;
    const lastSlot = windows.find((w) => w.stop === last);
    let dinner: { foods: Scored[]; pos: LatLng; lodging: LatLng; t: number } | null = null;
    if (last.cityId != null) {
      dinner = { foods: last === main ? foods : poolOf(last.cityId, day.date).filter((c) => c.root === FOOD), pos: (lastSlot && plans.get(lastSlot)?.pos) ?? last.point!, lodging: last.stay ?? last.point!, t: endOf(items) };
    } else if (outLeg && outLeg.depart - outLeg.before >= DINNER_AT + DINNER_MIN) {
      const mainSlot = windows.find((w) => w.stop === main);
      const sim = mainSlot ? plans.get(mainSlot) : undefined;
      dinner = { foods, pos: sim?.pos ?? main.point!, lodging: main.point!, t: sim ? sim.end : ready };
    }
    let pos: LatLng = dinner?.pos ?? main.point!;
    let t = dinner?.t ?? endOf(items);
    if (dinner && (visits || dinner.foods.length)) {
      const spot = pickFood(dinner.foods, taken, dinner.pos, dinner.lodging, 0.2, 0.4);
      const start = roundUp5(Math.max(DINNER_AT, t + (spot ? estimateTravel(dinner.pos, spot.place).minutes : 0)));
      if (spot) { take(spot); items.push({ kind: 'dinner', place: spot.place, title: null, root: FOOD, startMin: start, durationMin: DINNER_MIN, badges: badgesOf(spot, opts.interests) }); pos = spot.place; }
      else items.push({ kind: 'dinner', place: null, title: 'Dîner', root: FOOD, startMin: start, durationMin: DINNER_MIN, badges: [] });
      t = start + DINNER_MIN;
    }

    // Étape de nuit si l'utilisateur aime sortir : un lieu proche du dîner, après 21 h 45 (pas un soir de trajet).
    if (!outLeg && opts.interests.includes(NIGHT)) {
      const night = pickFood(open.filter((c) => c.root === NIGHT), taken, pos, main.stay ?? main.point!, 0.3, 0);
      if (night) { take(night); items.push({ kind: 'visit', place: night.place, title: null, root: NIGHT, startMin: roundUp5(Math.max(t + 15, 21 * 60 + 45)), durationMin: durationOf(night.place), badges: badgesOf(night, opts.interests) }); }
    }
    items.sort((a, b) => a.startMin - b.startMin);
    return { date: day.date, cityId, items, empty: false, transfer: transferDay, focus };
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

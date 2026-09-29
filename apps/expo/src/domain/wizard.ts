// Parcours « Démarrer un voyage » : logique pure (aucune dépendance), reprise de la maquette Escale v0.6.
// Pays > Dates > Villes (nuits réparties automatiquement) > Voyageurs > Envies > Budget > Récap.

import { COUNTRY_NAME } from './countries.ts';
import { addDays, diffDays } from '../lib/dates.ts';
import type { Poste } from './types.ts';

export type PartyType = 'seul' | 'deux' | 'amis' | 'famille';
export type BudgetLevelId = 'economique' | 'moyen' | 'confortable' | 'premium';

export interface WizardCity { id: number; name: string; nights: number }

export interface WizardState {
  country: string | null;
  start: string | null;
  end: string | null;
  /** Seule une durée a été choisie : les dates sont indicatives. */
  indicative: boolean;
  cities: WizardCity[];
  party: PartyType | null;
  travelers: number;
  interests: string[];
  budget: { level: BudgetLevelId | 'montant' | null; amount: number | null; currency: string };
  title: string;
  titleEdited: boolean;
}

export const newWizard = (): WizardState => ({
  country: null, start: null, end: null, indicative: false, cities: [], party: null, travelers: 1,
  interests: [], budget: { level: null, amount: null, currency: 'EUR' }, title: '', titleEdited: false,
});

export const dayCount = (s: Pick<WizardState, 'start' | 'end'>): number => (s.start && s.end ? diffDays(s.start, s.end) + 1 : 0);
export const nightCount = (s: Pick<WizardState, 'start' | 'end'>): number => Math.max(dayCount(s) - 1, 0);

// ---------------------------------------------------------------- Dates

export const MAX_TRIP_DAYS = 30;

/** Durées rapides du calendrier (nombre de jours) et de « Pas encore de dates ». */
export const QUICK_DURATIONS: [number, string][] = [[2, 'Week-end'], [5, '5 jours'], [7, '1 semaine'], [10, '10 jours'], [14, '2 semaines']];
export const FLEXIBLE_DURATIONS: [number, string][] = [[3, '3 jours'], [5, '5 jours'], [7, '1 semaine'], [10, '10 jours'], [14, '2 semaines']];

/** Toucher un jour : arrivée, puis départ ; un jour avant l'arrivée déplace l'arrivée ; un 3e toucher recommence. */
export function pickDate(s: WizardState, iso: string): WizardState {
  if (!s.start || s.end) return { ...s, start: iso, end: null, indicative: false };
  if (iso < s.start) return { ...s, start: iso };
  return { ...s, end: iso };
}

/** Durée rapide après l'arrivée : le départ est `days` jours plus tard (arrivée comprise). */
export const pickDuration = (s: WizardState, days: number): WizardState => (s.start ? { ...s, end: addDays(s.start, days - 1) } : s);

/** « Pas encore de dates » : durée seule, dates indicatives dans 30 jours. */
export function flexibleDates(s: WizardState, days: number, today: string): WizardState {
  const start = addDays(today, 30);
  return { ...s, start, end: addDays(start, days - 1), indicative: true };
}

// ---------------------------------------------------------------- Villes et nuits

/** Répartit les nuits également, le reste aux premières villes (7 nuits, 3 villes : 3, 2, 2). */
export function spreadNights(cities: WizardCity[], nights: number): WizardCity[] {
  const k = cities.length;
  if (!k) return cities;
  const base = Math.floor(nights / k);
  const rest = nights - base * k;
  return cities.map((c, i) => ({ ...c, nights: base + (i < rest ? 1 : 0) }));
}

/** Coche ou décoche une ville (l'ordre de sélection est l'ordre du voyage). Au plus une ville par nuit. */
export function toggleCity(cities: WizardCity[], city: { id: number; name: string }, nights: number): { cities: WizardCity[]; error: string | null } {
  const max = Math.max(nights, 1);
  if (cities.some((c) => c.id === city.id)) return { cities: spreadNights(cities.filter((c) => c.id !== city.id), nights), error: null };
  if (cities.length >= max) return { cities, error: `Pour ${nights} nuit${nights > 1 ? 's' : ''}, choisis au plus ${max} ville${max > 1 ? 's' : ''}.` };
  return { cities: spreadNights([...cities, { id: city.id, name: city.name, nights: 0 }], nights), error: null };
}

/** +/− sur une ville : la nuit vient de (ou va à) une autre ville, le total reste égal au nombre de nuits. */
export function changeNights(cities: WizardCity[], index: number, delta: 1 | -1): WizardCity[] {
  const next = cities.map((c) => ({ ...c }));
  if (delta > 0) {
    const donor = next.map((c, i) => ({ c, i })).filter(({ c, i }) => i !== index && c.nights > 1).sort((a, b) => b.c.nights - a.c.nights)[0];
    if (!donor) return cities;
    donor.c.nights--; next[index].nights++;
  } else {
    if (next[index].nights <= 1 || next.length < 2) return cities;
    next[index].nights--; next[(index + 1) % next.length].nights++;
  }
  return next;
}

/** Ville de chaque jour : chacune garde ses nuits en jours, la dernière prend le reste (jour du départ compris). */
export function cityPerDay(cities: WizardCity[], days: number): (number | null)[] {
  if (!cities.length) return Array.from({ length: days }, () => null);
  const out: (number | null)[] = [];
  let left = days;
  cities.forEach((c, i) => {
    const n = i === cities.length - 1 ? left : Math.min(c.nights, left);
    for (let k = 0; k < n; k++) out.push(c.id);
    left -= n;
  });
  return out;
}

// ---------------------------------------------------------------- Voyageurs, envies

export const PARTY_OPTIONS: { id: PartyType; name: string; detail: string }[] = [
  { id: 'seul', name: 'Seul', detail: 'Voyage en solo' },
  { id: 'deux', name: 'À deux', detail: 'En couple ou avec un proche' },
  { id: 'amis', name: 'Entre amis', detail: 'Dépenses partagées' },
  { id: 'famille', name: 'En famille', detail: 'Avec des enfants' },
];

/** Choisir un type : seul et à deux valident tout de suite ; amis et famille demandent le nombre de personnes. */
export function pickParty(s: WizardState, party: PartyType): WizardState {
  const travelers = party === 'seul' ? 1 : party === 'deux' ? 2 : s.travelers < 3 ? (party === 'famille' ? 4 : 3) : s.travelers;
  return { ...s, party, travelers };
}

/** Thèmes du parcours : codes des catégories principales de la base (place_categories). */
export const INTERESTS: { code: string; name: string }[] = [
  { code: 'culture', name: 'Culture' }, { code: 'gastronomie', name: 'Gastronomie' }, { code: 'nature', name: 'Nature' },
  { code: 'creatif', name: 'Créatif' }, { code: 'sorties', name: 'Divertissement' }, { code: 'shopping', name: 'Shopping' },
  { code: 'nocturne', name: 'Vie nocturne' }, { code: 'sport', name: 'Sport' }, { code: 'bienetre', name: 'Bien-être' },
];

// ---------------------------------------------------------------- Budget

export const BUDGET_LEVELS: { id: BudgetLevelId; name: string; perDay: number; detail: string }[] = [
  { id: 'economique', name: 'Économique', perDay: 70, detail: 'Auberges, street food, transports en commun' },
  { id: 'moyen', name: 'Moyen', perDay: 120, detail: 'Hôtel simple, restaurants locaux, quelques entrées' },
  { id: 'confortable', name: 'Confortable', perDay: 200, detail: 'Bel hôtel, bonnes tables, activités guidées' },
  { id: 'premium', name: 'Premium', perDay: 350, detail: 'Hôtels de charme, grandes tables, taxis' },
];

/** Part de chaque poste dans l'enveloppe totale. */
export const POSTE_SHARES: Record<Poste, number> = { hebergement: 0.35, transports: 0.15, repas: 0.3, activites: 0.15, shopping: 0.05 };

/** Répartit un total en montants entiers dont la somme est exactement le total (plus fort reste). */
export function splitBudget(total: number): Record<Poste, number> {
  const entries = (Object.keys(POSTE_SHARES) as Poste[]).map((p) => {
    const exact = total * POSTE_SHARES[p];
    return { p, whole: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let missing = Math.round(total) - entries.reduce((sum, e) => sum + e.whole, 0);
  for (const e of [...entries].sort((a, b) => b.rest - a.rest)) { if (missing <= 0) break; e.whole++; missing--; }
  return Object.fromEntries(entries.map((e) => [e.p, e.whole])) as Record<Poste, number>;
}

/** Enveloppe totale : niveau × jours × voyageurs, ou le montant libre du groupe. Null tant que le budget n'est pas choisi. */
export function budgetTotal(s: WizardState): number | null {
  const b = s.budget;
  if (b.level === 'montant') return b.amount && b.amount > 0 ? Math.round(b.amount) : null;
  const level = BUDGET_LEVELS.find((l) => l.id === b.level);
  return level ? level.perDay * Math.max(dayCount(s), 1) * s.travelers : null;
}

// ---------------------------------------------------------------- Titre et validation

const PARTY_SUFFIX: Record<PartyType, string> = { seul: 'en solo', deux: 'à deux', amis: 'entre amis', famille: 'en famille' };

export function autoTitle(s: Pick<WizardState, 'country' | 'party'>): string {
  if (!s.country) return 'Mon voyage';
  const name = COUNTRY_NAME[s.country] ?? s.country;
  return s.party ? `${name} ${PARTY_SUFFIX[s.party]}` : name;
}

/** Les étapes qu'il reste à remplir avant de créer le voyage (vide = prêt). */
export function missingSteps(s: WizardState): ('pays' | 'dates' | 'voyageurs' | 'interets' | 'budget')[] {
  const out: ('pays' | 'dates' | 'voyageurs' | 'interets' | 'budget')[] = [];
  if (!s.country) out.push('pays');
  if (!dayCount(s)) out.push('dates');
  if (!s.party) out.push('voyageurs');
  if (!s.interests.length) out.push('interets');
  if (budgetTotal(s) === null) out.push('budget');
  return out;
}

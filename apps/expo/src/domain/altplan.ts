// Plans de repli d'une journée : « allégé » (plan B) et « à l'abri » (plan C), dérivés du plan A.
// Logique pure, testée avec Node.

export type AltKind = 'light' | 'shelter';

export interface AltStop {
  itemId: string;
  /** Catégorie principale (culture, gastronomie, nature…), '' si inconnue. */
  root: string;
  durationMin: number;
  /** Trajet depuis l'étape précédente (0 si inconnu). */
  travelMin: number;
}

const MEALS = new Set(['gastronomie']);
const OUTDOOR = new Set(['nature', 'sport']);

/**
 * Étapes du plan A à garder dans le plan de repli, dans l'ordre d'origine.
 * - allégé : les repas restent ; on retire les visites les plus lourdes (durée + trajet) pour garder environ 60 % des étapes ;
 * - à l'abri : on retire les activités de plein air (nature, sport).
 */
export function deriveAltPlan(kind: AltKind, stops: AltStop[]): string[] {
  if (kind === 'shelter') return stops.filter((s) => !OUTDOOR.has(s.root)).map((s) => s.itemId);
  const keepCount = Math.max(1, Math.ceil(stops.length * 0.6));
  const dropCount = Math.max(0, stops.length - keepCount);
  const heaviest = stops
    .filter((s) => !MEALS.has(s.root))
    .sort((a, b) => (b.durationMin + b.travelMin) - (a.durationMin + a.travelMin))
    .slice(0, dropCount)
    .map((s) => s.itemId);
  const dropped = new Set(heaviest);
  return stops.filter((s) => !dropped.has(s.itemId)).map((s) => s.itemId);
}

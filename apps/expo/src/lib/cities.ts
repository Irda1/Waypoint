// Classement des villes proposées dans le sélecteur de lieux : d'abord celles du voyage, puis celles
// qui ont déjà des lieux. Fichier pur (aucune dépendance) : testable avec Node.

export const plain = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const FILLERS = new Set(['entre', 'amis', 'avec', 'pour', 'dans', 'voyage', 'vacances', 'week', 'weekend', 'sejour', 'escale', 'trip', 'tour', 'famille', 'copains', 'mois', 'jours', 'semaine']);

/** Mots du titre qui pourraient être un nom de ville (« Lisbonne entre amis » -> lisbonne), sans mots courants. */
export function titleWords(title: string): string[] {
  return [...new Set(plain(title).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !FILLERS.has(w)))];
}

export interface RankableCity { id: number; names: string[]; collection_status: string }

/**
 * Ordre : la ville déjà choisie pour ce jour, puis les destinations du voyage et les villes citées dans son titre,
 * puis celles dont les lieux sont collectés, puis les autres. L'ordre d'origine (population) départage.
 */
export function rankCities<T extends RankableCity>(cities: T[], opts: { title: string; preferredId?: number | null; priorityIds?: number[] }): T[] {
  const title = plain(opts.title);
  const score = (c: T): number => {
    if (opts.preferredId != null && c.id === opts.preferredId) return 0;
    if (opts.priorityIds?.includes(c.id)) return 1;
    if (c.names.some((n) => plain(n).length >= 3 && title.includes(plain(n)))) return 1;
    return c.collection_status === 'ready' ? 2 : 3;
  };
  return cities.map((c, i) => ({ c, i, s: score(c) })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.c);
}

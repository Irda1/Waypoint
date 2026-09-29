// Catégories de lieux : logique pure (testable avec Node). Les couleurs et les filtres de la maquette sont ceux
// de la catégorie principale (culture, gastronomie...), alors que les lieux collectés portent souvent une
// sous-catégorie (musee, restaurant...).

export interface Category { code: string; kind: string; parent_code: string | null; name_fr: string; sort_order: number }

export interface Categories {
  byCode: Map<string, Category>;
  /** Catégories principales d'activités, dans l'ordre d'affichage. */
  activityRoots: Category[];
  /** Code de la catégorie principale (culture pour musee, culture pour culture). */
  rootOf: (code: string | null | undefined) => string;
  /** La catégorie et toutes ses sous-catégories. */
  familyOf: (code: string) => string[];
}

export const EMPTY_CATEGORIES: Categories = { byCode: new Map(), activityRoots: [], rootOf: (c) => c ?? '', familyOf: (c) => [c] };

export function buildCategories(rows: Category[]): Categories {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const rootOf = (code: string | null | undefined): string => {
    let current = code ?? '';
    for (let i = 0; i < 5; i++) {
      const parent = byCode.get(current)?.parent_code;
      if (!parent) return current;
      current = parent;
    }
    return current;
  };
  return {
    byCode,
    activityRoots: rows.filter((r) => r.kind === 'activity' && !r.parent_code).sort((a, b) => a.sort_order - b.sort_order),
    rootOf,
    familyOf: (code) => rows.filter((r) => rootOf(r.code) === code).map((r) => r.code).concat(code).filter((c, i, all) => all.indexOf(c) === i),
  };
}

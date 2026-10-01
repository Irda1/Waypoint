/**
 * Estimation du prix d'entrée par personne (en euros) quand le lieu n'a pas de prix réel :
 * la source des lieux (OpenStreetMap) ne fournit pas de tarifs. Valeurs indicatives, par catégorie.
 */
const BY_CATEGORY: Record<string, number> = {
  musee: 10, galerie: 8, monument: 5, temple: 3, atelier: 25,
  parc: 0, point_de_vue: 0, marche: 0, centre_commercial: 0,
  sport: 15, spa: 40, cinema: 10, arcade: 10, parc_attractions: 40,
  club: 15, bar: 12, cafe: 6, restaurant: 25, street_food: 8,
};

export function estimatePrice(category: string | null | undefined): number | null {
  return category && category in BY_CATEGORY ? BY_CATEGORY[category] : null;
}

/** Remplit `price_amount` par une estimation quand il est absent (un prix réel reste prioritaire). */
export function withEstimatedPrice<T extends { kind?: string; category_code: string | null; price_amount: number | null }>(p: T): T {
  if (p.price_amount != null || (p.kind && p.kind !== 'activity')) return p;
  const est = estimatePrice(p.category_code);
  return est == null ? p : { ...p, price_amount: est };
}

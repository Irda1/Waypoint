// Liste « À ne pas oublier » : suggestions de départ et petites règles de tri.

export interface CheckItem { id: string; label: string; done: boolean }

export const SUGGESTIONS: readonly string[] = [
  'Passeport / carte d\'identité',
  'Billets et réservations',
  'Carte bancaire + un peu d\'espèces',
  'Assurance voyage / carte vitale européenne',
  'Chargeur et batterie externe',
  'Adaptateur de prise',
  'Trousse de médicaments',
  'Vêtements adaptés à la météo',
  'Crème solaire',
  'Écouteurs',
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Suggestions pas encore dans la liste (comparaison sans accents ni majuscules). */
export function missingSuggestions(items: CheckItem[]): string[] {
  const have = new Set(items.map((i) => norm(i.label)));
  return SUGGESTIONS.filter((s) => !have.has(norm(s)));
}

/** À faire d'abord, cochés en dernier ; l'ordre d'ajout est conservé dans chaque groupe. */
export function orderItems(items: CheckItem[]): CheckItem[] {
  return [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];
}

export function progress(items: CheckItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/** Texte propre pour un nouvel élément, ou null s'il est vide ou déjà présent. */
export function cleanLabel(raw: string, items: CheckItem[]): string | null {
  const label = raw.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!label) return null;
  return items.some((i) => norm(i.label) === norm(label)) ? null : label;
}

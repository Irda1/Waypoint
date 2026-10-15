// Liste « Valise » : petites règles de tri (les idées viennent de packing.ts).

export interface CheckItem { id: string; label: string; done: boolean }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

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

// Aides pures pour la recherche de lieux : testables avec Node, sans dépendance.

/**
 * Prépare le texte saisi pour un filtre `ilike` : retire les caractères qui ont un sens dans
 * la syntaxe des filtres de l'API (virgule, parenthèses, guillemets, étoile) et neutralise les
 * jokers SQL (% et _) pour qu'ils soient cherchés tels quels.
 */
export function likeTerm(input: string): string {
  return input
    .replace(/[,()*"']/g, ' ')
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .replace(/\s+/g, ' ')
    .trim();
}

/** 90 -> « 1 h 30 », 45 -> « 45 min », 120 -> « 2 h ». */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Terme de recherche insensible aux accents pour `ilike` (Belem trouve Belém) : la base ne propose pas
 * `unaccent`, donc chaque lettre pouvant porter un accent devient un joker « _ » (un seul caractère).
 */
export function accentTolerantTerm(input: string): string {
  const plain = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return likeTerm(plain).replace(/[aeiouycn]/gi, '_');
}

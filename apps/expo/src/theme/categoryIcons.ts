// Icône (emoji) de chaque grande catégorie de lieux, pour reconnaître d'un coup d'œil de quoi il s'agit.
export const CATEGORY_GLYPHS: Record<string, string> = {
  culture: '🏛️', gastronomie: '🍽️', nature: '🌿', sorties: '🎡', shopping: '🛍️',
  creatif: '🎨', sport: '🚴', bienetre: '🧖', nocturne: '🌙', pratique: '🚉',
};
export const glyphFor = (root: string): string => CATEGORY_GLYPHS[root] ?? '📍';

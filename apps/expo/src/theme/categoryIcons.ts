import type { IconName } from '../ui/Icon';

// Icône de chaque grande catégorie de lieux (codes de place_categories), pour reconnaître d'un coup d'œil de quoi il s'agit.
const CATEGORY_ICONS: Record<string, IconName> = {
  culture: 'culture', gastronomie: 'gastronomie', nature: 'nature', sorties: 'sorties', shopping: 'shopping',
  creatif: 'creatif', sport: 'sport', bienetre: 'bienetre', nocturne: 'nocturne', pratique: 'pratique',
};
export const iconFor = (root: string): IconName => CATEGORY_ICONS[root] ?? 'places';

import type { IconName } from '../ui/Icon';

// Icône de chaque grande catégorie de lieux (codes de place_categories), pour reconnaître d'un coup d'œil de quoi il s'agit.
// Les trajets entre villes posés par le programme portent le code de leur moyen de transport (gare, aéroport, transport).
const CATEGORY_ICONS: Record<string, IconName> = {
  culture: 'culture', gastronomie: 'gastronomie', nature: 'nature', sorties: 'sorties', shopping: 'shopping',
  creatif: 'creatif', sport: 'sport', bienetre: 'bienetre', nocturne: 'nocturne', pratique: 'pratique',
  transport: 'car', gare: 'train', aeroport: 'plane',
};
export const iconFor = (root: string): IconName => CATEGORY_ICONS[root] ?? 'places';
/** Icône d'une étape : celle de son code exact s'il en a une (gare, aéroport), sinon celle de sa grande catégorie. */
export const iconForCode = (code: string, root: string): IconName => CATEGORY_ICONS[code] ?? iconFor(root);

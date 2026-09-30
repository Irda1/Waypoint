// Monter / descendre une étape dans la journée : l'étape échange sa place (heure de début et rang) avec sa voisine.
// Fichier pur : testable avec Node.

export interface MovableItem { id: string; start_time: string | null; position: number }
export interface ItemMove { id: string; start_time: string | null; position: number }

/** Changements à enregistrer pour échanger l'étape `index` avec la précédente (-1) ou la suivante (+1). Liste vide si impossible. */
export function swapWithNeighbor(ordered: MovableItem[], index: number, dir: -1 | 1): ItemMove[] {
  const other = index + dir;
  const a = ordered[index];
  const b = ordered[other];
  if (!a || !b) return [];
  // Deux rangs identiques ne permettent pas de trancher : on décale légèrement l'étape déplacée.
  const aPos = a.position === b.position ? b.position + dir : b.position;
  const bPos = a.position === b.position ? a.position : a.position;
  return [
    { id: a.id, start_time: b.start_time, position: aPos },
    { id: b.id, start_time: a.start_time, position: bPos },
  ];
}

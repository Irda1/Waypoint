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

/**
 * Glisser-déposer : l'étape `from` va à la place `to`. Les créneaux (heure de début, rang) restent en place et les étapes
 * s'y redistribuent dans le nouvel ordre. Si les rangs ne sont pas strictement croissants, on les renumérote 1, 2, 3…
 */
export function moveToIndex(ordered: MovableItem[], from: number, to: number): ItemMove[] {
  if (from === to || !ordered[from] || to < 0 || to >= ordered.length) return [];
  const next = ordered.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  const strict = ordered.every((x, i) => i === 0 || x.position > ordered[i - 1].position);
  const moves: ItemMove[] = [];
  next.forEach((item, i) => {
    const slot = ordered[i];
    const position = strict ? slot.position : i + 1;
    if (item.id !== slot.id || item.position !== position) moves.push({ id: item.id, start_time: slot.start_time, position });
  });
  return moves;
}

/** Échange deux étapes (glisser une étape sur une autre) : elles s'échangent l'heure de début et le rang. */
export function swapItems(ordered: MovableItem[], a: number, b: number): ItemMove[] {
  const x = ordered[a];
  const y = ordered[b];
  if (a === b || !x || !y) return [];
  // Rangs identiques : on garde l'ordre relatif attendu (x prend la place de y et inversement).
  const same = x.position === y.position;
  const xPos = same ? y.position + (b > a ? 1 : -1) : y.position;
  return [
    { id: x.id, start_time: y.start_time, position: xPos },
    { id: y.id, start_time: x.start_time, position: x.position },
  ];
}

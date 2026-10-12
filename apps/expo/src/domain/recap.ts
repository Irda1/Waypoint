// Récap animé du voyage : les chiffres et les jours à montrer. Fonctions pures, testées sans réseau.
import { kmBetween } from './addPlace.ts';

export interface RecapStats { days: number; cities: number; km: number; places: number; spent: number; photos: number; pages: number }

/** Jours, villes, kilomètres d'une ville à la suivante (à vol d'oiseau), lieux au programme (plan A), dépenses, photos, pages de carnet. */
export function recapStats(a: {
  days: { id: string }[];
  destinations: { lat: number; lng: number }[];
  items: { place_id: number | null; plan: string }[];
  expenses: { amount: number }[];
  photos: unknown[];
  notes: { note: string }[];
}): RecapStats {
  let km = 0;
  for (let i = 1; i < a.destinations.length; i++) {
    const p = a.destinations[i - 1], q = a.destinations[i];
    km += kmBetween(p.lat, p.lng, q.lat, q.lng);
  }
  return {
    days: a.days.length,
    cities: a.destinations.length,
    km: Math.round(km),
    places: a.items.filter((i) => i.place_id != null && i.plan === 'A').length,
    spent: Math.round(a.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)),
    photos: a.photos.length,
    pages: a.notes.filter((n) => n.note.trim()).length,
  };
}

/** Jours du carnet à montrer (au plus `max`) : d'abord ceux qui ont des photos, puis remis dans l'ordre du voyage. */
export function recapDays<D extends { id: string }>(days: D[], hasPhoto: (id: string) => boolean, hasNote: (id: string) => boolean, max = 6): D[] {
  const order = new Map(days.map((d, i) => [d.id, i]));
  const written = days.filter((d) => hasPhoto(d.id) || hasNote(d.id));
  const picked = [...written].sort((x, y) => Number(hasPhoto(y.id)) - Number(hasPhoto(x.id)) || order.get(x.id)! - order.get(y.id)!).slice(0, max);
  return picked.sort((x, y) => order.get(x.id)! - order.get(y.id)!);
}

/** Un extrait de note pour un écran : une phrase ou deux, au plus `max` caractères. */
export function excerpt(note: string, max = 140): string {
  const t = note.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > max / 2 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

// Villes d'un voyage : ordre, nuits et détail des nuits. Fichier pur : testable avec Node.
import { changeNights, cityPerDay, spreadNights } from './wizard.ts';

export interface Dest { id: number; name: string; nights: number }

/** Nombre de nuits d'un voyage : un jour de moins que de jours (le dernier est le jour du départ), au moins 1. */
export const totalNights = (dayCount: number): number => Math.max(1, dayCount - 1);

/** Ajoute une ville à la fin : les nuits se répartissent de nouveau également. */
export function addCity(dests: Dest[], city: { id: number; name: string }, nights: number): Dest[] {
  if (dests.some((d) => d.id === city.id)) return dests;
  return spreadNights([...dests, { id: city.id, name: city.name, nights: 0 }], nights);
}

/** Retire une ville : ses nuits sont redistribuées également. */
export function removeCity(dests: Dest[], id: number, nights: number): Dest[] {
  return spreadNights(dests.filter((d) => d.id !== id), nights);
}

/** Déplace la ville d'un rang à un autre ; les nuits restent attachées à leur ville. */
export function moveCity(dests: Dest[], from: number, to: number): Dest[] {
  if (from === to || !dests[from] || to < 0 || to >= dests.length) return dests;
  const next = dests.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** +1 / −1 nuit sur une ville : la nuit vient d'une autre ville ou lui revient. */
export const shiftNights = (dests: Dest[], index: number, delta: 1 | -1): Dest[] => changeNights(dests, index, delta);

export interface CityStay { id: number; name: string; nights: { from: string; to: string }[] }

/** Détail des nuits de chaque ville : pour chaque jour attribué à la ville, la nuit qui va du jour au lendemain. */
export function nightDetail(dests: Dest[], dates: string[], nextDay: (iso: string) => string): CityStay[] {
  const perDay = cityPerDay(dests, dates.length);
  return dests.map((d) => ({
    id: d.id, name: d.name,
    nights: dates.map((date, i) => ({ date, i })).filter(({ i }) => perDay[i] === d.id && i < dates.length - 1).map(({ date }) => ({ from: date, to: nextDay(date) })),
  }));
}

/** Jours à rattacher à chaque ville (ids de jours), d'après l'ordre et les nuits. */
export function dayCities(dests: Dest[], dayIds: string[]): Map<number | null, string[]> {
  const perDay = cityPerDay(dests, dayIds.length);
  const out = new Map<number | null, string[]>();
  perDay.forEach((c, i) => out.set(c, [...(out.get(c) ?? []), dayIds[i]]));
  return out;
}

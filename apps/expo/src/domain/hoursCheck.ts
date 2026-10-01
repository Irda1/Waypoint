// Récapitulatif des horaires d'ouverture sur tout le voyage : quelles activités tombent un jour de fermeture, en dehors
// des horaires, ou se chevauchent. Fichier pur : testable avec Node.
import { checkOpening } from './openingHours.ts';
import { formatTime, scheduleDay, weekdayOf } from './planning.ts';
import type { Place, TripItem } from './types.ts';

interface DayRef { id: string; day_date: string }

export type ProblemKind = 'closed' | 'outside' | 'overlap';
export interface HoursProblem {
  itemId: string;
  dayId: string;
  /** Rang du jour dans le voyage, à partir de 0. */
  dayIndex: number;
  dayNumber: number;
  name: string;
  kind: ProblemKind;
  text: string;
}
export interface HoursReport { problems: HoursProblem[]; checked: number; unknown: number }

const slot = (a: number, b: number): string => `${formatTime(a % 1440)}–${formatTime(b % 1440)}`;

/** Vérifie les activités du plan A de chaque jour : fermé ce jour-là, hors horaires, chevauchement. `unknown` = horaires inconnus. */
export function tripHoursProblems(args: { days: DayRef[]; items: TripItem[]; places: Map<number, Place> }): HoursReport {
  const problems: HoursProblem[] = [];
  let checked = 0;
  let unknown = 0;
  args.days.forEach((day, dayIndex) => {
    const schedule = scheduleDay({ date: day.day_date, plan: 'A', items: args.items.filter((i) => i.day_id === day.id), places: args.places });
    for (const s of schedule) {
      const name = s.place?.name ?? s.item.title ?? 'Étape';
      const base = { itemId: s.item.id, dayId: day.id, dayIndex, dayNumber: dayIndex + 1, name };
      if (s.place) {
        const res = checkOpening(s.place.opening_hours, s.place.closed_days, weekdayOf(day.day_date), s.startMin, s.endMin);
        if (res.status === 'unknown') unknown++;
        else checked++;
        if (res.status === 'closed') problems.push({ ...base, kind: 'closed', text: `Fermé le ${res.day}` });
        else if (res.status === 'outside') problems.push({ ...base, kind: 'outside', text: `Ouvert ${res.slots.map(([a, b]) => slot(a, b)).join(', ')}, ton créneau est en dehors` });
      }
      const overlap = s.issues.find((i) => i.type === 'overlap');
      if (overlap && overlap.type === 'overlap') problems.push({ ...base, kind: 'overlap', text: `Chevauche l'étape précédente de ${overlap.minutes} min (trajet compris)` });
    }
  });
  return { problems, checked, unknown };
}

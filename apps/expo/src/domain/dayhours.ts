// Horaires d'une journée : départ / retour du logement, retour tardif, et « journée en cours ».
import { estimateTravel, formatTime, parseTime } from './planning.ts';
import type { ScheduledItem } from './planning.ts';
import type { LatLng } from './types.ts';

export const DEFAULT_DEPART = '09:30';
export const DEFAULT_RETURN = '23:30';

export interface DayHours { depart: string; return: string; isDefault: boolean }

/** Heures du jour, ou les valeurs par défaut. Les heures de la base peuvent porter les secondes (« 09:30:00 »). */
export function dayHours(depart: string | null | undefined, ret: string | null | undefined): DayHours {
  const d = depart ? depart.slice(0, 5) : DEFAULT_DEPART;
  const r = ret ? ret.slice(0, 5) : DEFAULT_RETURN;
  return { depart: d, return: r, isDefault: d === DEFAULT_DEPART && r === DEFAULT_RETURN };
}

export interface HoursIssue { kind: 'late_return' | 'early_start'; minutes: number; at: string }

/**
 * Vérifie le programme contre les heures du jour : retour prévu (fin de la dernière étape + trajet vers le logement)
 * après l'heure de retour souhaitée, ou première étape avant l'heure de départ.
 */
export function hoursIssues(schedule: ScheduledItem[], hours: DayHours, lodging: LatLng | null): HoursIssue[] {
  const out: HoursIssue[] = [];
  const timed = schedule.filter((s) => s.startMin != null && s.endMin != null);
  if (timed.length === 0) return out;
  const first = timed[0];
  const depart = parseTime(hours.depart);
  if (depart != null && first.startMin! < depart) out.push({ kind: 'early_start', minutes: depart - first.startMin!, at: formatTime(first.startMin!) });
  const last = timed[timed.length - 1];
  const wanted = parseTime(hours.return);
  if (wanted != null) {
    const back = last.place && lodging ? estimateTravel(last.place, lodging).minutes : 0;
    const arrival = last.endMin! + back;
    if (arrival > wanted) out.push({ kind: 'late_return', minutes: arrival - wanted, at: formatTime(arrival) });
  }
  return out;
}

export type StepState = 'past' | 'current' | 'upcoming';
export interface LiveStatus {
  states: StepState[];
  current: { index: number; remainingMin: number } | null;
  next: { index: number; startMin: number; travelMin: number | null } | null;
}

/** État d'une journée à `nowMin` (minutes depuis minuit) : étape en cours, temps restant, prochaine étape. */
export function liveStatus(schedule: ScheduledItem[], nowMin: number): LiveStatus {
  const states: StepState[] = schedule.map((s) => {
    if (s.startMin == null || s.endMin == null) return 'upcoming';
    if (nowMin >= s.endMin) return 'past';
    return nowMin >= s.startMin ? 'current' : 'upcoming';
  });
  const c = states.indexOf('current');
  const nextIndex = states.findIndex((st, i) => st === 'upcoming' && schedule[i].startMin != null);
  const nextItem = nextIndex >= 0 ? schedule[nextIndex] : null;
  return {
    states,
    current: c >= 0 ? { index: c, remainingMin: schedule[c].endMin! - nowMin } : null,
    next: nextItem ? { index: nextIndex, startMin: nextItem.startMin!, travelMin: nextItem.travelFromPrevious?.minutes ?? null } : null,
  };
}

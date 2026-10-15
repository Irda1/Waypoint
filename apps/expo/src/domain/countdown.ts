import type { TripStatus } from '../lib/dates.ts';

/** Ce que la couverture d'un voyage à venir affiche avant le départ (null : rien, voyage sans date, en cours ou fini). */
export type CountdownView =
  | { kind: 'days'; from: string; to: string }   // chiffres du jour et de la veille (le dernier se retourne d'un cran)
  | { kind: 'tomorrow' }
  | { kind: 'today' };

export function countdownView(st: TripStatus): CountdownView | null {
  if (st.kind === 'ongoing' && st.day === 1) return { kind: 'today' };
  if (st.kind !== 'upcoming') return null;
  if (st.inDays <= 1) return { kind: 'tomorrow' };
  const width = Math.max(2, String(st.inDays + 1).length);
  return { kind: 'days', from: String(st.inDays + 1).padStart(width, '0'), to: String(st.inDays).padStart(width, '0') };
}

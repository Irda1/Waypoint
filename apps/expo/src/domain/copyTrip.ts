// « Refaire ce voyage » : nom et date de départ proposés, nouvelles dates. Fonctions pures, testées sans réseau.
import { addDays, diffDays } from '../lib/dates.ts';

/** Nom proposé pour la copie : l'année éventuelle en fin de nom est remplacée par celle du nouveau départ. */
export function copyTitle(title: string, start: string | null): string {
  const base = title.replace(/\s*\b(19|20)\d{2}\s*$/, '').trim() || title.trim();
  return (start ? `${base} ${start.slice(0, 4)}` : base).slice(0, 120);
}

/** Départ proposé : le même jour l'année suivante s'il est à venir, sinon dans 30 jours. Null pour un voyage sans dates. */
export function suggestStart(startsOn: string | null, today: string): string | null {
  if (!startsOn) return null;
  const md = startsOn.slice(5) === '02-29' ? '02-28' : startsOn.slice(5);
  const next = `${Number(startsOn.slice(0, 4)) + 1}-${md}`;
  return next > today ? next : addDays(today, 30);
}

/** Dates de la copie : même durée, décalée au départ choisi. */
export function shiftedRange(startsOn: string | null, endsOn: string | null, start: string): { end: string | null; days: number | null } {
  if (!startsOn || !endsOn) return { end: null, days: null };
  const length = diffDays(startsOn, endsOn);
  return { end: addDays(start, length), days: length + 1 };
}

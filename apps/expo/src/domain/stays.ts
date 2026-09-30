// Hébergement d'un voyage : logique pure (testable avec Node).

export interface DayRef { id: string; city_id: number | null; stay_id: string | null }

/**
 * Jours auxquels rattacher un hébergement choisi dans une ville : ceux de cette ville, plus les jours sans ville
 * quand le voyage n'a qu'une destination. Les jours qui ont déjà un hébergement ne sont pas touchés.
 */
export function daysForStay(days: DayRef[], cityId: number, destinationCount: number): string[] {
  return days
    .filter((d) => !d.stay_id && (d.city_id === cityId || (d.city_id == null && destinationCount <= 1)))
    .map((d) => d.id);
}

/** Nombre de nuits (jours rattachés) de chaque hébergement. */
export function nightsByStay(days: DayRef[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of days) if (d.stay_id) out.set(d.stay_id, (out.get(d.stay_id) ?? 0) + 1);
  return out;
}

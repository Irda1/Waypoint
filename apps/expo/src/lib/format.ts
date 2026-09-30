export function formatMoney(amount: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/** « 2026-10-13 » -> « mardi 13 octobre » (sans décalage de fuseau horaire). */
export function formatDay(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}

export const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
export const isTime = (v: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Accepte « 12,5 » ou « 12.5 » ; renvoie null si invalide ou négatif. */
export function parseAmount(v: string): number | null {
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && v.trim() !== '' ? Math.round(n * 100) / 100 : null;
}

/** Étiquette lisible d'un voyage : « Dans 12 jours », « Jour 2 sur 4 », « Terminé », « Dates à définir ». */
export function tripStatusLabel(s: { kind: 'undated' } | { kind: 'upcoming'; inDays: number } | { kind: 'ongoing'; day: number; total: number } | { kind: 'past' }): string {
  if (s.kind === 'undated') return 'Dates à définir';
  if (s.kind === 'past') return 'Terminé';
  if (s.kind === 'ongoing') return `Jour ${s.day} sur ${s.total}`;
  return s.inDays === 1 ? 'Demain' : `Dans ${s.inDays} jours`;
}

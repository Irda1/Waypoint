// Dates « AAAA-MM-JJ » sans décalage de fuseau horaire (tout se calcule en UTC). Fichier pur : testable avec Node.

const DAY = 86_400_000;
const toMs = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso: string, n: number): string => toIso(toMs(iso) + n * DAY);
/** Nombre de jours entre deux dates (b - a). */
export const diffDays = (a: string, b: string): number => Math.round((toMs(b) - toMs(a)) / DAY);

/** Aujourd'hui, à la date locale de l'appareil. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Jours d'un mois, avec les cases vides de début de grille (semaine qui commence le lundi). */
export function monthGrid(year: number, month0: number): { blanks: number; days: string[] } {
  const first = Date.UTC(year, month0, 1);
  const blanks = (new Date(first).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return { blanks, days: Array.from({ length: count }, (_, i) => toIso(first + i * DAY)) };
}

/** Les `count` prochains mois à partir de celui d'aujourd'hui. */
export function nextMonths(today: string, count: number): { year: number; month0: number }[] {
  const [y, m] = today.split('-').map(Number);
  return Array.from({ length: count }, (_, k) => ({ year: y + Math.floor((m - 1 + k) / 12), month0: (m - 1 + k) % 12 }));
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
/** « lun. 13 oct. » */
export const shortDate = (iso: string): string => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
/** « lundi 13 octobre 2026 » (lecteurs d'écran) */
export const longDate = (iso: string): string => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
/** « octobre 2026 » */
export const monthTitle = (year: number, month0: number): string => fmt(toIso(Date.UTC(year, month0, 1)), { month: 'long', year: 'numeric' });
/** « 13 – 18 oct. » ou « 28 oct. – 3 nov. » */
export function dateRange(a: string, b: string): string {
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return sameMonth ? `${fmt(a, { day: 'numeric' })} – ${fmt(b, { day: 'numeric', month: 'short' })}` : `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(b, { day: 'numeric', month: 'short' })}`;
}

export type TripStatus = { kind: 'undated' } | { kind: 'upcoming'; inDays: number } | { kind: 'ongoing'; day: number; total: number } | { kind: 'past' };

/** Où en est un voyage par rapport à aujourd'hui (dates « AAAA-MM-JJ », fin comprise). */
export function tripStatus(startsOn: string | null, endsOn: string | null, today: string): TripStatus {
  if (!startsOn) return { kind: 'undated' };
  const end = endsOn ?? startsOn;
  if (today < startsOn) return { kind: 'upcoming', inDays: diffDays(today, startsOn) };
  if (today > end) return { kind: 'past' };
  return { kind: 'ongoing', day: diffDays(startsOn, today) + 1, total: diffDays(startsOn, end) + 1 };
}

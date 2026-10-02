// Rappels locaux d'un voyage : la veille du départ et la première activité horaire de chaque jour.
// Fonction pure : elle renvoie la liste à programmer, sans rien planifier elle-même.

export interface NotifPrefs {
  /** La veille du départ, à 18 h. */
  eve: boolean;
  /** Le jour J à 8 h : les activités à réserver ou payer ce jour-là. */
  bookings: boolean;
  /** Avant chaque activité qui a une heure. */
  next: boolean;
  /** Combien de minutes avant l'activité. */
  minutes: number;
}

export const DEFAULT_PREFS: NotifPrefs = { eve: true, bookings: true, next: true, minutes: 30 };
export const MINUTES_CHOICES = [10, 15, 30, 60, 120];

export interface ReminderInput {
  tripTitle: string;
  startsOn: string | null;
  days: { id: string; day_date: string }[];
  items: { id?: string; day_id: string; plan: 'A' | 'B' | 'C'; title: string | null; place_id: number | null; start_time: string | null; position: number }[];
  placeName: (placeId: number) => string | undefined;
  prefs?: NotifPrefs;
  /** Noms des activités à réserver ou payer, par jour (id du jour). */
  dueByDay?: Record<string, string[]>;
}

export interface Reminder { key: string; at: Date; title: string; body: string }

/** iOS garde au plus 64 notifications programmées : on en garde un peu moins. */
export const MAX_REMINDERS = 60;
export const EVE_HOUR = 18;
export const BOOKING_HOUR = 8;

function local(iso: string, hour: number, minute: number): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

function listNames(names: string[]): string {
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} et ${names.length - 3} autre${names.length - 3 > 1 ? 's' : ''}` : shown;
}

export function buildReminders(input: ReminderInput, now: Date = new Date()): Reminder[] {
  const prefs = input.prefs ?? DEFAULT_PREFS;
  const out: Reminder[] = [];

  if (prefs.eve && input.startsOn) {
    const eve = local(input.startsOn, EVE_HOUR, 0);
    eve.setDate(eve.getDate() - 1);
    out.push({ key: `eve-${input.startsOn}`, at: eve, title: input.tripTitle, body: 'Départ demain : billets, papiers, chargeurs… tout est prêt ?' });
  }

  const dayDate = new Map(input.days.map((d) => [d.id, d.day_date]));

  if (prefs.bookings) {
    for (const [dayId, names] of Object.entries(input.dueByDay ?? {})) {
      const date = dayDate.get(dayId);
      if (!date || !names.length) continue;
      out.push({ key: `book-${dayId}`, at: local(date, BOOKING_HOUR, 0), title: input.tripTitle, body: `Aujourd'hui, à réserver ou payer : ${listNames(names)}` });
    }
  }

  if (prefs.next) {
    for (const i of input.items) {
      if (i.plan !== 'A' || !i.start_time || !dayDate.has(i.day_id)) continue;
      const [h, m] = i.start_time.split(':').map(Number);
      const at = local(dayDate.get(i.day_id)!, h, m);
      at.setMinutes(at.getMinutes() - prefs.minutes);
      const name = i.title?.trim() || (i.place_id != null ? input.placeName(i.place_id) : undefined) || 'Prochaine étape';
      out.push({ key: `next-${i.id ?? `${i.day_id}-${i.position}`}`, at, title: input.tripTitle, body: `Dans ${prefs.minutes} min : ${name} (${i.start_time.slice(0, 5)})` });
    }
  }

  return out
    .filter((r) => r.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_REMINDERS);
}

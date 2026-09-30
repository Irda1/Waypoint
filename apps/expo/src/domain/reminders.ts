// Rappels locaux d'un voyage : la veille du départ et la première activité horaire de chaque jour.
// Fonction pure : elle renvoie la liste à programmer, sans rien planifier elle-même.

export interface ReminderInput {
  tripTitle: string;
  startsOn: string | null;
  days: { id: string; day_date: string }[];
  items: { day_id: string; plan: 'A' | 'B' | 'C'; title: string | null; place_id: number | null; start_time: string | null; position: number }[];
  placeName: (placeId: number) => string | undefined;
}

export interface Reminder { key: string; at: Date; title: string; body: string }

/** iOS garde au plus 64 notifications programmées : on en garde un peu moins. */
export const MAX_REMINDERS = 60;
export const LEAD_MIN = 60;
export const EVE_HOUR = 18;

function local(iso: string, hour: number, minute: number): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

export function buildReminders(input: ReminderInput, now: Date = new Date()): Reminder[] {
  const out: Reminder[] = [];

  if (input.startsOn) {
    const eve = local(input.startsOn, EVE_HOUR, 0);
    eve.setDate(eve.getDate() - 1);
    out.push({ key: `eve-${input.startsOn}`, at: eve, title: input.tripTitle, body: 'Départ demain : billets, papiers, chargeurs… tout est prêt ?' });
  }

  const dayDate = new Map(input.days.map((d) => [d.id, d.day_date]));
  const firstByDay = new Map<string, ReminderInput['items'][number]>();
  for (const i of input.items) {
    if (i.plan !== 'A' || !i.start_time || !dayDate.has(i.day_id)) continue;
    const best = firstByDay.get(i.day_id);
    if (!best || i.start_time.slice(0, 5) < best.start_time!.slice(0, 5) || (i.start_time === best.start_time && i.position < best.position)) firstByDay.set(i.day_id, i);
  }
  for (const [dayId, item] of firstByDay) {
    const date = dayDate.get(dayId)!;
    const [h, m] = item.start_time!.split(':').map(Number);
    const at = local(date, h, m);
    at.setMinutes(at.getMinutes() - LEAD_MIN);
    const name = item.title?.trim() || (item.place_id != null ? input.placeName(item.place_id) : undefined) || 'Première étape';
    out.push({ key: `first-${dayId}`, at, title: input.tripTitle, body: `À ${item.start_time!.slice(0, 5)} : ${name}` });
  }

  return out
    .filter((r) => r.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_REMINDERS);
}

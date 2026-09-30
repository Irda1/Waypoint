// Horaires d'ouverture d'un lieu (format OpenStreetMap « opening_hours », cas courants) et vérification d'une visite.
// Fichier pur : testable avec Node. Les formats trop rares (jours fériés, semaines, soleil…) rendent « inconnu ».

/** Créneaux d'ouverture par jour (0 = dimanche … 6 = samedi), en minutes depuis minuit. */
export type WeekHours = Record<number, [number, number][]>;

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const dayName = (weekday: number): string => NAMES[weekday] ?? '';

const toMin = (h: string): number | null => {
  const m = h.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[1]) <= 24 && Number(m[2]) < 60 ? v : null;
};

function parseDays(part: string): number[] | null {
  const out = new Set<number>();
  for (const seg of part.split(',')) {
    const t = seg.trim();
    if (!t) return null;
    const range = t.match(/^([A-Z][a-z])-([A-Z][a-z])$/);
    if (range) {
      const a = DAYS.indexOf(range[1]);
      const b = DAYS.indexOf(range[2]);
      if (a < 0 || b < 0) return null;
      for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; }
    } else {
      const d = DAYS.indexOf(t);
      if (d < 0) return null;
      out.add(d);
    }
  }
  return [...out];
}

/** Lit un texte « Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off » ; null si le format n'est pas compris. */
export function parseOpeningHours(text: string | null | undefined): WeekHours | null {
  const src = text?.trim();
  if (!src) return null;
  if (src === '24/7') return Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [[0, 1440] as [number, number]]]));
  const week: WeekHours = {};
  let any = false;
  for (const rule of src.split(';')) {
    const r = rule.trim();
    if (!r) continue;
    const m = r.match(/^((?:[A-Z][a-z](?:-[A-Z][a-z])?)(?:\s*,\s*[A-Z][a-z](?:-[A-Z][a-z])?)*)?\s*(.*)$/);
    if (!m) return null;
    const days = m[1] ? parseDays(m[1]) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;
    const rest = m[2].trim();
    if (rest === 'off' || rest === 'closed') { for (const d of days) week[d] = []; any = true; continue; }
    const slots: [number, number][] = [];
    for (const s of rest.split(',')) {
      const t = s.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
      if (!t) return null;
      const a = toMin(t[1]);
      let b = toMin(t[2]);
      if (a == null || b == null) return null;
      if (b <= a) b += 1440; // passe minuit
      slots.push([a, b]);
    }
    if (!slots.length) return null;
    for (const d of days) week[d] = slots;
    any = true;
  }
  return any ? week : null;
}

export type OpeningCheck =
  | { status: 'unknown' }
  | { status: 'ok' }
  | { status: 'closed'; day: string }
  | { status: 'outside'; slots: [number, number][] };

/** La visite [startMin, endMin] un jour donné est-elle dans les horaires ? `closedDays` sert quand le texte manque. */
export function checkOpening(hours: string | null | undefined, closedDays: number[], weekday: number, startMin: number | null, endMin: number | null): OpeningCheck {
  if (closedDays.includes(weekday)) return { status: 'closed', day: dayName(weekday) };
  const week = parseOpeningHours(hours);
  if (!week) return { status: 'unknown' };
  const slots = week[weekday];
  if (slots == null) return { status: 'unknown' };
  if (slots.length === 0) return { status: 'closed', day: dayName(weekday) };
  if (startMin == null) return { status: 'ok' };
  const end = endMin ?? startMin;
  return slots.some(([a, b]) => startMin >= a && end <= b) ? { status: 'ok' } : { status: 'outside', slots };
}

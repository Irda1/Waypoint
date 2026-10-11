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

/** « 9 h », « 17 h 30 », « 0 h » (minutes depuis minuit, le lendemain compris). */
export function formatHour(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), r = m % 60;
  return `${h} h${r ? ` ${String(r).padStart(2, '0')}` : ''}`;
}

/** Ouvert ou fermé à l'instant `now` : texte court pour la fiche (« Ouvert · ferme à 17 h »), ton pour la couleur. */
export function openNow(hours: string | null | undefined, closedDays: number[], now: Date): { tone: 'ok' | 'warn' | 'none'; text: string } {
  const day = now.getDay(), min = now.getHours() * 60 + now.getMinutes();
  const week = parseOpeningHours(hours);
  if (!week) return closedDays.includes(day) ? { tone: 'warn', text: 'Fermé aujourd\'hui' } : { tone: 'none', text: 'Horaires non renseignés' };
  if ([0, 1, 2, 3, 4, 5, 6].every((d) => week[d]?.length === 1 && week[d][0][0] === 0 && week[d][0][1] >= 1440)) return { tone: 'ok', text: 'Ouvert 24 h/24' };
  const yesterday = week[(day + 6) % 7] ?? [];
  const late = yesterday.find(([, b]) => b > 1440 && min < b - 1440);
  if (late) return { tone: 'ok', text: `Ouvert · ferme à ${formatHour(late[1])}` };
  const today = week[day];
  if (today == null) return { tone: 'none', text: 'Horaires non renseignés' };
  const now_ = today.find(([a, b]) => min >= a && min < b);
  if (now_) return { tone: 'ok', text: `Ouvert · ferme à ${formatHour(now_[1])}` };
  const later = today.find(([a]) => a > min);
  if (later) return { tone: 'warn', text: `Fermé · ouvre à ${formatHour(later[0])}` };
  for (let k = 1; k <= 7; k++) {
    const d = (day + k) % 7, first = week[d]?.[0];
    if (first) return { tone: 'warn', text: `Fermé · ouvre ${k === 1 ? 'demain' : dayName(d)} à ${formatHour(first[0])}` };
  }
  return { tone: 'warn', text: 'Fermé' };
}

/** Horaires de la semaine, du lundi au dimanche (« Lun », « 9 h – 17 h »), ou null s'ils ne sont pas lisibles. */
export function weekLines(hours: string | null | undefined): { weekday: number; day: string; text: string }[] | null {
  const week = parseOpeningHours(hours);
  if (!week) return null;
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const slots = week[d];
    const name = dayName(d);
    return {
      weekday: d,
      day: name.charAt(0).toUpperCase() + name.slice(1, 3),
      text: slots == null ? 'Non renseigné' : slots.length === 0 ? 'Fermé' : slots.map(([a, b]) => (a === 0 && b >= 1440 ? '24 h/24' : `${formatHour(a)} – ${formatHour(b)}`)).join(', '),
    };
  });
}

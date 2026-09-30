// Export du programme : texte à partager et agenda .ics (Google Agenda, Apple Agenda, Outlook).
// Fonctions pures : elles ne lisent que ce qu'on leur donne. Seul le plan A est exporté.

export interface ExportDay { id: string; day_date: string }
export interface ExportItem { id: string; day_id: string; plan: 'A' | 'B' | 'C'; title: string | null; place_id: number | null; start_time: string | null; duration_min: number | null; position: number }
export interface ExportInput {
  title: string;
  days: ExportDay[];
  items: ExportItem[];
  placeName: (placeId: number) => string | undefined;
  placeAddress?: (placeId: number) => string | undefined;
}

export interface ExportEntry { date: string; start: string | null; durationMin: number | null; title: string; place: string | null }

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/** Étapes du plan A, triées par date puis par heure (sans heure : dans l'ordre du jour). */
export function exportEntries(input: ExportInput): ExportEntry[] {
  const dayDate = new Map(input.days.map((d) => [d.id, d.day_date]));
  return input.items
    .filter((i) => i.plan === 'A' && dayDate.has(i.day_id))
    .map((i) => ({
      date: dayDate.get(i.day_id)!,
      start: hhmm(i.start_time),
      durationMin: i.duration_min,
      title: i.title?.trim() || (i.place_id != null ? input.placeName(i.place_id) : undefined) || 'Étape',
      place: i.place_id != null ? input.placeAddress?.(i.place_id) ?? null : null,
      position: i.position,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position || (a.start ?? '99:99').localeCompare(b.start ?? '99:99'))
    .map(({ position: _p, ...rest }) => rest);
}

const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${FR_DAYS[wd]} ${d} ${FR_MONTHS[m - 1]}`;
}

/** Programme lisible, prêt à coller dans un message. */
export function programText(input: ExportInput): string {
  const entries = exportEntries(input);
  const lines: string[] = [`${input.title}`, ''];
  const dates = [...new Set(input.days.map((d) => d.day_date))].sort();
  for (const date of dates) {
    lines.push(frenchDate(date));
    const todays = entries.filter((e) => e.date === date);
    if (!todays.length) lines.push('  (rien de prévu)');
    for (const e of todays) lines.push(`  ${e.start ?? '  —  '}  ${e.title}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Les lignes d'un .ics ne dépassent pas 75 caractères : la suite commence par une espace. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(' ' + line.slice(i, i + 74));
  return parts.join('\r\n');
}

const compact = (date: string) => date.replace(/-/g, '');
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
function endOf(date: string, start: string, durationMin: number): { date: string; time: string } {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + durationMin;
  return { date: addDays(date, Math.floor(total / 1440)), time: `${String(Math.floor((total % 1440) / 60)).padStart(2, '0')}${String(total % 60).padStart(2, '0')}00` };
}

/** Agenda .ics : heures « flottantes » (heure locale du lieu, sans fuseau) ; une étape sans heure devient un événement sur la journée. */
export function buildIcs(input: ExportInput, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Waypoint//Programme//FR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(input.title)}`];
  exportEntries(input).forEach((e, i) => {
    out.push('BEGIN:VEVENT', `UID:waypoint-${compact(e.date)}-${i}-${stamp}@waypoint`, `DTSTAMP:${stamp}`);
    if (e.start) {
      const end = endOf(e.date, e.start, e.durationMin && e.durationMin > 0 ? e.durationMin : 60);
      out.push(`DTSTART:${compact(e.date)}T${e.start.replace(':', '')}00`, `DTEND:${compact(end.date)}T${end.time}`);
    } else {
      out.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`);
    }
    out.push(`SUMMARY:${esc(e.title)}`);
    if (e.place) out.push(`LOCATION:${esc(e.place)}`);
    out.push('END:VEVENT');
  });
  out.push('END:VCALENDAR');
  return out.map(fold).join('\r\n') + '\r\n';
}

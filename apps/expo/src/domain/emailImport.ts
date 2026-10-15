// Import d'une réservation depuis le texte d'un e-mail de confirmation (vol, train, hébergement, activité).
// Règles simples en français et en anglais, sans serveur : le résultat est toujours vérifié avant d'être ajouté.
import type { BookingDraft, BookingKind } from './bookings.ts';

// « mar. » (mardi) n'est pas un mois : seuls « mars » et « march » comptent.
const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, january: 1, jan: 1, fevrier: 2, fevr: 2, fev: 2, february: 2, feb: 2, mars: 3, march: 3,
  avril: 4, avr: 4, april: 4, apr: 4, mai: 5, may: 5, juin: 6, june: 6, jun: 6, juillet: 7, juil: 7, july: 7, jul: 7,
  aout: 8, august: 8, aug: 8, septembre: 9, sept: 9, september: 9, sep: 9, octobre: 10, october: 10, oct: 10,
  novembre: 11, november: 11, nov: 11, decembre: 12, december: 12, dec: 12,
};
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const pad = (n: number) => String(n).padStart(2, '0');
const ARROW = '(?:→|->|–|—|>|\\bto\\b|\\bà\\b|-)';
const TIME = '(\\d{1,2})[:h](\\d{2})';

interface Found { at: number; iso: string }

/** Toutes les dates du texte, avec leur position. Sans année : celle qui place la date après `today` (au plus 30 jours avant). */
export function findDates(text: string, today: string): Found[] {
  const t = plain(text), out: Found[] = [];
  const year0 = Number(today.slice(0, 4));
  const iso = (y: number | null, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    let yy = y ?? year0;
    if (y === null && `${yy}-${pad(m)}-${pad(d)}` < shift(today, -30)) yy += 1;
    return `${yy}-${pad(m)}-${pad(d)}`;
  };
  const push = (at: number, v: string | null) => { if (v && !out.some((f) => f.at === at)) out.push({ at, iso: v }); };
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(m.index!, iso(+m[1], +m[2], +m[3]));
  for (const m of t.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) push(m.index!, iso(+m[3], +m[2], +m[1]));
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${MONTH_RE})\\.?(?:\\s+(\\d{4}))?\\b`, 'g'))) push(m.index!, iso(m[3] ? +m[3] : null, MONTHS[m[2]], +m[1]));
  for (const m of t.matchAll(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2}),?(?:\\s+(\\d{4}))?\\b`, 'g'))) push(m.index!, iso(m[3] ? +m[3] : null, MONTHS[m[1]], +m[2]));
  return out.sort((a, b) => a.at - b.at);
}
function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
const hhmm = (h: string, m: string) => (+h <= 23 && +m <= 59 ? `${pad(+h)}:${m}` : '');

/** Numéro de réservation après son libellé (« Référence », « Booking reference », « Code de confirmation »…). */
export function findReference(text: string): string {
  const re = /(?:r[ée]f[ée]rence(?:\s+de\s+(?:r[ée]servation|dossier))?|r[ée]f\.|booking\s+(?:reference|code|number)|confirmation\s+(?:number|code)|code\s+de\s+(?:confirmation|r[ée]servation)|num[ée]ro\s+de\s+(?:r[ée]servation|confirmation|dossier)|n°\s*(?:de\s+)?(?:r[ée]servation|confirmation|dossier)|record\s+locator|pnr|dossier)\s*(?:n°|#|:)?\s*:?\s*([A-Za-z0-9][A-Za-z0-9.\-]{3,24})/gi;
  for (const m of text.matchAll(re)) {
    const v = m[1].replace(/[.\-]+$/, '');
    if (v === v.toUpperCase() && /\d|[A-Z]{5,}/.test(v) && v.length >= 5) return v;
  }
  return '';
}

const findUrl = (text: string) => (text.match(/https?:\/\/[^\s<>"')]+/i)?.[0] ?? '').replace(/[.,;…]+$/, '').slice(0, 500);
const clean = (s: string) => s.replace(/\(([A-Z]{3})\)/g, '').replace(/\s{2,}/g, ' ').replace(/^[\s:·—–-]+|[\s:·—–-]+$/g, '').trim();
// Numéro de vol ou de train en tête de ligne : TP 437, AF1234, EZY4521, TGV INOUI 6603.
const NUMBER = /^(?:vol\s+|flight\s+)?((?:TGV(?:\s+INOUI)?|OUIGO|INTERCITES|TER|EUROSTAR|FRECCIAROSSA|AVE|ICE)\s*\d{2,5}|[A-Z]{3}\s?\d{2,4}|[A-Z\d]{2}\s?\d{2,4})\b\s*[·—–-]?\s*/i;

interface Segment { from: string; to: string; dep: string; arr: string; number: string; line: number; iata: boolean }

function findSegments(lines: string[]): Segment[] {
  const out: Segment[] = [];
  const after = new RegExp(`^(.*?\\S)\\s+${TIME}\\s*${ARROW}\\s*(.*?\\S)\\s+${TIME}\\b`);
  const before = new RegExp(`^${TIME}\\s+(.*?\\S)\\s*${ARROW}\\s*${TIME}\\s+(.*\\S)`);
  const codes = new RegExp(`^(.*?\\([A-Z]{3}\\))\\s*${ARROW}\\s*(.*?\\([A-Z]{3}\\))`);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const num = line.match(NUMBER)?.[1] ?? '';
    const body = num ? line.replace(NUMBER, '') : line;
    let m = body.match(after);
    if (m) { out.push({ from: m[1], to: m[4], dep: hhmm(m[2], m[3]), arr: hhmm(m[5], m[6]), number: num, line: i, iata: /\([A-Z]{3}\)/.test(line) }); return; }
    m = body.match(before);
    if (m) { out.push({ from: m[3], to: m[6], dep: hhmm(m[1], m[2]), arr: hhmm(m[4], m[5]), number: num, line: i, iata: /\([A-Z]{3}\)/.test(line) }); return; }
    m = body.match(codes);
    if (m) {
      // Horaires sur les lignes suivantes (« Départ 06:15 · Arrivée 09:05 »).
      const times = [...lines.slice(i, i + 3).join(' ').matchAll(new RegExp(TIME, 'g'))].map((t) => hhmm(t[1], t[2]));
      out.push({ from: m[1], to: m[2].replace(/\s+[—–-]\s+.*$/, ''), dep: times[0] ?? '', arr: times[1] ?? '', number: num, line: i + 2, iata: true });
    }
  });
  return out;
}

const KIND_WORDS: [BookingKind, RegExp][] = [
  ['train', /\b(sncf|tgv|ouigo|inoui|intercit[ée]s|eurostar|thalys|trenitalia|frecciarossa|renfe|deutsche bahn|train|gare)\b/i],
  ['vol', /\b(vol|flight|embarquement|boarding|a[ée]roport|airport|airlines?|compagnie a[ée]rienne)\b/i],
  ['hebergement', /\b(h[oô]tel|hostel|auberge|airbnb|booking\.com|check-in|logement|appartement|apartment|chambre|s[ée]jour|nuits?|nights?)\b/i],
  ['activite', /\b(billet d'entr[ée]e|entr[ée]e|admission|visite|mus[ée]e|museum|spectacle|concert|excursion|tour)\b/i],
];
const kindOf = (text: string): BookingKind => KIND_WORDS.find(([, re]) => re.test(text))?.[0] ?? 'autre';

/** Réservations trouvées dans l'e-mail (une par trajet pour un aller-retour) ; vide si rien n'est reconnu. */
export function parseBookingEmail(text: string, today: string): BookingDraft[] {
  const src = text.replace(/\r/g, '').replace(/ /g, ' ').slice(0, 20000);
  if (!src.trim()) return [];
  const lines = src.split('\n');
  const offsets: number[] = []; let pos = 0;
  for (const l of lines) { offsets.push(pos); pos += l.length + 1; }
  const dates = findDates(src, today);
  const reference = findReference(src), url = findUrl(src);
  const base = { reference, url, start_time: '', notes: '' };

  const segments = findSegments(lines);
  if (segments.length) {
    const kind: BookingKind = segments.some((s) => s.iata) ? 'vol' : kindOf(src) === 'train' || /\b(tgv|ouigo|sncf|train)\b/i.test(src) ? 'train' : 'vol';
    return segments.map((s, k) => {
      const end = offsets[Math.min(s.line, lines.length - 1)] + (lines[Math.min(s.line, lines.length - 1)]?.length ?? 0);
      const date = [...dates].reverse().find((d) => d.at <= end) ?? dates.find((d) => d.at > end);
      const notes = [s.number.toUpperCase().replace(/\s+/g, ' '), s.arr ? `arrivée ${s.arr}` : ''].filter(Boolean).join(' · ');
      return { ...base, kind, title: `${kind === 'vol' ? 'Vol' : 'Train'} ${clean(s.from)} → ${clean(s.to)}`.slice(0, 120), starts_on: date?.iso ?? '', start_time: s.dep, notes, url: k === 0 ? url : '' };
    });
  }

  const kind = kindOf(src);
  if (kind === 'hebergement') {
    const name = src.match(/^[^\n]*\b(h[oô]tel|hostel|auberge|r[ée]sidence|appartement|apartment|villa|maison|studio|guesthouse|b&b|logement)\b[^\n]*$/im)?.[0] ?? '';
    const label = (re: RegExp) => { const m = re.exec(plain(src)); return m ? dates.find((d) => d.at >= m.index) : undefined; };
    const inDate = label(/\b(arrivee|check-in|check in|du)\b/) ?? dates[0];
    const outDate = label(/\b(depart|check-out|check out|au|until)\b/);
    const inLine = inDate ? src.slice(inDate.at, src.indexOf('\n', inDate.at) < 0 ? undefined : src.indexOf('\n', inDate.at)) : '';
    const time = inLine.match(new RegExp(TIME));
    const title = clean(name.replace(/^(votre|your)\s+/i, '')).slice(0, 120) || 'Hébergement';
    if (!inDate && !reference) return [];
    return [{ ...base, kind, title, starts_on: inDate?.iso ?? '', start_time: time ? hhmm(time[1], time[2]) : '', notes: outDate && outDate !== inDate ? `Départ le ${outDate.iso.split('-').reverse().join('/')}` : '' }];
  }
  if (!reference && !dates.length) return [];
  const first = dates[0];
  const line = first ? src.slice(first.at, (src.indexOf('\n', first.at) + 1 || src.length + 1) - 1) : '';
  const time = line.match(new RegExp(TIME));
  const title = clean(lines.find((l) => KIND_WORDS.find(([k]) => k === kind)?.[1].test(l)) ?? lines.find((l) => l.trim()) ?? '').slice(0, 120) || 'Réservation';
  return [{ ...base, kind, title, starts_on: first?.iso ?? '', start_time: time ? hhmm(time[1], time[2]) : '' }];
}

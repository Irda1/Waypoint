// Réservations d'un voyage (vols, trains, hébergements, billets) : types, tri et contrôle de saisie.

export type BookingKind = 'vol' | 'train' | 'hebergement' | 'activite' | 'autre';

export const BOOKING_KINDS: readonly { kind: BookingKind; label: string; icon: 'plane' | 'train' | 'bed' | 'ticket' | 'pin' }[] = [
  { kind: 'vol', label: 'Vol', icon: 'plane' },
  { kind: 'train', label: 'Train', icon: 'train' },
  { kind: 'hebergement', label: 'Hébergement', icon: 'bed' },
  { kind: 'activite', label: 'Activité', icon: 'ticket' },
  { kind: 'autre', label: 'Autre', icon: 'pin' },
];

export interface Booking {
  id: string;
  kind: BookingKind;
  title: string;
  reference: string | null;
  starts_on: string | null;
  start_time: string | null;
  url: string | null;
  notes: string | null;
}

export interface BookingDraft { kind: BookingKind; title: string; reference: string; starts_on: string; start_time: string; url: string; notes: string }

export const emptyDraft = (): BookingDraft => ({ kind: 'vol', title: '', reference: '', starts_on: '', start_time: '', url: '', notes: '' });

/** Date d'abord (sans date en dernier), puis heure, puis titre. */
export function sortBookings(list: Booking[]): Booking[] {
  return [...list].sort((a, b) =>
    (a.starts_on ?? '9999').localeCompare(b.starts_on ?? '9999')
    || (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99')
    || a.title.localeCompare(b.title, 'fr'));
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Renvoie un message d'erreur lisible, ou null si la saisie est valide. */
export function validateDraft(d: BookingDraft): string | null {
  if (!d.title.trim()) return 'Donne un titre (ex. « Vol Paris → Lisbonne »).';
  if (d.starts_on.trim() && !isDate(d.starts_on.trim())) return 'Date au format AAAA-MM-JJ (ex. 2026-10-30).';
  if (d.start_time.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start_time.trim())) return 'Heure au format HH:MM (ex. 14:35).';
  if (d.url.trim() && !/^https?:\/\/\S+$/i.test(d.url.trim())) return 'Le lien doit commencer par http:// ou https://.';
  return null;
}

/** Valeurs prêtes pour la base : champs vides → null. */
export function draftToRow(d: BookingDraft) {
  const n = (s: string) => (s.trim() ? s.trim() : null);
  return { kind: d.kind, title: d.title.trim(), reference: n(d.reference), starts_on: n(d.starts_on), start_time: n(d.start_time), url: n(d.url), notes: n(d.notes) };
}

// ---------------------------------------------------------------- Billets joints (migration 2800)

export const FILE_TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_FILES = 5;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Type de fichier accepté (le nom sert quand le téléphone ne donne pas le type) ; null sinon. */
export function fileType(name: string, mime: string | null | undefined): string | null {
  if (mime && FILE_TYPES[mime]) return mime;
  if (mime === 'image/jpg') return 'image/jpeg';
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return Object.keys(FILE_TYPES).find((m) => FILE_TYPES[m] === ext || (ext === 'jpeg' && m === 'image/jpeg')) ?? null;
}

/** Raison du refus d'un fichier, ou null s'il peut être joint. */
export function checkFile(name: string, mime: string | null | undefined, size: number | null | undefined, count: number): string | null {
  if (count >= MAX_FILES) return `Au plus ${MAX_FILES} fichiers par réservation.`;
  if (!fileType(name, mime)) return 'Format non pris en charge : PDF, JPEG, PNG ou WebP.';
  if (size && size > MAX_FILE_SIZE) return 'Fichier trop lourd : 10 Mo au plus.';
  return null;
}

export function fileSize(bytes: number | null): string {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

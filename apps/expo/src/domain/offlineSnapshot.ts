// Copie d'un voyage gardée sur l'appareil pour le consulter sans réseau.
// Les `Map` ne passent pas en JSON : on les convertit en listes à l'enregistrement et on les rétablit à la lecture.

const VERSION = 1;

export interface Snapshot<T> { v: number; savedAt: number; data: T }

/** Transforme un objet contenant des Map en texte JSON. */
export function encodeSnapshot<T>(data: T, now: number = Date.now()): string {
  return JSON.stringify({ v: VERSION, savedAt: now, data }, (_k, value) => (value instanceof Map ? { __map: [...value.entries()] } : value));
}

/** Relit une copie ; `null` si elle est absente, abîmée ou d'une autre version. */
export function decodeSnapshot<T>(raw: string | null): Snapshot<T> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw, (_k, value) => (value && typeof value === 'object' && Array.isArray((value as { __map?: unknown }).__map) ? new Map((value as { __map: [unknown, unknown][] }).__map) : value)) as Snapshot<T>;
    if (parsed?.v !== VERSION || typeof parsed.savedAt !== 'number' || parsed.data == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

const FR_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « le 30 sept. à 18:05 » (heure locale). */
export function savedLabel(savedAt: number): string {
  const d = new Date(savedAt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `le ${d.getDate()} ${FR_MONTHS[d.getMonth()]} à ${hh}:${mm}`;
}

// Réglages d'apparence : fichier pur (testable avec Node). Le stockage est dans store.ts.
import type { AccentName, Mode } from './tokens.ts';

export type ModePref = 'auto' | 'nuit' | 'jour';
export interface Appearance { mode: ModePref; accent: AccentName }

export const DEFAULT_APPEARANCE: Appearance = { mode: 'auto', accent: 'soleil' };
export const ACCENTS: AccentName[] = ['soleil', 'turquoise', 'corail', 'lavande'];
export const MODES: ModePref[] = ['auto', 'nuit', 'jour'];

/** « Auto » suit le téléphone ; sans information du téléphone, on reste en nuit. */
export function resolveMode(pref: ModePref, scheme: string | null | undefined): Mode {
  if (pref === 'nuit' || pref === 'jour') return pref;
  return scheme === 'light' ? 'jour' : 'nuit';
}

/** Relit un réglage enregistré ; toute valeur inconnue retombe sur le défaut. */
export function parseAppearance(raw: string | null | undefined): Appearance {
  if (!raw) return DEFAULT_APPEARANCE;
  try {
    const v = JSON.parse(raw) as Partial<Appearance>;
    return {
      mode: MODES.includes(v.mode as ModePref) ? (v.mode as ModePref) : DEFAULT_APPEARANCE.mode,
      accent: ACCENTS.includes(v.accent as AccentName) ? (v.accent as AccentName) : DEFAULT_APPEARANCE.accent,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

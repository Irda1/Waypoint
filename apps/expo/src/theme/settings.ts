// Réglages d'apparence : fichier pur (testable avec Node). Le stockage est dans store.ts.
import type { AccentName, Mode } from './tokens.ts';

export type ModePref = 'auto' | 'nuit' | 'jour';
export type IconStyle = 'couleur' | 'trait' | 'plein';
export interface Appearance { mode: ModePref; accent: AccentName; icons: IconStyle }

export const DEFAULT_APPEARANCE: Appearance = { mode: 'auto', accent: 'soleil', icons: 'couleur' };
export const ACCENTS: AccentName[] = ['soleil', 'turquoise', 'corail', 'lavande'];
export const ICON_STYLES: IconStyle[] = ['couleur', 'trait', 'plein'];
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
      icons: ICON_STYLES.includes(v.icons as IconStyle) ? (v.icons as IconStyle) : DEFAULT_APPEARANCE.icons,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

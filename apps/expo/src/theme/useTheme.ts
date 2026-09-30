import { useColorScheme } from 'react-native';
import { palette } from './tokens';
import type { AccentName, Palette } from './tokens';
import { resolveMode } from './settings';
import { useAppearance } from './store';

/** Palette selon le réglage de l'utilisateur (Auto = mode du téléphone) et son accent. */
export function useTheme(accent?: AccentName): { colors: Palette; mode: 'nuit' | 'jour' } {
  const scheme = useColorScheme();
  const pref = useAppearance();
  const mode = resolveMode(pref.mode, scheme);
  return { colors: palette(mode, accent ?? pref.accent), mode };
}

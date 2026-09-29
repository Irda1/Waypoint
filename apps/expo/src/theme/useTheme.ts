import { useColorScheme } from 'react-native';
import { palette } from './tokens';
import type { AccentName, Palette } from './tokens';

/** Palette selon le mode du téléphone (nuit / jour). Accent Soleil par défaut. */
export function useTheme(accent: AccentName = 'soleil'): { colors: Palette; mode: 'nuit' | 'jour' } {
  const scheme = useColorScheme();
  const mode = scheme === 'light' ? 'jour' : 'nuit';
  return { colors: palette(mode, accent), mode };
}

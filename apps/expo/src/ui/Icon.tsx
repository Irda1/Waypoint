import React from 'react';
import { Platform, Text as RNText } from 'react-native';
import { useAppearance } from '../theme/store';
import { useTheme } from '../theme/useTheme';

// Icône d'interface selon le réglage « Style des icônes » : couleur (emoji d'origine),
// trait (contour fin) ou plein (silhouette à la couleur d'accent). Trait et plein passent par une
// ombre de texte : rendu fiable sur le web, l'emoji d'origine reste sur les téléphones qui ignorent la couleur.
export function Icon({ glyph, size = 20, onAccent = false }: { glyph: string; size?: number; onAccent?: boolean }) {
  const { icons } = useAppearance();
  const { colors } = useTheme();
  const tint = onAccent ? colors.onAccent : colors.accent;
  const base = { fontSize: size } as const;
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no' as const };
  if (icons === 'couleur' || Platform.OS !== 'web') return <RNText style={base} {...hidden}>{glyph}</RNText>;
  if (icons === 'plein') {
    return <RNText style={[base, { color: 'transparent', textShadowColor: tint, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0.6 }]} {...hidden}>{glyph}</RNText>;
  }
  return <RNText style={[base, { color: 'transparent', opacity: 0.6, textShadowColor: tint, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 }]} {...hidden}>{glyph}</RNText>;
}

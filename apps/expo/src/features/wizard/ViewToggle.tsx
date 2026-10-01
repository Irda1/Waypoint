import React from 'react';
import { Pressable, Text as RNText } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fonts } from '../../theme/tokens';

/** Petit bouton carré, en haut à droite d'une vue : bascule entre la vue 3D / carte et la liste. */
export function ViewToggle({ showing, onPress, listLabel, backLabel, backIcon }: { showing: 'visual' | 'list'; onPress: () => void; listLabel: string; backLabel: string; backIcon: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={showing === 'visual' ? listLabel : backLabel} onPress={onPress}
      style={{ position: 'absolute', top: 10, right: 10, width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', zIndex: 10 }}>
      <RNText style={{ fontFamily: fonts.sansBold, fontSize: 22, lineHeight: 26, color: showing === 'visual' ? '#FFFFFF' : colors.accent }}>{showing === 'visual' ? '☰' : backIcon}</RNText>
    </Pressable>
  );
}

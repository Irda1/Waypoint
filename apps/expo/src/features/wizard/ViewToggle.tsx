import React from 'react';
import { Pressable, Text as RNText } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fonts } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';

/** Petit bouton carré, en haut à droite d'une vue : bascule entre la vue 3D / carte et la liste. */
export function ViewToggle({ showing, onPress, listLabel, backLabel, backIcon, inline }: { inline?: boolean; showing: 'visual' | 'list'; onPress: () => void; listLabel: string; backLabel: string; backIcon: IconName }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={showing === 'visual' ? listLabel : backLabel} onPress={onPress}
      style={{ ...(inline ? {} : { position: 'absolute' as const, top: 10, right: 10 }), width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', zIndex: 10 }}>
      <Icon name={showing === 'visual' ? 'list' : backIcon} size={22} color={showing === 'visual' ? '#FFFFFF' : colors.accent} />
    </Pressable>
  );
}

import React from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/useTheme';

/** Bouton rond « Paramètres » en haut des écrans de voyage (sur une photo : fond sombre translucide). */
export function SettingsButton({ glass }: { glass?: { bg: string; line: string; text: string } }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Paramètres" hitSlop={4} onPress={() => router.push('/settings')}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, opacity: pressed ? 0.7 : 1,
        backgroundColor: glass?.bg ?? colors.surface, borderColor: glass?.line ?? colors.line })}>
      <Icon name="settings" size={18} color={glass?.text ?? colors.text} />
    </Pressable>
  );
}

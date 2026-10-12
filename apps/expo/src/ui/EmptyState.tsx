import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Button } from './index';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { fonts, radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/**
 * Écran vide illustré : un dessin simple (cercles, chemin en pointillés et icône, aux couleurs de l'appli),
 * une phrase qui dit quoi faire, et le bouton qui le fait.
 */
export function EmptyState({ icon, title, text, action, link }: {
  icon: IconName; title: string; text: string;
  action?: { label: string; onPress: () => void }; link?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: radius.card, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, backgroundColor: colors.surface, paddingVertical: space.xl, paddingHorizontal: space.lg, gap: space.sm, alignItems: 'center' }}>
      <View accessible={false} style={{ width: 150, height: 112, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 104, height: 104, borderRadius: 52, backgroundColor: colors.surface2 }} />
        <View style={{ position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: `${colors.accent}2E` }} />
        <View style={{ position: 'absolute', bottom: 6, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
          {Array.from({ length: 12 }, (_, i) => <View key={i} style={{ width: 5, height: 2, borderRadius: 1, backgroundColor: colors.accent, opacity: 0.6, transform: [{ translateY: Math.sin(i / 1.8) * 4 }] }} />)}
        </View>
        <Icon name={icon} size={34} />
      </View>
      <RNText style={{ fontFamily: fonts.serif, fontSize: 19, color: colors.text, textAlign: 'center' }}>{title}</RNText>
      <RNText style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.text2, textAlign: 'center', maxWidth: 320 }}>{text}</RNText>
      {action ? <View style={{ marginTop: space.xs }}><Button label={action.label} onPress={action.onPress} /></View> : null}
      {link ? (
        <Pressable accessibilityRole="button" onPress={link.onPress} hitSlop={6} style={{ minHeight: 40, justifyContent: 'center' }}>
          <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.accent }}>{link.label}</RNText>
        </Pressable>
      ) : null}
    </View>
  );
}

import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';

export type TripMode = 'complet' | 'simple';

const MODES: { key: TripMode; icon: IconName; title: string; text: string }[] = [
  { key: 'complet', icon: 'trip', title: 'Voyage complet', text: 'Dates, programme jour par jour, budget, partage des dépenses entre amis.' },
  { key: 'simple', icon: 'places', title: 'Juste les lieux', text: 'Choisis un ou plusieurs pays et des villes, retrouve leurs lieux sur une liste et une carte, garde tes préférés.' },
];

/** Premier écran de « Nouveau voyage » : organiser tout le voyage, ou seulement repérer des lieux. */
export function ModeChoice({ onPick }: { onPick: (m: TripMode) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bg }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', paddingHorizontal: space.lg }}>
          <Icon name="close" size={24} tone="text" />
        </Pressable>
      </SafeAreaView>
      <View style={{ padding: space.lg, gap: space.md, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        <Text variant="heading" accessibilityRole="header">Que veux-tu faire ?</Text>
        {MODES.map((m) => (
          <Pressable key={m.key} accessibilityRole="button" accessibilityLabel={`${m.title}. ${m.text}`} onPress={() => onPick(m.key)}
            style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name={m.icon} size={26} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <RNText style={{ fontFamily: fonts.sansBold, fontSize: 17, color: colors.text }}>{m.title}</RNText>
              <Text variant="muted">{m.text}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';

export interface StepProps<S> { state: S; update: (next: S) => void }

/** Ligne de choix : titre, détail, coche à droite. */
export function Choice({ title, detail, selected, onPress, right, lead }: { title: string; detail?: string; selected?: boolean; onPress: () => void; right?: React.ReactNode; lead?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={detail ? `${title}. ${detail}` : title} onPress={onPress}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.field, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.line, backgroundColor: colors.surface }}>
      {lead}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{title}</Text>
        {detail ? <Text variant="muted">{detail}</Text> : null}
      </View>
      {right}
      {selected ? <RNText style={{ color: colors.accent, fontFamily: fonts.sansBold, fontSize: 18 }}>✓</RNText> : null}
    </Pressable>
  );
}

/** Petit bouton rond + / −. */
export function RoundButton({ label, onPress, disabled, name }: { label: string; onPress: () => void; disabled?: boolean; name: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={name} disabled={disabled} onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, opacity: disabled ? 0.4 : 1 }}>
      <RNText style={{ fontFamily: fonts.sansBold, fontSize: 20, color: colors.text }}>{label}</RNText>
    </Pressable>
  );
}

export function StepTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="heading" accessibilityRole="header">{title}</Text>
      {hint ? <Text variant="muted">{hint}</Text> : null}
    </View>
  );
}

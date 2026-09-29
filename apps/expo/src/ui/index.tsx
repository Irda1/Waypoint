// Composants communs : mêmes écrans sur téléphone, tablette et web, mise en page adaptée à la largeur.
import React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { useBreakpoint } from './useBreakpoint';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const { colors } = useTheme();
  const { breakpoint } = useBreakpoint();
  const inner = { width: '100%' as const, maxWidth: breakpoint === 'phone' ? undefined : 880, alignSelf: 'center' as const, padding: breakpoint === 'phone' ? space.lg : space.xl, gap: space.lg };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled">{children}</ScrollView> : <View style={[inner, { flex: 1 }]}>{children}</View>}
    </SafeAreaView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'label' | 'mono';
export function Text({ variant = 'body', style, children, ...rest }: { variant?: Variant; style?: StyleProp<TextStyle>; children?: React.ReactNode } & React.ComponentProps<typeof RNText>) {
  const { colors } = useTheme();
  const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, Consolas, monospace' });
  const variants: Record<Variant, TextStyle> = {
    title: { fontFamily: fonts.serif, fontSize: 32, color: colors.text, lineHeight: 38 },
    heading: { fontFamily: fonts.serif, fontSize: 20, color: colors.text, lineHeight: 26 },
    body: { fontFamily: fonts.sans, fontSize: 16, color: colors.text, lineHeight: 23 },
    muted: { fontFamily: fonts.sans, fontSize: 14, color: colors.text2, lineHeight: 20 },
    label: { fontFamily: fonts.sansSemi, fontSize: 11.5, color: colors.text3, letterSpacing: 1.6, textTransform: 'uppercase' },
    mono: { fontFamily: mono, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  };
  return <RNText style={[variants[variant], style]} {...rest}>{children}</RNText>;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading }: { label: string; onPress: () => void; variant?: 'primary' | 'ghost'; disabled?: boolean; loading?: boolean }) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48, paddingHorizontal: space.xl, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm,
        backgroundColor: primary ? colors.accent : 'transparent', borderWidth: primary ? 0 : 1, borderColor: colors.lineStrong,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={primary ? colors.onAccent : colors.text} /> : null}
      <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 16, color: primary ? colors.onAccent : colors.text }}>{label}</RNText>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: space.lg, gap: space.md }, style]}>{children}</View>;
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}
      style={{ minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: selected ? colors.accent : colors.surface2 }}>
      <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: selected ? colors.onAccent : colors.text }}>{label}</RNText>
    </Pressable>
  );
}

export function Field({ label, style, ...rest }: { label: string } & TextInputProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.text3}
        style={[{ minHeight: 48, borderRadius: radius.field, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface2, paddingHorizontal: space.lg, fontFamily: fonts.sans, fontSize: 16, color: colors.text }, style]}
        {...rest}
      />
    </View>
  );
}

/** Grille : 1 colonne sur téléphone, 2 sur tablette, 3 sur grand écran. */
export function Columns({ children }: { children: React.ReactNode }) {
  const { columns } = useBreakpoint();
  const items = React.Children.toArray(children);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
      {items.map((child, i) => <View key={i} style={{ flexGrow: 1, flexBasis: columns === 1 ? '100%' : columns === 2 ? '47%' : '30%' }}>{child}</View>)}
    </View>
  );
}

/** Pastille de paiement : dollar plein vert = payé, contour vert = acompte, gris = pas encore payé. */
export function PayBadge({ state }: { state: 'paid' | 'partial' | 'unpaid' | null }) {
  const { colors } = useTheme();
  if (!state) return null;
  const label = state === 'paid' ? 'Payé' : state === 'partial' ? 'Acompte versé' : 'Pas encore payé';
  const filled = state === 'paid';
  const color = state === 'unpaid' ? colors.text3 : colors.paid;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}
      style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? colors.paid : 'transparent', borderWidth: filled ? 0 : 1.5, borderColor: color }}>
      <RNText style={{ fontFamily: fonts.sansBold, fontSize: 13, color: filled ? colors.onPaid : color }}>$</RNText>
    </View>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  const { colors } = useTheme();
  if (!message) return null;
  return <Text variant="muted" style={{ color: colors.danger }} accessibilityRole="alert">{message}</Text>;
}

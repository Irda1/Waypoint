import React from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export interface NavTab { key: string; label: string; icon: string }

interface Props {
  tabs: NavTab[];
  active: string;
  onSelect: (key: string) => void;
}

// Barre flottante du bas (maquette V5) : icônes seules, l'onglet actif s'élargit et affiche son nom.
export function FloatingNav({ tabs, active, onSelect }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={styles.wrap}>
      <View accessibilityRole="tablist" accessibilityLabel="Navigation principale" style={[styles.bar, { backgroundColor: 'rgba(16, 19, 22, 0.86)', borderColor: 'rgba(255, 255, 255, 0.14)' }]}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Pressable key={t.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }} onPress={() => onSelect(t.key)}
              style={[styles.tab, on && { backgroundColor: colors.accent, paddingHorizontal: 16 }]}>
              <RNText style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">{t.icon}</RNText>
              {on ? <RNText style={[styles.label, { color: colors.onAccent }]}>{t.label}</RNText> : null}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingBottom: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2, width: '92%', maxWidth: 440, padding: 6, borderRadius: radius.pill, borderWidth: 1 },
  tab: { minHeight: 48, minWidth: 48, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  icon: { fontSize: 20 },
  label: { fontFamily: fonts.sansBold, fontSize: 14.5 },
});

import React from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, radius } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/useTheme';

/** Marge basse de sécurité, plafonnée : certains téléphones (Galaxy récents) annoncent une marge énorme et la barre flottait au milieu de l'écran. */
export function useBottomInset(): number {
  return Math.min(useSafeAreaInsets().bottom, 40);
}
/** Hauteur de la barre flottante + son espacement : sert à poser le bouton « + » juste au-dessus. */
export const NAV_HEIGHT = 62 + 12;

export interface NavTab { key: string; label: string; icon: string }

interface Props {
  tabs: NavTab[];
  active: string;
  onSelect: (key: string) => void;
}

// Barre flottante du bas (maquette V5) : icônes seules, l'onglet actif s'élargit et affiche son nom.
export function FloatingNav({ tabs, active, onSelect }: Props) {
  const { colors } = useTheme();
  const inset = useBottomInset();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: 12 + inset }]}>
      <View accessibilityRole="tablist" accessibilityLabel="Navigation principale" style={[styles.bar, { backgroundColor: 'rgba(16, 19, 22, 0.86)', borderColor: 'rgba(255, 255, 255, 0.14)' }]}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Pressable key={t.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }} onPress={() => onSelect(t.key)}
              style={[styles.tab, on && { backgroundColor: colors.accent, paddingHorizontal: 12 }]}>
              <Icon glyph={t.icon} size={20} onAccent={on} />
              {on ? <RNText style={[styles.label, { color: colors.onAccent }]}>{t.label}</RNText> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '94%', maxWidth: 440, padding: 6, borderRadius: radius.pill, borderWidth: 1 },
  tab: { minHeight: 46, minWidth: 44, flexShrink: 1, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontFamily: fonts.sansBold, fontSize: 13.5 },
});

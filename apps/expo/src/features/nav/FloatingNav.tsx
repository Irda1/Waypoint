import React from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, radius } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';
import { useTheme } from '../../theme/useTheme';

/** Marge basse de sécurité, plafonnée : certains téléphones (Galaxy récents) annoncent une marge énorme et la barre flottait au milieu de l'écran. */
export function useBottomInset(): number {
  return Math.min(useSafeAreaInsets().bottom, 40);
}
/** Hauteur de la barre flottante + son espacement : sert à poser le bouton « + » juste au-dessus. */
export const NAV_HEIGHT = 64 + 12;

export interface NavTab { key: string; label: string; icon: IconName }

interface Props {
  tabs: NavTab[];
  active: string;
  onSelect: (key: string) => void;
}

// Barre flottante du bas : chaque onglet garde son icône et son nom (on sait où aller sans deviner) ;
// l'onglet actif porte une pastille d'accent derrière l'icône. Fond opaque aux couleurs du thème (Jour ou Nuit).
export function FloatingNav({ tabs, active, onSelect }: Props) {
  const { colors } = useTheme();
  const inset = useBottomInset();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: 12 + inset }]}>
      <View accessibilityRole="tablist" accessibilityLabel="Navigation principale"
        style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.lineStrong, shadowColor: '#000' }]}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Pressable key={t.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }} onPress={() => onSelect(t.key)}
              style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}>
              <View style={[styles.pill, on && { backgroundColor: colors.accent }]}>
                <Icon name={t.icon} size={20} tone={on ? 'onAccent' : 'muted'} filled={on} />
              </View>
              <RNText numberOfLines={1} style={[styles.label, { color: on ? colors.text : colors.text3, fontFamily: on ? fonts.sansBold : fonts.sansMedium }]}>{t.label}</RNText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', width: '94%', maxWidth: 480, height: 64, paddingHorizontal: 4, borderRadius: 24, borderWidth: 1, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pill: { width: 44, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11.5 },
});

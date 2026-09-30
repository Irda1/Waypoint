import React from 'react';
import { Modal, Pressable, Text as RNText, View } from 'react-native';
import { Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';

export type PlusChoice = 'activite' | 'depense' | 'memo';

const CHOICES: { key: PlusChoice; icon: string; title: string; hint: string }[] = [
  { key: 'activite', icon: '📍', title: 'Une activité', hint: 'Ajouter une étape à la journée en cours' },
  { key: 'depense', icon: '💶', title: 'Une dépense', hint: 'Partagée entre les voyageurs' },
  { key: 'memo', icon: '📝', title: 'Une note', hint: 'Dans le mémo du voyage' },
];

// Menu « + Ajouter » (maquette v0.8) : les trois ajouts les plus fréquents, depuis n'importe quel onglet.
export function PlusMenu({ visible, onPick, onClose }: { visible: boolean; onPick: (c: PlusChoice) => void; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fermer le menu" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(3, 5, 6, 0.6)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 560, alignSelf: 'center', padding: space.xl, gap: space.sm }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: space.sm }} />
          <Text variant="heading" accessibilityRole="header">Ajouter…</Text>
          {CHOICES.map((c) => (
            <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={`Ajouter ${c.title.toLowerCase()}`} onPress={() => onPick(c.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.line }}>
              <RNText style={{ fontSize: 26 }} accessibilityElementsHidden importantForAccessibility="no">{c.icon}</RNText>
              <View style={{ flex: 1, gap: 2 }}>
                <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 16, color: colors.text }}>{c.title}</RNText>
                <Text variant="muted">{c.hint}</Text>
              </View>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

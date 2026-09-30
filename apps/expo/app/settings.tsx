import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { useRequireAuth } from '../src/auth/useRequireAuth';
import { Button, Card, Chip, Screen, Text } from '../src/ui';
import { ACCENTS } from '../src/theme/settings';
import type { ModePref } from '../src/theme/settings';
import { setAppearance, useAppearance } from '../src/theme/store';
import { palette } from '../src/theme/tokens';
import type { AccentName } from '../src/theme/tokens';
import { fonts, space } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';

const MODE_LABELS: Record<ModePref, string> = { auto: 'Auto', nuit: 'Nuit', jour: 'Jour' };
const ACCENT_LABELS: Record<AccentName, string> = { soleil: 'Soleil', turquoise: 'Turquoise', corail: 'Corail', lavande: 'Lavande' };

export default function Settings() {
  const guard = useRequireAuth();
  const { session, signOut } = useAuth();
  const { colors, mode } = useTheme();
  const pref = useAppearance();
  if (guard) return guard;

  return (
    <Screen>
      <Button label="← Retour" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Text variant="title" accessibilityRole="header">Paramètres</Text>

      <Card>
        <Text variant="label">Apparence</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
          {(Object.keys(MODE_LABELS) as ModePref[]).map((m) => (
            <Chip key={m} label={MODE_LABELS[m]} selected={pref.mode === m} onPress={() => setAppearance({ mode: m })} />
          ))}
        </View>
        <Text variant="muted">Auto suit le réglage de ton téléphone.</Text>
      </Card>

      <Card>
        <Text variant="label">Couleur d'accent</Text>
        <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }} accessibilityRole="radiogroup">
          {ACCENTS.map((a) => {
            const on = pref.accent === a;
            return (
              <Pressable key={a} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={ACCENT_LABELS[a]} onPress={() => setAppearance({ accent: a })}
                style={{ alignItems: 'center', gap: space.xs, minWidth: 64 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette(mode, a).accent, borderWidth: on ? 3 : 1, borderColor: on ? colors.text : colors.lineStrong }} />
                <RNText style={{ fontFamily: on ? fonts.sansSemi : fonts.sans, fontSize: 13, color: on ? colors.text : colors.text2 }}>{ACCENT_LABELS[a]}</RNText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="label">Compte</Text>
        <Text variant="body">{session?.user.email ?? ''}</Text>
        <Button label="Se déconnecter" variant="ghost" onPress={signOut} />
      </Card>
    </Screen>
  );
}

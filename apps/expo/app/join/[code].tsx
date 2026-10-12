import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useRequireAuth } from '../../src/auth/useRequireAuth';
import { Text as RNText, View } from 'react-native';
import { Button, Card, ErrorNote, Screen, Text } from '../../src/ui';
import { Globe } from '../../src/features/globe/Globe';
import { ROUTE_BG } from '../../src/domain/routeGlobe.ts';
import { formatDay } from '../../src/lib/format';
import { Icon } from '../../src/ui/Icon';
import { fonts, palette, radius, space } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';
import { joinTrip, previewInvite } from '../../src/data/trips';
import type { InvitePreview } from '../../src/data/trips';

export default function JoinTrip() {
  const guard = useRequireAuth();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    if (guard) return;
    void previewInvite(String(code)).then((res) => { setPreview(res.preview); setError(res.error); });
  }, [guard, code]);

  if (guard) return guard;

  async function join() {
    setBusy(true);
    const res = await joinTrip(String(code));
    setBusy(false);
    if (res.error || !res.tripId) { setError(res.error ?? 'Impossible de rejoindre ce voyage.'); return; }
    router.replace({ pathname: '/trip/[id]', params: { id: res.tripId } });
  }

  return (
    <Screen>
      <Text variant="label">Invitation</Text>
      {preview === undefined ? <Text variant="muted">Vérification de l'invitation…</Text> : preview === null ? (
        <Card><Text variant="body">Cette invitation est invalide, expirée ou révoquée. Demande un nouveau lien à ton ami.</Text></Card>
      ) : (
        <View style={{ borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ backgroundColor: ROUTE_BG.nuit, padding: space.lg, gap: 4 }}>
            <View style={{ height: 200, marginHorizontal: -space.lg, marginTop: -space.lg }} pointerEvents="none">
              <Globe mode="route" color={palette('nuit', 'soleil').accent.slice(1)} theme="nuit" />
            </View>
            <RNText style={{ fontFamily: fonts.sansBold, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase', color: palette('nuit', 'soleil').accent }}>Tu es invité·e</RNText>
            <RNText style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, color: '#F4EFE6' }} accessibilityRole="header">{preview.title}</RNText>
            {preview.starts_on ? <RNText style={{ fontFamily: fonts.sans, fontSize: 14, color: '#B3B9BB' }}>{formatDay(preview.starts_on)}{preview.ends_on ? ` → ${formatDay(preview.ends_on)}` : ''}</RNText> : null}
          </View>
          <View style={{ padding: space.lg, gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Icon name="friends" size={18} tone="muted" />
              <Text variant="muted">{preview.member_count} voyageur{preview.member_count > 1 ? 's' : ''} déjà dans ce voyage</Text>
            </View>
            {['Voir et modifier le programme', 'Ajouter des dépenses partagées', 'Chacun a les mêmes droits, sans rôle particulier'].map((t) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Icon name="check" size={16} />
                <Text variant="body" style={{ flex: 1 }}>{t}</Text>
              </View>
            ))}
            <Button label="Rejoindre le voyage" onPress={join} loading={busy} />
          </View>
        </View>
      )}
      <ErrorNote message={error} />
      <Button label="Mes voyages" variant="ghost" onPress={() => router.replace('/')} />
    </Screen>
  );
}

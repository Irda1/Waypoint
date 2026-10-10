import React from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import type { TripData } from '../../data/useTrip';
import { budgetSummary } from '../../domain/budget.ts';
import { POSTES } from '../../domain/types.ts';
import type { Poste } from '../../domain/types.ts';
import { formatMoney, tripStatusLabel } from '../../lib/format';
import { todayIso, tripStatus } from '../../lib/dates';
import { useBreakpoint } from '../../ui/useBreakpoint';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';

type Tile = { key: string; icon: IconName; label: string; value: string; hint: string; onPress?: () => void };

/**
 * Résumé en tête de l'onglet Voyage : le départ, le parcours, le budget et les activités en un coup d'œil.
 * Chaque tuile mène à l'onglet qui détaille (Jour, Carte, Budget).
 */
export function TripSummary({ data, onOpen }: { data: TripData; onOpen: (tab: 'jour' | 'carte' | 'budget') => void }) {
  const { colors } = useTheme();
  const { breakpoint } = useBreakpoint();
  const { trip, members, expenses, items, places, budgetLines, destinations, days } = data;
  const travelers = Math.max(1, members.filter((m) => !m.left_at).length);
  const envelopes = Object.fromEntries(budgetLines.map((l) => [l.poste, Number(l.amount)])) as Partial<Record<Poste, number>>;
  const s = budgetSummary({ expenses, items, places, envelopes, travelers });
  const spent = POSTES.reduce((n, p) => n + s[p].paid + s[p].forecast, 0);
  const envelope = POSTES.reduce((n, p) => n + s[p].envelope, 0) || Number(trip.budget_total ?? 0);
  const nights = destinations.reduce((n, d) => n + d.nights, 0);
  const planned = items.length;
  const money = (n: number) => formatMoney(n, trip.currency);

  const tiles: Tile[] = [
    { key: 'when', icon: 'calendar', label: 'Départ', value: tripStatusLabel(tripStatus(trip.starts_on, trip.ends_on, todayIso())), hint: `${days.length} jour${days.length > 1 ? 's' : ''}`, onPress: () => onOpen('jour') },
    { key: 'route', icon: 'map', label: 'Parcours', value: `${destinations.length} ville${destinations.length > 1 ? 's' : ''}`, hint: nights ? `${nights} nuit${nights > 1 ? 's' : ''}` : 'Nuits à répartir', onPress: () => onOpen('carte') },
    { key: 'budget', icon: 'budget', label: 'Budget', value: envelope ? `${Math.round((spent / envelope) * 100)} %` : money(spent), hint: envelope ? `${money(spent)} sur ${money(envelope)}` : 'Aucun budget fixé', onPress: () => onOpen('budget') },
    { key: 'items', icon: 'places', label: 'Activités', value: String(planned), hint: planned ? 'au programme' : 'Rien de prévu', onPress: () => onOpen('jour') },
  ];
  const basis = breakpoint === 'phone' ? '47%' : '22%';
  return (
    <View style={styles.row} accessibilityLabel="Résumé du voyage">
      {tiles.map((t) => (
        <Pressable key={t.key} accessibilityRole="button" accessibilityLabel={`${t.label} : ${t.value}, ${t.hint}`} onPress={t.onPress}
          style={({ pressed }) => [styles.tile, { flexBasis: basis, backgroundColor: colors.surface, borderColor: colors.line, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <View style={styles.head}>
            <Icon name={t.icon} size={15} tone="muted" />
            <RNText style={[styles.label, { color: colors.text3 }]}>{t.label}</RNText>
          </View>
          <RNText style={[styles.value, { color: colors.text }]} numberOfLines={1}>{t.value}</RNText>
          <RNText style={[styles.hint, { color: colors.text2 }]} numberOfLines={1}>{t.hint}</RNText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, minHeight: 92, padding: space.md, borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  value: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
  hint: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
});

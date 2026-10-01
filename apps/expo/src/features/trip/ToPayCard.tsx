import React, { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Card, Chip, ErrorNote, Text } from '../../ui';
import { activityLines, posteForCategory } from '../../domain/budget.ts';
import { addExpense } from '../../data/trips';
import { useCategories } from '../../data/categories';
import type { TripData } from '../../data/useTrip';
import { formatMoney } from '../../lib/format';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';

/** Liste des activités du programme à payer ou réserver : un bouton « Payé » enregistre la dépense au montant estimé. */
export function ToPayCard({ data, userId, onChanged, embedded }: { data: TripData; userId: string; onChanged: () => void; embedded?: boolean }) {
  const { colors } = useTheme();
  const categories = useCategories();
  const members = data.members.filter((m) => !m.left_at);
  const travelers = Math.max(1, members.length);
  const [payer, setPayer] = useState(userId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currency = data.trip.currency;
  const lines = activityLines({ days: data.days, items: data.items, places: data.places, expenses: data.expenses, travelers });
  const toPay = lines.filter((l) => l.due > 0);
  const done = lines.filter((l) => l.due <= 0);
  const totalDue = toPay.reduce((n, l) => n + l.due, 0);
  if (toPay.length === 0) return embedded ? <Text variant="muted">Aucune activité à payer ou réserver pour l'instant.</Text> : null;

  async function pay(itemId: string, name: string, amount: number) {
    const item = data.items.find((i) => i.id === itemId);
    const place = item?.place_id != null ? data.places.get(item.place_id) : undefined;
    setBusyId(itemId);
    const err = await addExpense({ tripId: data.trip.id, label: name, poste: posteForCategory(categories.rootOf(place?.category_code ?? item?.category_code ?? '')), amount, currency, paidBy: payer, itemId });
    setBusyId(null);
    setError(err);
    if (!err) onChanged();
  }

  const Wrap = embedded ? (({ children }: { children: React.ReactNode }) => <View style={{ gap: space.sm }}>{children}</View>) : Card;
  return (
    <Wrap>
      <Text variant="heading">Activités à payer / réserver</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text variant="body">Reste à payer / réserver</Text><Text variant="mono" style={{ color: colors.warm }}>≈ {formatMoney(totalDue, currency)}</Text></View>
      <Text variant="muted">Prix d'entrée estimés pour {travelers > 1 ? `${travelers} voyageurs` : 'toi'}. « Payé » enregistre la dépense avec ce montant.</Text>
      {members.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
          <Text variant="label">Payé par</Text>
          {members.map((m) => <Chip key={m.user_id} label={m.user_id === userId ? 'Toi' : m.profiles?.display_name ?? 'Membre'} selected={payer === m.user_id} onPress={() => setPayer(m.user_id)} />)}
        </View>
      ) : null}
      {toPay.map((l) => (
        <View key={l.itemId} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 }}>
          <View style={{ flex: 1 }}>
            <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{l.name}</Text>
            <Text variant="muted">Jour {l.day}{l.paid > 0 ? ` · déjà ${formatMoney(l.paid, currency)}` : ''}</Text>
          </View>
          <Text variant="mono">≈ {formatMoney(l.due, currency)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Marquer ${l.name} comme payé`} disabled={busyId === l.itemId} onPress={() => pay(l.itemId, l.name, l.due)}
            style={{ minHeight: 44, minWidth: 64, paddingHorizontal: space.md, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accent, opacity: busyId === l.itemId ? 0.5 : 1 }}>
            <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.onAccent }}>Payé</RNText>
          </Pressable>
        </View>
      ))}
      {done.length ? <Text variant="label" style={{ marginTop: space.xs }}>Déjà payées</Text> : null}
      {done.map((l) => (
        <View key={l.itemId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
          <Text variant="body" style={{ flex: 1 }}>✓ {l.name}<Text variant="muted"> · J{l.day}</Text></Text>
          <Text variant="mono">{formatMoney(l.total, currency)}</Text>
        </View>
      ))}
      <ErrorNote message={error} />
    </Wrap>
  );
}

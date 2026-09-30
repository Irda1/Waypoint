import React, { useState } from 'react';
import { Share, View } from 'react-native';
import { Button, Card, ErrorNote, Text } from '../../ui';
import { fonts, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { formatMoney } from '../../lib/format';
import { applyPayments, computeBalances, settlements } from '../../domain/budget.ts';
import { markReceived } from '../../data/settlements';
import type { TripData } from '../../data/useTrip';

interface Props { data: TripData; userId: string; onChanged: () => void }

// Écran « Entre amis » (maquette V5) : ta situation en une phrase, qui a payé quoi, puis qui rembourse qui.
export function FriendsCard({ data, userId, onChanged }: Props) {
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { trip, members, expenses } = data;
  const active = members.filter((m) => !m.left_at);
  const nameOf = (id: string) => (id === userId ? 'Toi' : members.find((m) => m.user_id === id)?.profiles?.display_name ?? 'Ancien membre');
  const cur = trip.currency;

  const raw = computeBalances(expenses, active.map((m) => m.user_id));
  const balances = applyPayments(raw, data.payments ?? []);
  const transfers = settlements(balances);
  const mine = balances.find((b) => b.userId === userId)?.balance ?? 0;
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const headline = total === 0 ? 'Aucune dépense partagée pour l\'instant.'
    : Math.abs(mine) < 0.005 ? 'Tu es à l\'équilibre.'
    : mine > 0 ? `On te doit ${formatMoney(mine, cur)}.` : `Tu dois ${formatMoney(-mine, cur)}.`;

  async function received(t: { from: string; to: string; amount: number }, key: string) {
    setBusy(key);
    setError(await markReceived({ tripId: trip.id, from: t.from, to: t.to, amount: t.amount, currency: cur }));
    setBusy(null);
    onChanged();
  }
  async function remind(t: { from: string; amount: number }) {
    await Share.share({ message: `Coucou ${nameOf(t.from)}, pour « ${trip.title} » il me manque ${formatMoney(t.amount, cur)} à te faire rembourser. Merci !` });
  }

  return (
    <Card>
      <Text variant="label">Entre amis</Text>
      <Text variant="title" style={{ color: mine > 0.005 ? colors.accent : mine < -0.005 ? colors.warm : colors.text }}>{headline}</Text>

      {total > 0 ? (
        <View style={{ gap: space.xs, marginTop: space.sm }}>
          <Text variant="label">Qui a payé quoi</Text>
          {raw.map((b) => (
            <View key={b.userId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.xs }}>
              <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{nameOf(b.userId)}</Text>
              <Text variant="muted">a payé {formatMoney(b.paid, cur)} · sa part {formatMoney(b.share, cur)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Text variant="label">Pour être quittes</Text>
        {transfers.length === 0 ? <Text variant="muted">Tout le monde est à l'équilibre.</Text> : transfers.map((t) => {
          const key = `${t.from}>${t.to}`;
          return (
            <View key={key} style={{ gap: space.sm }}>
              <Text variant="body">{nameOf(t.from)} → {t.to === userId ? 'toi' : nameOf(t.to)} · <Text variant="mono">{formatMoney(t.amount, cur)}</Text></Text>
              {data.payments !== null ? (
                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  {t.to === userId ? <Button label="Relancer" variant="ghost" onPress={() => remind(t)} /> : null}
                  <Button label="Marquer reçu" variant="ghost" loading={busy === key} onPress={() => received(t, key)} />
                </View>
              ) : null}
            </View>
          );
        })}
        {data.payments === null && transfers.length > 0 ? <Text variant="muted">« Marquer reçu » sera disponible après la migration SQL des remboursements.</Text> : null}
        <ErrorNote message={error} />
      </View>
      {active.length < 2 ? <Text variant="muted">Invite un ami pour partager les dépenses.</Text> : null}
    </Card>
  );
}

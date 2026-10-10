import React, { useState } from 'react';
import { Share, Text as RNText, View } from 'react-native';
import { Button, Card, ErrorNote, Text } from '../../ui';
import { fonts, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { formatMoney } from '../../lib/format';
import { applyPayments, computeBalances, groupByCreditor, settlements } from '../../domain/budget.ts';
import { markReceived } from '../../data/settlements';
import type { TripData } from '../../data/useTrip';

function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: color }}>
      <RNText style={{ fontFamily: fonts.sansBold, fontSize: Math.round(size * 0.4), color: '#14100A' }}>{name.charAt(0).toUpperCase()}</RNText>
    </View>
  );
}

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
  const colorOf = (id: string) => members.find((m) => m.user_id === id)?.color ?? colors.text3;

  const raw = computeBalances(expenses, active.map((m) => m.user_id));
  const balances = applyPayments(raw, data.payments ?? []);
  const transfers = settlements(balances);
  const mine = balances.find((b) => b.userId === userId)?.balance ?? 0;
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const maxBal = Math.max(1, ...balances.map((b) => Math.abs(b.balance)));
  const maxPaid = Math.max(1, ...raw.flatMap((b) => [b.paid, b.share]));
  const groups = groupByCreditor(transfers);

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
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Text variant="label">Qui doit, qui reçoit</Text>
          {balances.map((b) => {
            const pos = b.balance >= 0;
            const w = `${Math.min(100, (Math.abs(b.balance) / maxBal) * 100)}%` as const;
            return (
              <View key={b.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Avatar name={nameOf(b.userId)} color={colorOf(b.userId)} />
                <View style={{ flex: 1, height: 26, flexDirection: 'row' }} accessible accessibilityLabel={`${nameOf(b.userId)} ${pos ? 'reçoit' : 'doit'} ${formatMoney(Math.abs(b.balance), cur)}`}>
                  <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>{!pos ? <View style={{ width: w, height: 18, borderRadius: 6, backgroundColor: colors.warm }} /> : null}</View>
                  <View style={{ width: 2, backgroundColor: colors.lineStrong }} />
                  <View style={{ flex: 1, justifyContent: 'center' }}>{pos && b.balance > 0.005 ? <View style={{ width: w, height: 18, borderRadius: 6, backgroundColor: colors.accent }} /> : null}</View>
                </View>
                <Text variant="mono" style={{ minWidth: 78, textAlign: 'right', color: Math.abs(b.balance) < 0.005 ? colors.text3 : pos ? colors.accent : colors.warm }}>
                  {Math.abs(b.balance) < 0.005 ? formatMoney(0, cur) : `${pos ? '+' : '−'}${formatMoney(Math.abs(b.balance), cur)}`}
                </Text>
              </View>
            );
          })}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="muted" style={{ fontSize: 12 }}>◀ doit de l'argent</Text>
            <Text variant="muted" style={{ fontSize: 12 }}>reçoit de l'argent ▶</Text>
          </View>

          <Text variant="label" style={{ marginTop: space.sm }}>Qui a payé quoi</Text>
          {raw.map((b) => (
            <View key={b.userId} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{nameOf(b.userId)}</Text>
                <Text variant="muted" style={{ flexShrink: 1, textAlign: 'right' }}>a payé {formatMoney(b.paid, cur)} · sa part {formatMoney(b.share, cur)}</Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(b.paid / maxPaid) * 100}%`, backgroundColor: colors.accent }} />
                <View style={{ position: 'absolute', top: 0, bottom: 0, width: 3, left: `${Math.min(99, (b.share / maxPaid) * 100)}%`, backgroundColor: colors.text }} />
              </View>
            </View>
          ))}
          <Text variant="muted" style={{ fontSize: 12 }}>Trait vertical = sa part du total.</Text>
        </View>
      ) : null}

      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Text variant="label">Pour être quittes</Text>
        {transfers.length === 0 ? <Text variant="muted">Tout le monde est à l'équilibre.</Text> : groups.map((g) => (
          <View key={g.to} style={{ gap: space.sm, padding: space.md, borderRadius: 16, backgroundColor: colors.surface2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Avatar name={nameOf(g.to)} color={colorOf(g.to)} />
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontFamily: fonts.sansBold }}>{g.to === userId ? 'Tu dois recevoir' : `${nameOf(g.to)} doit recevoir`}</Text>
                <Text variant="muted" style={{ fontSize: 12 }}>remboursements à faire</Text>
              </View>
              <Text variant="mono" style={{ color: colors.accent }}>{formatMoney(g.total, cur)}</Text>
            </View>
            <View style={{ flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', gap: 2 }} accessible accessibilityLabel={`Qui rembourse ${nameOf(g.to)}`}>
              {g.from.map((f) => <View key={f.id} style={{ flex: f.amount, backgroundColor: colorOf(f.id) }} />)}
            </View>
            {g.from.map((f) => {
              const t = { from: f.id, to: g.to, amount: f.amount };
              const key = `${f.id}>${g.to}`;
              return (
                <View key={key} style={{ gap: space.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Avatar name={nameOf(f.id)} color={colorOf(f.id)} size={26} />
                    <Text variant="body"><Text variant="body" style={{ fontFamily: fonts.sansBold }}>{nameOf(f.id)}</Text> → <Text variant="mono">{formatMoney(f.amount, cur)}</Text></Text>
                  </View>
                  {data.payments !== null ? (
                    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                      {g.to === userId ? <Button label="Relancer" variant="ghost" onPress={() => remind(t)} /> : null}
                      <Button label="Marquer reçu" variant="ghost" loading={busy === key} onPress={() => received(t, key)} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
        {data.payments === null && transfers.length > 0 ? <Text variant="muted">« Marquer reçu » sera disponible après la migration SQL des remboursements.</Text> : null}
        <ErrorNote message={error} />
      </View>
      {active.length < 2 ? <Text variant="muted">Invite un ami pour partager les dépenses.</Text> : null}
    </Card>
  );
}

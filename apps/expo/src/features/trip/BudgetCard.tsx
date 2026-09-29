import React from 'react';
import { View } from 'react-native';
import { Card, Text } from '../../ui';
import { space } from '../../theme/tokens';
import { formatMoney } from '../../lib/format';
import { budgetSummary, computeBalances, settlements } from '../../domain/budget.ts';
import { POSTES } from '../../domain/types.ts';
import type { Poste } from '../../domain/types.ts';
import type { TripData } from '../../data/useTrip';

const NOMS: Record<Poste, string> = { hebergement: 'Hébergement', transports: 'Transports', repas: 'Repas', activites: 'Activités', shopping: 'Shopping' };

export function BudgetCard({ data }: { data: TripData }) {
  const { trip, members, expenses, items, places, budgetLines } = data;
  const active = members.filter((m) => !m.left_at);
  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.profiles?.display_name ?? 'Ancien membre';

  const envelopes = Object.fromEntries(budgetLines.map((l) => [l.poste, Number(l.amount)])) as Partial<Record<Poste, number>>;
  const summary = budgetSummary({ expenses, items, places, envelopes, travelers: Math.max(1, active.length) });
  const balances = computeBalances(expenses, active.map((m) => m.user_id));
  const transfers = settlements(balances);
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <Card>
      <Text variant="heading">Budget</Text>
      <Text variant="muted">Dépensé : <Text variant="mono">{formatMoney(total, trip.currency)}</Text></Text>
      {POSTES.map((p) => {
        const s = summary[p];
        if (!s.paid && !s.forecast && !s.envelope) return null;
        return (
          <View key={p} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
            <Text variant="body">{NOMS[p]}</Text>
            <Text variant="mono">
              {formatMoney(s.paid, trip.currency)}
              {s.forecast ? ` + ≈ ${formatMoney(s.forecast, trip.currency)} prévus` : ''}
              {s.envelope ? ` / ${formatMoney(s.envelope, trip.currency)}` : ''}
            </Text>
          </View>
        );
      })}

      <Text variant="label" style={{ marginTop: space.md }}>Comptes entre amis</Text>
      {transfers.length === 0 ? <Text variant="muted">Tout le monde est à l'équilibre.</Text> : transfers.map((t, i) => (
        <Text key={i} variant="body">{nameOf(t.from)} doit <Text variant="mono">{formatMoney(t.amount, trip.currency)}</Text> à {nameOf(t.to)}</Text>
      ))}
    </Card>
  );
}

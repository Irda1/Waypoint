import React from 'react';
import { View } from 'react-native';
import { Card, Text } from '../../ui';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { formatMoney } from '../../lib/format';
import { useLocalMoney } from '../../data/rates';
import { convert, formatApprox } from '../../domain/currency.ts';
import { budgetSummary, computeBalances, settlements } from '../../domain/budget.ts';
import { POSTES } from '../../domain/types.ts';
import type { Poste } from '../../domain/types.ts';
import type { TripData } from '../../data/useTrip';

const NOMS: Record<Poste, string> = { hebergement: 'Hébergement', transports: 'Transports', repas: 'Repas', activites: 'Activités', shopping: 'Shopping' };

export function BudgetCard({ data }: { data: TripData }) {
  const { colors } = useTheme();
  const { trip, members, expenses, items, places, budgetLines } = data;
  const active = members.filter((m) => !m.left_at);
  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.profiles?.display_name ?? 'Ancien membre';

  const envelopes = Object.fromEntries(budgetLines.map((l) => [l.poste, Number(l.amount)])) as Partial<Record<Poste, number>>;
  const summary = budgetSummary({ expenses, items, places, envelopes, travelers: Math.max(1, active.length) });
  const balances = computeBalances(expenses, active.map((m) => m.user_id));
  const transfers = settlements(balances);
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const { rates, local } = useLocalMoney(data.destinations[0]?.country_code ?? null);
  const localTotal = local && local !== trip.currency ? convert(total, trip.currency, local, rates) : null;

  return (
    <Card>
      <Text variant="heading">Budget</Text>
      <Text variant="muted">Dépensé : <Text variant="mono">{formatMoney(total, trip.currency)}</Text></Text>
      {localTotal !== null && local && total > 0 ? (
        <Text variant="muted">En monnaie locale : <Text variant="mono">{formatApprox(localTotal, local)}</Text> (taux BCE du {(rates.date ?? '').split('-').reverse().join('/')})</Text>
      ) : null}
      {POSTES.map((p) => {
        const s = summary[p];
        if (!s.paid && !s.forecast && !s.envelope) return null;
        const spent = s.paid + s.forecast;
        const over = !!s.envelope && spent > s.envelope;
        const paidShare = s.envelope ? Math.min(100, (s.paid / s.envelope) * 100) : 0;
        const totalShare = s.envelope ? Math.min(100, (spent / s.envelope) * 100) : 0;
        return (
          <View key={p} style={{ gap: space.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <Text variant="body">{NOMS[p]}</Text>
              <Text variant="mono" style={{ flexShrink: 1, textAlign: 'right' }}>
                {formatMoney(s.paid, trip.currency)}
                {s.forecast ? ` + ≈ ${formatMoney(s.forecast, trip.currency)} prévus` : ''}
                {s.envelope ? ` / ${formatMoney(s.envelope, trip.currency)}` : ''}
              </Text>
            </View>
            {s.envelope ? (
              <View accessible accessibilityRole="progressbar" accessibilityLabel={`${NOMS[p]} : ${Math.round((spent / s.envelope) * 100)} % du budget prévu`}
                style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.surface2, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${totalShare}%`, backgroundColor: over ? colors.warm : colors.text3, opacity: 0.45 }} />
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${paidShare}%`, backgroundColor: over ? colors.warm : colors.accent }} />
              </View>
            ) : null}
            {over ? <Text variant="muted" style={{ color: colors.warm }}>Dépasse le budget prévu de {formatMoney(spent - (s.envelope ?? 0), trip.currency)}</Text> : null}
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

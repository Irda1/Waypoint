import React from 'react';
import { View } from 'react-native';
import { Card, Text } from '../../ui';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { formatMoney } from '../../lib/format';
import { useLocalMoney } from '../../data/rates';
import { convert, formatApprox } from '../../domain/currency.ts';
import { budgetSummary, computeBalances, costByDay, savingSuggestions, settlements } from '../../domain/budget.ts';
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
  const travelers = Math.max(1, active.length);
  const savings = savingSuggestions({ expenses, items, places, envelopes, travelers });
  const dayCosts = costByDay(data.days, items, places, travelers);
  const maxDay = Math.max(0, ...dayCosts);
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

      {savings.length ? (
        <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.field, backgroundColor: colors.surface2 }} accessibilityLabel="Revenir sous le budget">
          <Text variant="label" style={{ color: colors.warm }}>Revenir sous le budget</Text>
          {savings.map((sv) => (
            <View key={sv.poste} style={{ gap: 2 }}>
              <Text variant="body">{NOMS[sv.poste]} : {formatMoney(sv.over, trip.currency)} de trop.</Text>
              {sv.remove.length ? (
                <Text variant="muted">
                  Retire {sv.remove.map((r) => `${r.name} (${formatMoney(r.cost, trip.currency)})`).join(' + ')}
                  {sv.margin >= 0 ? sv.margin > 0 ? ` : il te resterait ${formatMoney(sv.margin, trip.currency)}.` : ' : tu reviens pile au budget.' : ` : il manquerait encore ${formatMoney(-sv.margin, trip.currency)}.`}
                </Text>
              ) : <Text variant="muted">Aucune étape à retirer : les dépenses déjà saisies dépassent le budget.</Text>}
            </View>
          ))}
          <Text variant="muted">Ou garde le programme et augmente le budget de ce poste à la création du voyage.</Text>
        </View>
      ) : null}

      {maxDay > 0 ? (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Text variant="label">Coût des activités, par jour</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, height: 110 }}>
            {dayCosts.map((c, i) => (
              <View key={data.days[i].id} accessible accessibilityLabel={`Jour ${i + 1} : ${formatMoney(c, trip.currency)}`} style={{ flex: 1, maxWidth: 40, alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: '100%' }}>
                <Text variant="muted" style={{ fontSize: 11 }}>{c > 0 ? formatMoney(c, trip.currency) : ''}</Text>
                <View style={{ width: '100%', height: `${Math.max(3, (c / maxDay) * 62)}%`, borderRadius: 4, backgroundColor: c === maxDay ? colors.accent : colors.lineStrong }} />
                <Text variant="muted" style={{ fontSize: 12 }}>{i + 1}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text variant="label" style={{ marginTop: space.md }}>Comptes entre amis</Text>
      {transfers.length === 0 ? <Text variant="muted">Tout le monde est à l'équilibre.</Text> : transfers.map((t, i) => (
        <Text key={i} variant="body">{nameOf(t.from)} doit <Text variant="mono">{formatMoney(t.amount, trip.currency)}</Text> à {nameOf(t.to)}</Text>
      ))}
    </Card>
  );
}

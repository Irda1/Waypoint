import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Card, Field, Text } from '../../ui';
import { formatMoney } from '../../lib/format';
import { dateRange } from '../../lib/dates.ts';
import { COUNTRY_NAME, flagEmoji } from '../../domain/countries.ts';
import { BUDGET_LEVELS, INTERESTS, PARTY_OPTIONS, autoTitle, budgetTotal, dayCount, nightCount } from '../../domain/wizard.ts';
import type { WizardState } from '../../domain/wizard.ts';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { StepTitle } from './parts';
import type { StepProps } from './parts';

export type StepId = 'pays' | 'dates' | 'villes' | 'voyageurs' | 'interets' | 'budget' | 'recap';

function Line({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{label}</Text>
        <Text variant="body">{value}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Modifier : ${label}`} onPress={onEdit} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
        <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.accent }}>Modifier</RNText>
      </Pressable>
    </View>
  );
}

export function StepRecap({ state, update, goTo }: StepProps<WizardState> & { goTo: (s: StepId) => void }) {
  const days = dayCount(state);
  const total = budgetTotal(state);
  const level = BUDGET_LEVELS.find((l) => l.id === state.budget.level)?.name ?? 'Montant précis';
  const party = PARTY_OPTIONS.find((p) => p.id === state.party)?.name ?? '';
  const themes = state.interests.map((c) => INTERESTS.find((i) => i.code === c)?.name ?? c).join(', ');
  return (
    <View style={{ gap: space.md }}>
      <StepTitle title="Tout est bon ?" hint="Vérifie, puis crée ton voyage. Tu pourras tout modifier ensuite." />
      <Field label="Nom du voyage" value={state.title} onChangeText={(t) => update({ ...state, title: t, titleEdited: true })} placeholder={autoTitle(state)} />
      <Card>
        <Line label="Pays" value={`${state.country ? flagEmoji(state.country) : ''} ${COUNTRY_NAME[state.country ?? ''] ?? ''}`.trim()} onEdit={() => goTo('pays')} />
        <Line label="Dates" value={state.start && state.end ? `${state.indicative ? 'Indicatives · ' : ''}${dateRange(state.start, state.end)} · ${days} j / ${nightCount(state)} nuits` : ''} onEdit={() => goTo('dates')} />
        <Line label="Villes" value={state.cities.length ? state.cities.map((c) => `${c.name} (${c.nights})`).join(' → ') : 'Je choisirai sur place'} onEdit={() => goTo('villes')} />
        <Line label="Voyageurs" value={`${party} · ${state.travelers} personne${state.travelers > 1 ? 's' : ''}`} onEdit={() => goTo('voyageurs')} />
        <Line label="Envies" value={themes} onEdit={() => goTo('interets')} />
        <Line label="Budget" value={total !== null ? `${level} · ${formatMoney(total, state.budget.currency)}` : ''} onEdit={() => goTo('budget')} />
      </Card>
    </View>
  );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { Chip, Field, Text } from '../../ui';
import { formatMoney } from '../../lib/format';
import { BUDGET_LEVELS, budgetTotal, dayCount } from '../../domain/wizard.ts';
import type { WizardState } from '../../domain/wizard.ts';
import { space } from '../../theme/tokens';
import { Choice, StepTitle } from './parts';
import type { StepProps } from './parts';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY'];

export function StepBudget({ state, update }: StepProps<WizardState>) {
  const [amount, setAmount] = useState(state.budget.amount ? String(state.budget.amount) : '');
  const cur = state.budget.currency;
  const set = (patch: Partial<WizardState['budget']>) => update({ ...state, budget: { ...state.budget, ...patch } });
  const total = budgetTotal(state);
  const days = Math.max(dayCount(state), 1);

  return (
    <View style={{ gap: space.md }}>
      <StepTitle title="Quel budget ?" hint="Une enveloppe pour tout le groupe, répartie ensuite par poste (hébergement, repas…). Tu pourras la modifier." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {CURRENCIES.map((c) => <Chip key={c} label={c} selected={cur === c} onPress={() => set({ currency: c })} />)}
      </View>
      {BUDGET_LEVELS.map((l) => (
        <Choice key={l.id} title={`${l.name} · ≈ ${formatMoney(l.perDay, cur)} / jour / pers.`} detail={l.detail} selected={state.budget.level === l.id} onPress={() => set({ level: l.id, amount: null })} />
      ))}
      <Choice title="Un montant précis" detail="Total pour le groupe" selected={state.budget.level === 'montant'} onPress={() => set({ level: 'montant' })} />
      {state.budget.level === 'montant' ? (
        <Field label={`Budget total (${cur})`} value={amount} keyboardType="numeric" placeholder="Ex. 1500"
          onChangeText={(t) => { setAmount(t); const n = Number(t.replace(',', '.')); set({ level: 'montant', amount: Number.isFinite(n) && n > 0 ? n : null }); }} />
      ) : null}
      {total !== null ? (
        <Text variant="body" accessibilityLiveRegion="polite">
          Enveloppe : {formatMoney(total, cur)} pour {state.travelers} personne{state.travelers > 1 ? 's' : ''} sur {days} jour{days > 1 ? 's' : ''}
          {state.budget.level !== 'montant' ? ' (estimation)' : ''}.
        </Text>
      ) : null}
    </View>
  );
}

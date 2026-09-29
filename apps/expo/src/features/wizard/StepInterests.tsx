import React from 'react';
import { View } from 'react-native';
import { Chip, Text } from '../../ui';
import { INTERESTS } from '../../domain/wizard.ts';
import type { WizardState } from '../../domain/wizard.ts';
import { space } from '../../theme/tokens';
import { StepTitle } from './parts';
import type { StepProps } from './parts';

export function StepInterests({ state, update }: StepProps<WizardState>) {
  const toggle = (code: string) => update({ ...state, interests: state.interests.includes(code) ? state.interests.filter((c) => c !== code) : [...state.interests, code] });
  return (
    <View style={{ gap: space.md }}>
      <StepTitle title="Qu'est-ce qui te plaît ?" hint="Choisis au moins un thème. Ils servent à te proposer les bons lieux." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {INTERESTS.map((i) => <Chip key={i.code} label={i.name} selected={state.interests.includes(i.code)} onPress={() => toggle(i.code)} />)}
      </View>
      <Text variant="muted">{state.interests.length ? `${state.interests.length} thème${state.interests.length > 1 ? 's' : ''} choisi${state.interests.length > 1 ? 's' : ''}.` : 'Aucun thème choisi.'}</Text>
    </View>
  );
}

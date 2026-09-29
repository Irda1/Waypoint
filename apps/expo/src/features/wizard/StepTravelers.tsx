import React from 'react';
import { View } from 'react-native';
import { Card, Text } from '../../ui';
import { PARTY_OPTIONS, pickParty } from '../../domain/wizard.ts';
import type { WizardState } from '../../domain/wizard.ts';
import { space } from '../../theme/tokens';
import { Choice, RoundButton, StepTitle } from './parts';
import type { StepProps } from './parts';

export function StepTravelers({ state, update }: StepProps<WizardState>) {
  const counted = state.party === 'amis' || state.party === 'famille';
  const min = 3;
  return (
    <View style={{ gap: space.md }}>
      <StepTitle title="Qui voyage ?" hint="Le budget est calculé pour tout le groupe." />
      {PARTY_OPTIONS.map((o) => <Choice key={o.id} title={o.name} detail={o.detail} selected={state.party === o.id} onPress={() => update(pickParty(state, o.id))} />)}
      {counted ? (
        <Card>
          <Text variant="label">Combien de personnes ?</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
            <RoundButton label="−" name="Une personne de moins" disabled={state.travelers <= min} onPress={() => update({ ...state, travelers: state.travelers - 1 })} />
            <Text variant="heading" accessibilityLiveRegion="polite">{state.travelers}</Text>
            <RoundButton label="+" name="Une personne de plus" disabled={state.travelers >= 30} onPress={() => update({ ...state, travelers: state.travelers + 1 })} />
          </View>
        </Card>
      ) : null}
    </View>
  );
}

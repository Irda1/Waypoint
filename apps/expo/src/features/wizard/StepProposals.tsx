import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Card, Chip, ErrorNote, Text } from '../../ui';
import { formatDay } from '../../lib/format';
import { formatTime } from '../../domain/planning.ts';
import { toggleExcluded, wizardPlan } from '../../domain/wizard.ts';
import type { WizardState } from '../../domain/wizard.ts';
import type { Candidate } from '../../domain/itinerary.ts';
import { loadCandidates } from '../../data/itinerary';
import { useCategories } from '../../data/categories';
import { useTheme } from '../../theme/useTheme';
import { categoryColors, fonts, space } from '../../theme/tokens';
import { StepTitle } from './parts';
import type { StepProps } from './parts';

/** Étape « Propositions » : aperçu du programme jour par jour ; on retire ce qui ne plaît pas, ou on le remplit soi-même. */
export function StepProposals({ state, update }: StepProps<WizardState>) {
  const { colors, mode } = useTheme();
  const categories = useCategories();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cityKey = state.cities.map((c) => c.id).join(',');

  useEffect(() => {
    if (!state.cities.length || categories.byCode.size === 0) return;
    let alive = true;
    void loadCandidates(state.cities.map((c) => c.id), categories.rootOf).then((r) => {
      if (!alive) return;
      setCandidates(r.candidates); setError(r.error);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey, categories.byCode.size]);

  const plan = useMemo(() => (candidates ? wizardPlan(state, candidates) : []), [candidates, state]);
  const removed = useMemo(() => (candidates ?? []).filter((c) => state.excluded.includes(c.place.id)), [candidates, state.excluded]);

  if (!state.cities.length) {
    return (
      <View style={{ gap: space.md }}>
        <StepTitle title="Propositions" hint="Tu as choisi de décider des villes sur place : pas de programme à proposer pour l'instant. Tu pourras en générer un depuis le voyage." />
      </View>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <StepTitle title="Voici une première idée" hint="Un programme jour par jour selon tes envies et ton budget. Retire ce qui ne te plaît pas, tu modifieras tout ensuite." />
      <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
        <Chip label="Remplir mes jours" selected={state.program} onPress={() => update({ ...state, program: true })} />
        <Chip label="Je le ferai moi-même" selected={!state.program} onPress={() => update({ ...state, program: false })} />
      </View>
      <ErrorNote message={error} />
      {!state.program ? <Text variant="muted">Les jours seront créés vides, avec les villes et le budget choisis.</Text> : candidates === null ? <Text variant="muted">Recherche des meilleurs lieux…</Text> : (
        <>
          {plan.every((p) => p.empty) ? <Text variant="muted">Aucun lieu disponible pour ces villes : les jours resteront vides et tu pourras les remplir ensuite.</Text> : null}
          {plan.map((d) => (
            <Card key={d.date}>
              <Text variant="label" style={{ textTransform: 'capitalize' }}>{formatDay(d.date)}</Text>
              {d.empty ? <Text variant="muted">Rien à proposer ce jour-là.</Text> : d.items.map((i, k) => {
                const name = i.place?.name ?? i.title ?? 'Étape';
                const dot = categoryColors[mode][i.root ?? ''] ?? colors.text3;
                return (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 }}>
                    <Text variant="mono" style={{ width: 48, color: colors.text2, fontSize: 14 }}>{formatTime(i.startMin)}</Text>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
                    <Text variant="body" style={{ flex: 1, fontFamily: fonts.sansSemi }}>{name}</Text>
                    {i.place ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${name}`} onPress={() => update(toggleExcluded(state, i.place!.id))} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
                        <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text3 }}>Retirer</RNText>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          ))}
          {removed.length ? (
            <View style={{ gap: space.xs }}>
              <Text variant="label">Retirés</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {removed.map((c) => <Chip key={c.place.id} label={`↺ ${c.place.name}`} onPress={() => update(toggleExcluded(state, c.place.id))} />)}
              </View>
            </View>
          ) : null}
          <Text variant="muted">Durées et prix : estimations d'après la catégorie du lieu. Les trajets sont estimés à vol d'oiseau.</Text>
        </>
      )}
    </View>
  );
}

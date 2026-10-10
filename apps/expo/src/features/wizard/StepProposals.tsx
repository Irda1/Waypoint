import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text as RNText, View } from 'react-native';
import { Card, Chip, ErrorNote, Text } from '../../ui';
import { formatDay } from '../../lib/format';
import { formatTime } from '../../domain/planning.ts';
import { toggleExcluded, wizardPlan } from '../../domain/wizard.ts';
import type { WizardState } from '../../domain/wizard.ts';
import type { Candidate } from '../../domain/itinerary.ts';
import { loadCandidates } from '../../data/itinerary';
import { ensureCitiesCollected } from '../../data/cityCollection';
import type { CollectionProgress } from '../../domain/collection.ts';
import { useCategories } from '../../data/categories';
import { iconFor } from '../../theme/categoryIcons';
import { Icon } from '../../ui/Icon';
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
  const [progress, setProgress] = useState<CollectionProgress | null>(null);
  const cityKey = state.cities.map((c) => c.id).join(',');

  // Les lieux ne sont lus que pour les villes choisies : celles qui ne sont pas prêtes sont collectées tout de suite
  // depuis l'appli (pourcentage réel), ou confiées au robot si ça échoue, avant d'afficher les propositions.
  useEffect(() => {
    if (!state.cities.length || categories.byCode.size === 0) return;
    let alive = true;
    const ids = state.cities.map((c) => c.id);
    setCandidates(null); setProgress(null);
    void (async () => {
      const r = await ensureCitiesCollected(ids, (p) => { if (alive) setProgress(p); }, () => alive);
      if (!alive) return;
      const loaded = await loadCandidates(ids, categories.rootOf);
      if (!alive) return;
      setCandidates(loaded.candidates); setError(loaded.error ?? r.error);
    })();
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
      {!state.program ? <Text variant="muted">Les jours seront créés vides, avec les villes et le budget choisis.</Text> : candidates === null ? <LoadBar progress={progress} /> : (
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
                    <View accessible={false} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${dot}33`, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={i.place ? iconFor(i.root ?? '') : 'trip'} size={15} color={dot} />
                    </View>
                    {/* Toucher une étape ouvre le lieu dans Google Maps ; une étape sans lieu ne fait rien. */}
                    <Pressable disabled={!i.place} accessibilityRole={i.place ? 'link' : undefined} accessibilityLabel={i.place ? `Ouvrir ${name} dans Google Maps` : name}
                      onPress={() => { if (i.place) void Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(name)}/@${i.place.lat},${i.place.lng},17z`); }} style={{ flex: 1 }}>
                      <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{name}</Text>
                    </Pressable>
                    {i.place ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${name}`} onPress={() => update(toggleExcluded(state, i.place!.id))} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
                        <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger, opacity: 0.85 }}>Retirer</RNText>
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
                {removed.map((c) => <Chip key={c.place.id} label={`Remettre ${c.place.name}`} onPress={() => update(toggleExcluded(state, c.place.id))} />)}
              </View>
            </View>
          ) : null}
          <Text variant="muted">Durées et prix : estimations d'après la catégorie du lieu. Les trajets sont estimés à vol d'oiseau.</Text>
        </>
      )}
    </View>
  );
}

function LoadBar({ progress }: { progress: CollectionProgress | null }) {
  const { colors } = useTheme();
  const pct = progress ? Math.max(4, progress.percent) : 4;
  return (
    <View style={{ gap: space.sm }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress?.percent ?? 0 }}>
      <Text variant="body">Récupération des lieux de tes villes…</Text>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: colors.surface2, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 999, backgroundColor: colors.accent }} />
      </View>
      <Text variant="muted">{progress ? `${progress.percent} % · ${progress.ready} ville${progress.ready > 1 ? 's' : ''} sur ${progress.total} prête${progress.ready > 1 ? 's' : ''}` : 'Connexion à la base…'}</Text>
      {progress && progress.percent < 100 ? <Text variant="muted">Seules les villes choisies sont chargées, directement depuis OpenStreetMap : quelques secondes pour une ville, un peu plus pour une grande métropole.</Text> : null}
    </View>
  );
}

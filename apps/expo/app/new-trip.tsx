import React, { useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useRequireAuth } from '../src/auth/useRequireAuth';
import { Button, ErrorNote } from '../src/ui';
import { createTripFromWizard } from '../src/data/trips';
import { MAX_TRIP_DAYS, autoTitle, dayCount, missingSteps, newWizard } from '../src/domain/wizard.ts';
import type { WizardState } from '../src/domain/wizard.ts';
import { COUNTRY_NAME } from '../src/domain/countries.ts';
import { StepCountry } from '../src/features/wizard/StepCountry';
import { StepDates } from '../src/features/wizard/StepDates';
import { StepCities } from '../src/features/wizard/StepCities';
import { StepTravelers } from '../src/features/wizard/StepTravelers';
import { StepInterests } from '../src/features/wizard/StepInterests';
import { StepBudget } from '../src/features/wizard/StepBudget';
import { StepProposals } from '../src/features/wizard/StepProposals';
import { StepRecap } from '../src/features/wizard/StepRecap';
import type { StepId } from '../src/features/wizard/StepRecap';
import { useCategories } from '../src/data/categories';
import { fonts, space } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';

const ORDER: StepId[] = ['pays', 'dates', 'villes', 'voyageurs', 'interets', 'budget', 'propositions', 'recap'];

/** Ce qu'il faut avoir choisi pour quitter une étape (null = on peut continuer). */
function blocker(step: StepId, s: WizardState): string | null {
  if (step === 'pays' && !s.country) return 'Choisis un pays pour continuer.';
  if (step === 'dates') {
    if (!s.start || !s.end) return 'Choisis tes dates (arrivée et départ) ou une durée.';
    if (dayCount(s) > MAX_TRIP_DAYS) return `Un voyage dure au plus ${MAX_TRIP_DAYS} jours.`;
  }
  if (step === 'voyageurs' && !s.party) return 'Dis-nous qui voyage.';
  if (step === 'interets' && !s.interests.length) return 'Choisis au moins un thème.';
  if (step === 'budget' && missingSteps(s).includes('budget')) return 'Choisis un niveau de budget ou un montant.';
  return null;
}

export default function NewTrip() {
  const guard = useRequireAuth();
  const categories = useCategories();
  const { colors } = useTheme();
  // « Envie de… » : pays et ville déjà choisis, on démarre aux dates.
  const params = useLocalSearchParams<{ country?: string; city?: string }>();
  const preCountry = typeof params.country === 'string' && COUNTRY_NAME[params.country] ? params.country : null;
  const preCity = preCountry && typeof params.city === 'string' ? params.city : null;
  const [state, setState] = useState<WizardState>(() => ({ ...newWizard(), country: preCountry }));
  const [step, setStep] = useState<StepId>(preCountry ? 'dates' : 'pays');
  const [fromRecap, setFromRecap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (guard) return guard;

  const index = ORDER.indexOf(step);
  const block = blocker(step, state);

  // Changer les dates ou le pays invalide la répartition des nuits : on la recalcule.
  function update(next: WizardState) {
    setError(null);
    setState(next);
  }

  function goTo(s: StepId) { setFromRecap(step === 'recap'); setStep(s); setError(null); }

  function next() {
    if (block) { setError(block); return; }
    setError(null);
    if (fromRecap && step !== 'recap') { setFromRecap(false); setStep('recap'); return; }
    setStep(ORDER[index + 1]);
  }
  function back() {
    setError(null);
    if (fromRecap) { setFromRecap(false); setStep('recap'); return; }
    if (index === 0) { router.back(); return; }
    setStep(ORDER[index - 1]);
  }

  async function create() {
    const missing = missingSteps(state);
    if (missing.length) { setError('Il manque encore des informations. Reviens sur les étapes précédentes.'); return; }
    setBusy(true);
    const res = await createTripFromWizard(state, categories.rootOf);
    setBusy(false);
    if (!res.id) { setError(res.error ?? 'Création impossible.'); return; }
    router.replace({ pathname: '/trip/[id]', params: { id: res.id } });
  }

  const props = { state, update };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, width: '100%', maxWidth: 880, alignSelf: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={index === 0 && !fromRecap ? 'Fermer' : 'Étape précédente'} onPress={back} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
            <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 20, color: colors.text }}>{index === 0 && !fromRecap ? '✕' : '←'}</RNText>
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }} accessibilityLabel={`Étape ${index + 1} sur ${ORDER.length}`}>
            {ORDER.map((s, i) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? colors.accent : colors.surface2 }} />)}
          </View>
          {index > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Abandonner la création" onPress={() => router.replace('/')} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
              <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text3 }}>Fermer</RNText>
            </Pressable>
          ) : <View style={{ width: 44 }} />}
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.lg, paddingBottom: step === 'villes' || step === 'pays' ? space.md : space.xxl * 2, width: '100%', maxWidth: step === 'villes' ? 1320 : 880, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {step === 'pays' ? <StepCountry {...props} /> : null}
        {step === 'dates' ? <StepDates {...props} /> : null}
        {step === 'villes' ? <StepCities {...props} preferCity={preCity} /> : null}
        {step === 'voyageurs' ? <StepTravelers {...props} /> : null}
        {step === 'interets' ? <StepInterests {...props} /> : null}
        {step === 'budget' ? <StepBudget {...props} /> : null}
        {step === 'propositions' ? <StepProposals {...props} /> : null}
        {step === 'recap' ? <StepRecap {...props} goTo={goTo} /> : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line }}>
        <View style={{ padding: space.lg, gap: space.sm, width: '100%', maxWidth: 880, alignSelf: 'center' }}>
          <ErrorNote message={error} />
        {step === 'recap' ? (
            <Button label={`Créer « ${state.title.trim() || autoTitle(state)} »`} onPress={create} loading={busy} />
          ) : (
            <>
              <Button label={fromRecap ? 'Retour au récapitulatif' : step === 'villes' && !state.cities.length ? 'Je choisirai sur place' : 'Continuer'} onPress={next} disabled={!!block} />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

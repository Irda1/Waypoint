import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useRequireAuth } from '../src/auth/useRequireAuth';
import { Button, ErrorNote, Text } from '../src/ui';
import { FadeIn } from '../src/ui/FadeIn';
import { createTripFromWizard } from '../src/data/trips';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOME_KEY, tripHomeKey } from '../src/features/trip/FlightsCard';
import { StepDeparture } from '../src/features/wizard/StepDeparture';
import { MAX_TRIP_DAYS, autoTitle, choiceTrail, dayCount, missingSteps, newWizard, sameCity } from '../src/domain/wizard.ts';
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
import { ModeChoice } from '../src/features/simple/ModeChoice';
import type { TripMode } from '../src/features/simple/ModeChoice';
import { SimpleCreate } from '../src/features/simple/SimpleCreate';
import { fonts, space } from '../src/theme/tokens';
import { Icon } from '../src/ui/Icon';
import { useTheme } from '../src/theme/useTheme';

const ORDER: StepId[] = ['pays', 'dates', 'villes', 'voyageurs', 'depart', 'interets', 'budget', 'propositions', 'recap'];
const STEP_NAME: Record<StepId, string> = { pays: 'Pays', dates: 'Dates', villes: 'Villes', voyageurs: 'Voyageurs', depart: 'Départ', interets: 'Envies', budget: 'Budget', propositions: 'Propositions', recap: 'Récapitulatif' };

/** Ce qu'il faut avoir choisi pour quitter une étape (null = on peut continuer). */
function blocker(step: StepId, s: WizardState): string | null {
  if (step === 'pays' && !s.country) return 'Choisis un pays pour continuer.';
  if (step === 'dates') {
    if (!s.start || !s.end) return 'Choisis tes dates (arrivée et départ) ou une durée.';
    if (dayCount(s) > MAX_TRIP_DAYS) return `Un voyage dure au plus ${MAX_TRIP_DAYS} jours.`;
  }
  if (step === 'voyageurs' && !s.party) return 'Dis-nous qui voyage.';
  if (step === 'depart' && s.home && s.cities[0] && sameCity(s.home.name, s.cities[0].name)) return `Tu pars déjà de ${s.cities[0].name} : touche « Changer la ville de départ » et choisis-en une autre.`;
  if (step === 'interets' && !s.interests.length) return 'Choisis au moins un thème.';
  if (step === 'budget' && missingSteps(s).includes('budget')) return 'Choisis un niveau de budget ou un montant.';
  return null;
}

function CompleteWizard() {
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
  // Sens du dernier changement d'étape : 1 en avançant, -1 en reculant (l'étape glisse depuis ce côté).
  const [dir, setDir] = useState<1 | -1>(1);
  const scroll = useRef<ScrollView>(null);
  // Doigt posé sur la carte des villes : la page ne défile plus (sinon elle remonte au lieu de déplacer la carte).
  const [mapGrab, setMapGrab] = useState(false);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (guard) return guard;

  const index = ORDER.indexOf(step);
  const block = blocker(step, state);
  // « Tes choix » : seulement les étapes déjà passées (celle en cours se voit à l'écran).
  const trail = choiceTrail(state).filter((t) => ORDER.indexOf(t.step) < index);

  // Changer les dates ou le pays invalide la répartition des nuits : on la recalcule.
  function update(next: WizardState) {
    setError(null);
    setState(next);
  }

  function goTo(s: StepId) { setDir(-1); setFromRecap(step === 'recap'); setStep(s); setError(null); }
  // Un trait déjà rempli de la barre, ou une pastille de « tes choix » : retour direct à cette étape.
  function jump(s: StepId) { setDir(-1); setFromRecap(false); setStep(s); setError(null); }

  function next() {
    if (block) { setError(block); return; }
    setError(null); setDir(1);
    if (fromRecap && step !== 'recap') { setFromRecap(false); setStep('recap'); return; }
    setStep(ORDER[index + 1]);
  }
  function back() {
    setError(null); setDir(-1);
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
    // La ville de départ choisie dans l'assistant pré-remplit la carte Vols du voyage (gardée sur l'appareil).
    if (state.home) {
      const h = JSON.stringify(state.home);
      void AsyncStorage.setItem(tripHomeKey(res.id), h).catch(() => {});
      void AsyncStorage.setItem(HOME_KEY, h).catch(() => {});
    }
    router.replace({ pathname: '/trip/[id]', params: { id: res.id } });
  }

  const props = { state, update };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bg }}>
        <View style={{ width: '100%', maxWidth: 880, alignSelf: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Pressable accessibilityRole="button" accessibilityLabel={index === 0 && !fromRecap ? 'Fermer' : 'Étape précédente'} onPress={back} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
              <Icon name={index === 0 && !fromRecap ? 'close' : 'back'} size={24} tone="text" />
            </Pressable>
            <View style={{ flex: 1 }} accessibilityRole="header">
              <RNText style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.text }}>{STEP_NAME[step]}</RNText>
              <Text variant="muted">Étape {index + 1} sur {ORDER.length}{fromRecap ? ' · depuis le récapitulatif' : ''}</Text>
            </View>
            {index > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Abandonner la création" onPress={() => router.replace('/')} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
                <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text3 }}>Fermer</RNText>
              </Pressable>
            ) : <View style={{ width: 44 }} />}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {ORDER.map((s, i) => (
              <Pressable key={s} disabled={i >= index} accessibilityRole={i < index ? 'button' : undefined} accessibilityLabel={i < index ? `Revenir à l'étape ${STEP_NAME[s]}` : STEP_NAME[s]}
                onPress={() => jump(s)} hitSlop={{ top: 10, bottom: 10 }} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < index ? colors.accent : i === index ? colors.accent : colors.surface2, opacity: i === index ? 0.55 : 1 }} />
            ))}
          </View>
          {trail.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }} keyboardShouldPersistTaps="handled">
              {trail.map((t) => (
                <Pressable key={t.step} accessibilityRole="button" accessibilityLabel={`${t.label} : modifier`} onPress={() => jump(t.step)}
                  style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: 999, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface }}>
                  <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.text2 }}>{t.label}</RNText>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </SafeAreaView>

      <ScrollView ref={scroll} scrollEnabled={!mapGrab} contentContainerStyle={{ flexGrow: 1, padding: space.lg, paddingBottom: step === 'villes' || step === 'pays' ? space.md : space.xxl * 2, width: '100%', maxWidth: step === 'villes' ? 1320 : 880, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <FadeIn key={step} dx={24 * dir} dy={0} fill>
        {step === 'pays' ? <StepCountry {...props} /> : null}
        {step === 'dates' ? <StepDates {...props} /> : null}
        {step === 'villes' ? <StepCities {...props} preferCity={preCity} onMapGrab={setMapGrab} /> : null}
        {step === 'voyageurs' ? <StepTravelers {...props} /> : null}
        {step === 'depart' ? <StepDeparture {...props} /> : null}
        {step === 'interets' ? <StepInterests {...props} /> : null}
        {step === 'budget' ? <StepBudget {...props} /> : null}
        {step === 'propositions' ? <StepProposals {...props} /> : null}
        {step === 'recap' ? <StepRecap {...props} goTo={goTo} /> : null}
        </FadeIn>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line }}>
        <View style={{ padding: space.lg, gap: space.sm, width: '100%', maxWidth: 880, alignSelf: 'center' }}>
          <ErrorNote message={error ?? block} />
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

/** Nouveau voyage : d'abord le mode (complet ou juste les lieux). « Envie de… » (pays déjà choisi) va directement au parcours complet. */
export default function NewTrip() {
  const guard = useRequireAuth();
  const params = useLocalSearchParams<{ country?: string }>();
  const [mode, setMode] = useState<TripMode | null>(typeof params.country === 'string' ? 'complet' : null);
  if (guard) return guard;
  if (mode === 'simple') return <SimpleCreate onBack={() => setMode(null)} />;
  if (mode === 'complet') return <CompleteWizard />;
  return <ModeChoice onPick={setMode} />;
}

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Chip, ErrorNote, Field, Text } from '../../ui';
import { Flag } from '../../ui/Flag';
import { COUNTRIES, COUNTRY_NAME, POPULAR, searchCountries } from '../../domain/countries.ts';
import { listCountryCities } from '../../data/places';
import type { CityOption } from '../../data/places';
import { createSimpleTrip } from '../../data/trips';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { Choice, StepTitle } from '../wizard/parts';

interface Picked { id: number; name: string; country: string }

/** Assistant du mode Simple : un ou plusieurs pays, puis les villes de ces pays. */
export function SimpleCreate({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [step, setStep] = useState<'pays' | 'villes'>('pays');
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<Picked[]>([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [list, setList] = useState<(CityOption & { featured_rank: number | null })[]>([]);
  const [cityQuery, setCityQuery] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = active ?? countries[0] ?? null;
  useEffect(() => {
    if (step !== 'villes' || !current) return;
    let alive = true;
    const id = setTimeout(() => { void listCountryCities(current, cityQuery).then((r) => { if (!alive) return; setList(r.cities); setError(r.error); }); }, cityQuery ? 250 : 0);
    return () => { alive = false; clearTimeout(id); };
  }, [step, current, cityQuery]);

  const toggleCountry = (code: string) => setCountries((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]));
  const toggleCity = (c: CityOption) => setCities((cur) => (cur.some((x) => x.id === c.id) ? cur.filter((x) => x.id !== c.id) : [...cur, { id: c.id, name: c.name, country: c.country_code }]));
  const shown = query.trim() ? searchCountries(query) : null;
  const autoTitle = `Lieux · ${countries.map((c) => COUNTRY_NAME[c] ?? c).join(', ')}`;

  function goBack() {
    setError(null);
    if (step === 'villes') setStep('pays'); else onBack();
  }
  function next() {
    if (!countries.length) { setError('Choisis au moins un pays.'); return; }
    // Une ville ne reste choisie que si son pays l'est encore.
    setCities((cur) => cur.filter((c) => countries.includes(c.country)));
    setActive(countries[0]); setStep('villes'); setError(null);
  }
  async function create() {
    if (!cities.length) { setError('Choisis au moins une ville.'); return; }
    setBusy(true);
    const res = await createSimpleTrip(title.trim() || autoTitle, countries, cities.map((c) => c.id));
    setBusy(false);
    if (!res.id) { setError(res.error ?? 'Création impossible.'); return; }
    router.replace({ pathname: '/trip/[id]', params: { id: res.id } });
  }

  const countryRow = (code: string) => (
    <Choice key={code} title={COUNTRY_NAME[code] ?? code} selected={countries.includes(code)} onPress={() => toggleCountry(code)} lead={<Flag code={code} width={32} />} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bg }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Étape précédente" onPress={goBack} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', paddingHorizontal: space.lg }}>
          <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 20, color: colors.text }}>←</RNText>
        </Pressable>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, width: '100%', maxWidth: 720, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {step === 'pays' ? (
          <>
            <StepTitle title="Quels pays ?" hint="Tu peux en choisir plusieurs." />
            <Field label="Rechercher un pays" value={query} onChangeText={setQuery} placeholder="Ex. Japon, Portugal…" autoCorrect={false} />
            {countries.length ? <Text variant="muted">Choisis : {countries.map((c) => COUNTRY_NAME[c] ?? c).join(', ')}</Text> : null}
            {shown ? (shown.length ? shown.map((c) => countryRow(c.code)) : <Text variant="muted">Aucun pays ne correspond.</Text>) : (
              <>
                <Text variant="label">Destinations populaires</Text>
                {POPULAR.map((p) => countryRow(p.code))}
                <Text variant="label">Tous les pays</Text>
                {COUNTRIES.filter((c) => !POPULAR.some((p) => p.code === c.code)).map((c) => countryRow(c.code))}
              </>
            )}
          </>
        ) : (
          <>
            <StepTitle title="Quelles villes ?" hint="Touche les villes dont tu veux voir les lieux." />
            {countries.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {countries.map((c) => <Chip key={c} label={COUNTRY_NAME[c] ?? c} selected={current === c} onPress={() => { setActive(c); setCityQuery(''); }} />)}
              </ScrollView>
            ) : null}
            <Field label={`Chercher une ville en ${COUNTRY_NAME[current ?? ''] ?? 'ce pays'}`} value={cityQuery} onChangeText={setCityQuery} placeholder="Ex. Lisbonne" autoCorrect={false} />
            {cities.length ? <Text variant="muted">{cities.length} ville{cities.length > 1 ? 's' : ''} : {cities.map((c) => c.name).join(', ')}</Text> : null}
            {list.map((c) => <Choice key={c.id} title={c.name} selected={cities.some((x) => x.id === c.id)} onPress={() => toggleCity(c)} />)}
            {!list.length ? <Text variant="muted">Aucune ville trouvée.</Text> : null}
            <Field label="Nom du voyage (facultatif)" value={title} onChangeText={setTitle} placeholder={autoTitle} />
          </>
        )}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line }}>
        <View style={{ padding: space.lg, gap: space.sm, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          <ErrorNote message={error} />
          {step === 'pays' ? <Button label="Continuer" onPress={next} disabled={!countries.length} /> : <Button label="Voir les lieux" onPress={create} loading={busy} disabled={!cities.length} />}
        </View>
      </SafeAreaView>
    </View>
  );
}

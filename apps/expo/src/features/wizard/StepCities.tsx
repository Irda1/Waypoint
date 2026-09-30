import React, { useEffect, useState } from 'react';
import { Text as RNText, View } from 'react-native';
import { ErrorNote, Field, Text } from '../../ui';
import { listCountryCities } from '../../data/places';
import type { CityOption } from '../../data/places';
import { COUNTRY_NAME } from '../../domain/countries.ts';
import { changeNights, nightCount, toggleCity } from '../../domain/wizard.ts';
import type { WizardState } from '../../domain/wizard.ts';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { Choice, RoundButton, StepTitle } from './parts';
import type { StepProps } from './parts';

type Row = CityOption & { featured_rank: number | null };

export function StepCities({ state, update, preferCity }: StepProps<WizardState> & { preferCity?: string | null }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [list, setList] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const nights = nightCount(state);
  const country = state.country ?? '';

  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      void listCountryCities(country, query).then((r) => { if (!alive) return; setList(r.cities); setError(r.error); });
    }, query ? 250 : 0);
    return () => { alive = false; clearTimeout(id); };
  }, [country, query]);

  // Ville venue d'une idée « Envie de… » : cochée d'office une seule fois.
  const [prefDone, setPrefDone] = useState(false);
  useEffect(() => {
    if (prefDone || !preferCity || !list || state.cities.length) return;
    setPrefDone(true);
    const hit = list.find((c) => c.name.toLowerCase() === preferCity.toLowerCase());
    if (hit) toggle(hit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const chosen = new Map(state.cities.map((c, i) => [c.id, i]));

  function toggle(c: Row) {
    const r = toggleCity(state.cities, { id: c.id, name: c.name }, nights);
    setWarn(r.error);
    if (!r.error) update({ ...state, cities: r.cities });
  }

  return (
    <View style={{ gap: space.md }}>
      <StepTitle title={`Quelles villes en ${COUNTRY_NAME[country] ?? 'ce pays'} ?`}
        hint={`${nights} nuit${nights > 1 ? 's' : ''} à répartir. Les nuits se répartissent toutes seules, tu peux les ajuster.`} />

      {state.cities.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label">Ton parcours</Text>
          {state.cities.map((c, i) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{i + 1}. {c.name}</Text>
              </View>
              {state.cities.length > 1 ? (
                <RoundButton label="−" name={`Retirer une nuit à ${c.name}`} disabled={c.nights <= 1} onPress={() => update({ ...state, cities: changeNights(state.cities, i, -1) })} />
              ) : null}
              <View style={{ minWidth: 64, alignItems: 'center' }} accessibilityLiveRegion="polite">
                <Text variant="body" style={{ fontFamily: fonts.sansBold }}>{c.nights}</Text>
                <Text variant="muted" style={{ fontSize: 12 }}>nuit{c.nights > 1 ? 's' : ''}</Text>
              </View>
              {state.cities.length > 1 ? (
                <RoundButton label="+" name={`Ajouter une nuit à ${c.name}`} disabled={!state.cities.some((o, j) => j !== i && o.nights > 1)} onPress={() => update({ ...state, cities: changeNights(state.cities, i, 1) })} />
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text variant="muted">Tu peux aussi continuer sans choisir : « Je choisirai sur place ».</Text>
      )}
      {warn ? <Text variant="muted" style={{ color: colors.warm }} accessibilityLiveRegion="polite">{warn}</Text> : null}

      <Field label="Rechercher une ville" value={query} onChangeText={setQuery} placeholder="Ex. Lisbonne, Porto…" autoCorrect={false} />
      {list === null ? <Text variant="muted">Chargement des villes…</Text> : list.length === 0 ? (
        <Text variant="muted">{query ? 'Aucune ville ne correspond.' : 'Aucune ville en base pour ce pays. Tu peux continuer sans, ou lancer la collecte des villes (voir le guide).'}</Text>
      ) : list.map((c) => {
        const index = chosen.get(c.id);
        return (
          <Choice key={c.id} title={c.name} detail={c.featured_rank != null ? 'Ville phare' : undefined} selected={index !== undefined} onPress={() => toggle(c)}
            right={index !== undefined ? <RNText style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.accent }}>{state.cities[index].nights} nuit{state.cities[index].nights > 1 ? 's' : ''}</RNText> : undefined} />
        );
      })}
      <ErrorNote message={error} />
    </View>
  );
}

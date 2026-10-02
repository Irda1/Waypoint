import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text as RNText, View, useWindowDimensions } from 'react-native';
import { Button, ErrorNote, Field, Text } from '../../ui';
import { RegionMap } from '../regions/RegionMap';
import { listCountryCities, listCountryCityPoints } from '../../data/places';
import type { CityOption, CityPoint } from '../../data/places';
import { Flag } from '../../ui/Flag';
import { COUNTRY_NAME } from '../../domain/countries.ts';
import { changeNights, nightCount, toggleCity } from '../../domain/wizard.ts';
import type { WizardState } from '../../domain/wizard.ts';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { Choice, RoundButton, StepTitle } from './parts';
import type { StepProps } from './parts';
import { ViewToggle } from './ViewToggle';

type Row = CityOption & { featured_rank: number | null };

export function StepCities({ state, update, preferCity }: StepProps<WizardState> & { preferCity?: string | null }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [list, setList] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [points, setPoints] = useState<CityPoint[]>([]);
  const nights = nightCount(state);
  const country = state.country ?? '';

  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      void listCountryCities(country, query).then((r) => { if (!alive) return; setList(r.cities); setError(r.error); });
    }, query ? 250 : 0);
    return () => { alive = false; clearTimeout(id); };
  }, [country, query]);

  useEffect(() => {
    let alive = true;
    void listCountryCityPoints(country).then((r) => { if (alive) setPoints(r.points); });
    return () => { alive = false; };
  }, [country]);

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

  const selected = useMemo(() => state.cities.map((c, i) => ({ id: c.id, order: i + 1 })), [state.cities]);
  function toggleById(id: number) {
    const p = points.find((x) => x.id === id);
    if (p) toggle({ id: p.id, name: p.name } as Row);
  }

  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const map = (
    <View style={{ flex: 1, minHeight: 280, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
      <RegionMap country={country} cities={points} selected={selected} onToggle={toggleById} />
      <ViewToggle showing="visual" onPress={() => setShowList(true)} listLabel="Afficher la liste des villes" backLabel="Revenir à la carte" backIcon="🗺" />
    </View>
  );
  const route = (
    <>
      {state.cities.length > 0 ? (
        <View style={{ gap: space.xs }}>
          <Text variant="label">Ton parcours</Text>
          <ScrollView horizontal={!wide} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={wide ? undefined : { flexGrow: 0 }}>
          {state.cities.map((c, i) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
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
          </ScrollView>
        </View>
      ) : (
        <Text variant="muted">Tu peux aussi continuer sans choisir : « Je choisirai sur place ».</Text>
      )}
      {warn ? <Text variant="muted" style={{ color: colors.warm }} accessibilityLiveRegion="polite">{warn}</Text> : null}

    </>
  );
  const search = (
    <>
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
    </>
  );

  // La carte reste montée (cachée) quand on ouvre la liste : on retrouve la même vue en revenant.
  const zone = (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: showList ? 'none' : 'flex' }}>{map}</View>
      {showList ? (
        <View style={{ gap: space.md }}>
          <View style={{ minHeight: 56, justifyContent: 'center' }}>
            <ViewToggle showing="list" onPress={() => setShowList(false)} listLabel="Afficher la liste des villes" backLabel="Revenir à la carte" backIcon="🗺" />
          </View>
          {search}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ gap: space.sm, flex: 1 }}>
      <StepTitle title={`Quelles villes en ${COUNTRY_NAME[country] ?? 'ce pays'} ?`}
        hint={`${nights} nuit${nights > 1 ? "s" : ""} à répartir. Touche une région sur la carte, puis les villes à visiter : les nuits se répartissent toutes seules.`} />
      {state.country ? <Flag code={state.country} width={30} /> : null}
      {wide ? (
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'stretch', flex: 1 }}>
          <View style={{ flex: 7, minWidth: 0 }}>{zone}</View>
          <View style={{ flex: 3, minWidth: 260, gap: space.md }}>{route}</View>
        </View>
      ) : (
        <>{zone}{route}</>
      )}
      <ErrorNote message={error} />
    </View>
  );
}

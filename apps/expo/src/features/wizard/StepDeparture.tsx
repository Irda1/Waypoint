import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Card, Field, Text } from '../../ui';
import { cityCoords, searchHomeCities } from '../../data/places';
import type { HomeCity } from '../../data/places';
import type { WizardState } from '../../domain/wizard.ts';
import { sameCity } from '../../domain/wizard.ts';
import { COUNTRY_NAME } from '../../domain/countries.ts';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/tokens';
import { Choice, StepTitle } from './parts';
import { FlightPicker } from '../trip/FlightPicker';
import type { StepProps } from './parts';

type Home = NonNullable<WizardState['home']>;

// Villes de départ les plus courantes, avec leur grand aéroport (code IATA affiché).
const POPULAR: (Home & { iata: string })[] = [
  { name: 'Paris', country_code: 'FR', lat: 48.8566, lng: 2.3522, iata: 'CDG · ORY' },
  { name: 'Lyon', country_code: 'FR', lat: 45.764, lng: 4.8357, iata: 'LYS' },
  { name: 'Marseille', country_code: 'FR', lat: 43.2965, lng: 5.3698, iata: 'MRS' },
  { name: 'Nice', country_code: 'FR', lat: 43.7102, lng: 7.262, iata: 'NCE' },
  { name: 'Toulouse', country_code: 'FR', lat: 43.6047, lng: 1.4442, iata: 'TLS' },
  { name: 'Bordeaux', country_code: 'FR', lat: 44.8378, lng: -0.5792, iata: 'BOD' },
  { name: 'Nantes', country_code: 'FR', lat: 47.2184, lng: -1.5536, iata: 'NTE' },
  { name: 'Lille', country_code: 'FR', lat: 50.6292, lng: 3.0573, iata: 'LIL' },
  { name: 'Bruxelles', country_code: 'BE', lat: 50.8503, lng: 4.3517, iata: 'BRU' },
  { name: 'Genève', country_code: 'CH', lat: 46.2044, lng: 6.1432, iata: 'GVA' },
  { name: 'Londres', country_code: 'GB', lat: 51.5074, lng: -0.1278, iata: 'LHR · LGW' },
  { name: 'Montréal', country_code: 'CA', lat: 45.5017, lng: -73.5673, iata: 'YUL' },
];

/** Étape « D'où pars-tu ? » : ville de départ, puis temps de vol et prix estimés vers la première ville du voyage. */
export function StepDeparture({ state, update }: StepProps<WizardState>) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [hits, setHits] = useState<HomeCity[]>([]);
  const [coords, setCoords] = useState<Map<number, { lat: number; lng: number }>>(new Map());
  const [searching, setSearching] = useState(false);
  const home = state.home;
  const first = state.cities[0], last = state.cities[state.cities.length - 1];

  useEffect(() => { void cityCoords(state.cities.map((c) => c.id)).then(setCoords); }, [state.cities]);
  useEffect(() => {
    if (text.trim().length < 2) { setHits([]); return; }
    let alive = true;
    const id = setTimeout(() => { void searchHomeCities(text).then((r) => { if (alive) setHits(r); }); }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [text]);
  // Petit temps de recherche à chaque nouveau départ : l'estimation apparaît ensuite.
  useEffect(() => {
    if (!home) return;
    setSearching(true);
    const id = setTimeout(() => setSearching(false), 900);
    return () => clearTimeout(id);
  }, [home?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // La première ville du voyage ne peut pas être la ville de départ : elle est grisée dans les listes.
  const isFirst = (name: string) => !!first && sameCity(name, first.name);
  const firstNote = first ? `Première ville du voyage : choisis une autre ville de départ` : '';
  const pick = (h: Home) => { update({ ...state, home: { name: h.name, country_code: h.country_code, lat: h.lat, lng: h.lng } }); setText(''); setHits([]); };

  const firstAt = first ? coords.get(first.id) : undefined, lastAt = last ? coords.get(last.id) : undefined;

  return (
    <View style={{ gap: space.md }}>
      <StepTitle title="D'où pars-tu ?" hint="Pour estimer le vol et préparer la recherche des billets. Tu peux passer cette étape." />

      {home ? (
        <Card>
          <Text variant="label">Départ · {home.name}</Text>
          {first && isFirst(home.name) ? <Text variant="body" style={{ color: colors.warm }} accessibilityRole="alert">{home.name} est la première ville de ton voyage : on ne peut pas en partir. Touche « Changer la ville de départ » ci-dessous.</Text>
            : !first ? <Text variant="muted">Choisis des villes à l'étape précédente pour estimer le vol.</Text>
            : searching || !firstAt ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }} accessibilityLiveRegion="polite">
                <ActivityIndicator color={colors.accent} />
                <Text variant="muted">Recherche des vols vers {first.name}…</Text>
              </View>
            ) : (
              <FlightPicker home={home} air={home.air} first={{ name: first.name, ...firstAt }} last={last && lastAt ? { name: last.name, ...lastAt } : null}
                start={state.start} end={state.end} adults={state.travelers} onAir={(air) => update({ ...state, home: { ...home, air } })} />
            )}
          <Button label="Changer la ville de départ" variant="ghost" onPress={() => update({ ...state, home: null })} />
        </Card>
      ) : (
        <>
          <Field label="Chercher une ville" value={text} onChangeText={setText} placeholder="Ex. Strasbourg, Rennes…" autoCorrect={false} />
          {hits.map((c) => <Choice key={c.id} title={c.name} detail={isFirst(c.name) ? firstNote : COUNTRY_NAME[c.country_code] ?? c.country_code} disabled={isFirst(c.name)} onPress={() => pick(c)} />)}
          {!hits.length ? (
            <>
              <Text variant="label">Départs les plus courants</Text>
              {POPULAR.map((p) => <Choice key={p.name} title={p.name} detail={isFirst(p.name) ? firstNote : `${COUNTRY_NAME[p.country_code] ?? p.country_code} · ${p.iata}`} disabled={isFirst(p.name)} onPress={() => pick(p)} />)}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

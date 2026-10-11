import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, Field, Text } from '../../ui';
import { searchHomeCities } from '../../data/places';
import type { HomeCity } from '../../data/places';
import type { TripData } from '../../data/useTrip';
import type { AirPrefs } from '../../domain/flights.ts';
import { FlightPicker } from './FlightPicker';
import { COUNTRY_NAME } from '../../domain/countries.ts';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';

/** Ville de départ : celle choisie pour ce voyage (assistant ou carte Vols), sinon la dernière choisie sur l'appareil. */
export const HOME_KEY = 'waypoint.home';
export const tripHomeKey = (tripId: string) => `waypoint.home.${tripId}`;
interface Home { name: string; country_code: string; lat: number; lng: number; air?: AirPrefs }

/** Vols : choisis ta ville de départ une fois, puis ouvre la recherche Google Flights déjà remplie (aucun prix n'est lu ici). */
export function FlightsCard({ data }: { data: TripData }) {
  const { colors } = useTheme();
  const [home, setHome] = useState<Home | null>(null);
  const [changing, setChanging] = useState(false);
  const [text, setText] = useState('');
  const [hits, setHits] = useState<HomeCity[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void (async () => {
      const v = (await AsyncStorage.getItem(tripHomeKey(data.trip.id)).catch(() => null)) ?? (await AsyncStorage.getItem(HOME_KEY).catch(() => null));
      if (v) { try { setHome(JSON.parse(v) as Home); } catch { /* ignoré */ } }
    })();
  }, [data.trip.id]);
  useEffect(() => {
    // On cherche tant qu'aucune ville de départ n'est choisie, ou quand on veut la changer.
    if (!(changing || !home) || text.trim().length < 2) { setHits([]); return; }
    let alive = true;
    const id = setTimeout(() => { void searchHomeCities(text).then((r) => { if (alive) setHits(r); }); }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [text, changing, home]);

  // Petit temps de « recherche » à chaque nouveau départ : les liens et estimations apparaissent ensuite.
  useEffect(() => {
    if (!home) return;
    setSearching(true);
    const id = setTimeout(() => setSearching(false), 600);
    return () => clearTimeout(id);
  }, [home?.name, data.destinations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const dests = [...data.destinations].sort((a, b) => a.position - b.position);
  const first = dests[0], last = dests[dests.length - 1];
  if (!first) return null;
  function save(h: Home) {
    setHome(h);
    void AsyncStorage.setItem(HOME_KEY, JSON.stringify(h)).catch(() => {});
    void AsyncStorage.setItem(tripHomeKey(data.trip.id), JSON.stringify(h)).catch(() => {});
  }
  function pick(c: HomeCity) {
    save({ name: c.name, country_code: c.country_code, lat: c.lat, lng: c.lng });
    setChanging(false); setText(''); setHits([]);
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}><Icon name="plane" size={20} /><Text variant="heading">Vols</Text></View>
      {home && !changing ? (
        <View style={{ gap: space.sm }}>
          <Text variant="muted">Départ : {home.name}</Text>
          {searching ? <Text variant="muted" accessibilityLiveRegion="polite">Recherche des vols…</Text> : (
            <FlightPicker home={home} air={home.air} first={first} last={last ?? null} start={data.trip.starts_on} end={data.trip.ends_on} adults={Math.max(1, data.trip.travelers)}
              onAir={(air) => save({ ...home, air })} />
          )}
          <Button label="Changer la ville de départ" variant="ghost" onPress={() => setChanging(true)} />
          <Text variant="muted">Google Flights s'ouvre avec tes dates : les vrais prix s'y affichent.</Text>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Field label="Ville de départ" value={text} onChangeText={setText} placeholder="Ex. Paris, Lyon, Bruxelles…" autoCorrect={false} />
          {hits.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => pick(c)} style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <Text variant="body">{c.name} · {COUNTRY_NAME[c.country_code] ?? c.country_code}</Text>
            </Pressable>
          ))}
          {home ? <Button label="Annuler" variant="ghost" onPress={() => setChanging(false)} /> : null}
        </View>
      )}
    </Card>
  );
}

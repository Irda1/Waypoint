import React, { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, Field, Text } from '../../ui';
import { searchHomeCities } from '../../data/places';
import type { HomeCity } from '../../data/places';
import type { TripData } from '../../data/useTrip';
import { airportNear } from '../../domain/airports.ts';
import { flightLinks } from '../../domain/flights.ts';
import { COUNTRY_NAME } from '../../domain/countries.ts';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/tokens';

const KEY = 'waypoint.home';
interface Home { name: string; country_code: string; lat: number; lng: number }

/** Aéroport d'une ville : le plus proche à moins de 40 km, sinon le plus proche à moins de 150 km. */
const airportFor = (lat: number, lng: number): string | null => airportNear(lat, lng) ?? airportNear(lat, lng, 150);

/** Vols : choisis ta ville de départ une fois, puis ouvre la recherche Google Flights déjà remplie (aucun prix n'est lu ici). */
export function FlightsCard({ data }: { data: TripData }) {
  const { colors } = useTheme();
  const [home, setHome] = useState<Home | null>(null);
  const [changing, setChanging] = useState(false);
  const [text, setText] = useState('');
  const [hits, setHits] = useState<HomeCity[]>([]);

  useEffect(() => { void AsyncStorage.getItem(KEY).then((v) => { if (v) { try { setHome(JSON.parse(v) as Home); } catch { /* ignoré */ } } }).catch(() => {}); }, []);
  useEffect(() => {
    if (!changing || text.trim().length < 2) { setHits([]); return; }
    let alive = true;
    const id = setTimeout(() => { void searchHomeCities(text).then((r) => { if (alive) setHits(r); }); }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [text, changing]);

  const dests = [...data.destinations].sort((a, b) => a.position - b.position);
  const first = dests[0], last = dests[dests.length - 1];
  if (!first) return null;
  const homeIata = home ? airportFor(home.lat, home.lng) : null;
  // Google Flights comprend les noms de villes (et choisit les aéroports de l'agglomération) : on lui passe les noms.
  const links = home && homeIata ? flightLinks({ home: home.name, arrive: airportFor(first.lat, first.lng) ? first.name : null, leave: last && airportFor(last.lat, last.lng) ? last.name : null, start: data.trip.starts_on, end: data.trip.ends_on }) : [];

  function pick(c: HomeCity) {
    const h = { name: c.name, country_code: c.country_code, lat: c.lat, lng: c.lng };
    setHome(h); setChanging(false); setText(''); setHits([]);
    void AsyncStorage.setItem(KEY, JSON.stringify(h)).catch(() => {});
  }

  return (
    <Card>
      <Text variant="heading">✈ Vols</Text>
      {home && !changing ? (
        <View style={{ gap: space.sm }}>
          <Text variant="muted">Départ : {home.name}{homeIata ? ` (${homeIata})` : ''}</Text>
          {homeIata ? (links.length ? links.map((l) => <Button key={l.url} label={l.label} onPress={() => void Linking.openURL(l.url)} />) : <Text variant="muted">Aucun aéroport proche de {first.name} dans nos données.</Text>) : <Text variant="muted">Aucun aéroport trouvé près de {home.name} : choisis une grande ville proche.</Text>}
          <Button label="Changer la ville de départ" variant="ghost" onPress={() => setChanging(true)} />
          <Text variant="muted">Ouvre Google Flights avec tes dates : les prix s'y affichent.</Text>
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

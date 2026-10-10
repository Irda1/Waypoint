import React, { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, Field, Text } from '../../ui';
import { searchHomeCities } from '../../data/places';
import type { HomeCity } from '../../data/places';
import type { TripData } from '../../data/useTrip';
import { airportNear } from '../../domain/airports.ts';
import { estimateFlight, flightLinks, flightMinutes } from '../../domain/flights.ts';
import { formatDuration } from '../../lib/search';
import { distanceKm } from '../../domain/planning.ts';
import { formatMoney } from '../../lib/format';
import { COUNTRY_NAME } from '../../domain/countries.ts';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';

/** Ville de départ : celle choisie pour ce voyage (assistant ou carte Vols), sinon la dernière choisie sur l'appareil. */
export const HOME_KEY = 'waypoint.home';
export const tripHomeKey = (tripId: string) => `waypoint.home.${tripId}`;
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
  const homeIata = home ? airportFor(home.lat, home.lng) : null;
  // Google Flights comprend les noms de villes (et choisit les aéroports de l'agglomération) : on lui passe les noms.
  const arriveIata = airportFor(first.lat, first.lng), leaveIata = last ? airportFor(last.lat, last.lng) : null;
  const links = home && homeIata ? flightLinks({ home: home.name, homeIata, arrive: arriveIata ? { name: first.name, iata: arriveIata } : null, leave: last && leaveIata ? { name: last.name, iata: leaveIata } : null, start: data.trip.starts_on, end: data.trip.ends_on, adults: Math.max(1, data.trip.travelers) }) : [];

  const arriveHasAirport = airportFor(first.lat, first.lng) !== null;
  const leaveHasAirport = last ? airportFor(last.lat, last.lng) !== null : false;
  const km = home ? distanceKm(home, first) : 0;
  const estimate = home && homeIata && arriveHasAirport ? estimateFlight(km) : null;
  const eur = (n: number) => formatMoney(n, 'EUR');

  function pick(c: HomeCity) {
    const h = { name: c.name, country_code: c.country_code, lat: c.lat, lng: c.lng };
    setHome(h); setChanging(false); setText(''); setHits([]);
    void AsyncStorage.setItem(HOME_KEY, JSON.stringify(h)).catch(() => {});
    void AsyncStorage.setItem(tripHomeKey(data.trip.id), JSON.stringify(h)).catch(() => {});
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}><Icon name="plane" size={20} /><Text variant="heading">Vols</Text></View>
      {home && !changing ? (
        <View style={{ gap: space.sm }}>
          <Text variant="muted">Départ : {home.name}{homeIata ? ` (${homeIata})` : ''}</Text>
          {!homeIata ? <Text variant="muted">Aucun aéroport trouvé près de {home.name} : choisis une grande ville avec un aéroport.</Text> : searching ? <Text variant="muted" accessibilityLiveRegion="polite">Recherche des vols…</Text> : (
            <>
              {!arriveHasAirport ? <Text variant="muted" style={{ color: colors.warm }}>{first.name} n'a pas d'aéroport proche : choisis une grande ville voisine comme première étape pour y arriver en avion.</Text> : null}
              {last && last !== first && !leaveHasAirport ? <Text variant="muted" style={{ color: colors.warm }}>{last.name} n'a pas d'aéroport proche : le retour se fera depuis une autre ville.</Text> : null}
              {links.map((l) => <Button key={l.url} label={l.label} onPress={() => void Linking.openURL(l.url)} />)}
              {estimate ? (
                <View style={{ gap: 2 }}>
                  <Text variant="muted" style={{ fontSize: 12.5 }}>Durée ≈ {formatDuration(flightMinutes(km, false))} en direct{estimate.stopover ? ` · ≈ ${formatDuration(flightMinutes(km, true))} avec escale` : ''}</Text>
                  <Text variant="muted" style={{ fontSize: 12.5 }}>{estimate.stopover ? `Le moins cher : ≈ ${eur(estimate.cheapest)} par personne · escale probable` : `≈ ${eur(estimate.cheapest)} par personne · vol direct`}</Text>
                  {estimate.stopover ? <Text variant="muted" style={{ fontSize: 12.5 }}>Sans escale : ≈ {eur(estimate.direct)}</Text> : null}
                  <Text variant="muted" style={{ fontSize: 11.5 }}>Estimation indicative d'après la distance (aller simple, éco), pas un prix réel : vérifie sur Google Flights.</Text>
                </View>
              ) : null}
            </>
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

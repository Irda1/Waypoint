import React from 'react';
import { Linking, View } from 'react-native';
import { Button, Chip, Text } from '../../ui';
import { AIRPORT_NAMES, airportsNear } from '../../domain/airports.ts';
import { estimateFlight, flightLinks, flightMinutes } from '../../domain/flights.ts';
import type { AirPrefs } from '../../domain/flights.ts';
import { distanceKm } from '../../domain/planning.ts';
import { formatMoney } from '../../lib/format';
import { formatDuration } from '../../lib/search';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/tokens';

type Spot = { name: string; lat: number; lng: number };

/** Une rangée d'aéroports à choisir (nom courant si connu, code, distance). */
function Airports({ label, list, value, onPick }: { label: string; list: { iata: string; km: number }[]; value: string; onPick: (iata: string) => void }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {list.map((a) => <Chip key={a.iata} label={`${AIRPORT_NAMES[a.iata] ? `${AIRPORT_NAMES[a.iata]} · ` : ''}${a.iata} · ${a.km} km`} selected={value === a.iata} onPress={() => onPick(a.iata)} />)}
      </View>
    </View>
  );
}

/**
 * Vols du voyage : aller-retour ou aller simple, aéroports de départ, d'arrivée et de retour, durée et prix estimés ≈,
 * puis recherche Google Flights déjà remplie. Les choix sont rendus par `onAir` (gardés avec la ville de départ).
 */
export function FlightPicker({ home, air = {}, first, last, start, end, adults, onAir }: {
  home: Spot; air?: AirPrefs; first: Spot; last: Spot | null; start: string | null; end: string | null; adults: number; onAir: (a: AirPrefs) => void;
}) {
  const { colors } = useTheme();
  const fromList = airportsNear(home.lat, home.lng), toList = airportsNear(first.lat, first.lng);
  const backList = last ? airportsNear(last.lat, last.lng) : toList;
  const pickOf = (list: { iata: string }[], v?: string) => (list.some((a) => a.iata === v) ? v! : list[0]?.iata);
  const from = pickOf(fromList, air.from), to = pickOf(toList, air.to), back = pickOf(backList, air.back);
  const oneWay = !!air.oneWay;
  if (!from) return <Text variant="muted" style={{ color: colors.warm }}>Aucun aéroport à moins de 150 km de {home.name} : choisis une grande ville avec un aéroport.</Text>;
  if (!to) return <Text variant="muted" style={{ color: colors.warm }}>{first.name} n'a pas d'aéroport proche : choisis une grande ville voisine comme première étape pour y arriver en avion.</Text>;

  const km = distanceKm(home, first);
  const est = estimateFlight(km);
  const flights = (oneWay ? 1 : 2) * Math.max(1, adults);
  const eur = (n: number) => formatMoney(n, 'EUR');
  const links = flightLinks({ home: home.name, homeIata: from, arrive: { name: first.name, iata: to }, leave: last && back ? { name: last.name, iata: back } : null, start, end, adults, oneWay });

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
        <Chip label="Aller-retour" selected={!oneWay} onPress={() => onAir({ ...air, oneWay: false })} />
        <Chip label="Aller simple" selected={oneWay} onPress={() => onAir({ ...air, oneWay: true })} />
      </View>
      <Airports label={`Aéroport de départ · ${home.name}`} list={fromList} value={from} onPick={(v) => onAir({ ...air, from: v })} />
      <Airports label={`Arrivée · près de ${first.name}`} list={toList} value={to} onPick={(v) => onAir({ ...air, to: v })} />
      {!oneWay && last && back ? <Airports label={`Retour depuis · près de ${last.name}`} list={backList} value={back} onPick={(v) => onAir({ ...air, back: v })} /> : null}
      {!oneWay && last && !back ? <Text variant="muted" style={{ color: colors.warm }}>{last.name} n'a pas d'aéroport proche : le retour se fera depuis une autre ville.</Text> : null}
      <View style={{ gap: space.xs }}>
        <Text variant="heading">{home.name} → {first.name}</Text>
        <Text variant="body">Vol ≈ {formatDuration(flightMinutes(km, false))} en direct{est.stopover ? `, ≈ ${formatDuration(flightMinutes(km, true))} avec escale` : ''}</Text>
        <Text variant="body">À partir de ≈ {eur(est.cheapest)} par personne et par vol (éco){flights > 1 ? ` · ≈ ${eur(est.cheapest * flights)} ${oneWay ? 'aller simple' : 'aller-retour'}${adults > 1 ? ` pour ${adults}` : ''}` : ''}</Text>
        <Text variant="muted" style={{ fontSize: 12 }}>Estimation d'après la distance, pas un prix réel : Google Flights affiche les vrais prix du moment.</Text>
      </View>
      {links.map((l) => <Button key={l.url} label={l.label} icon="plane" onPress={() => void Linking.openURL(l.url)} />)}
    </View>
  );
}

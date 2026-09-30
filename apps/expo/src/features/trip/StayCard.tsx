import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { daysForStay, nightsByStay } from '../../domain/stays.ts';
import { addStay, removeStay } from '../../data/stays';
import { searchPlaces } from '../../data/places';
import type { PlaceHit } from '../../data/places';
import type { TripData } from '../../data/useTrip';

/** Hébergements du voyage : on choisit un lieu de la base (hôtels, auberges…) et il est rattaché aux jours de sa ville. */
export function StayCard({ data, onChanged }: { data: TripData; onChanged: () => void }) {
  const { colors } = useTheme();
  const [choosing, setChoosing] = useState(false);
  const [cityId, setCityId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [busy, setBusy] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cities = data.destinations;
  const city = cities.find((c) => c.city_id === cityId) ?? cities[0];
  const nights = nightsByStay(data.days);

  useEffect(() => {
    if (!choosing || !city || city.collection_status !== 'ready') { setHits(null); return; }
    let alive = true;
    const id = setTimeout(async () => {
      const res = await searchPlaces({ cityId: city.city_id, text, categories: null, kind: 'lodging' });
      if (!alive) return;
      setHits(res.places);
      setError(res.error);
    }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [choosing, city?.city_id, city?.collection_status, text]); // eslint-disable-line react-hooks/exhaustive-deps -- suivi par contenu

  async function pick(place: PlaceHit) {
    if (!city) return;
    setBusy(place.id);
    const err = await addStay({ tripId: data.trip.id, place, cityId: city.city_id, dayIds: daysForStay(data.days, city.city_id, cities.length) });
    setBusy(null);
    setError(err);
    if (!err) { setChoosing(false); setText(''); onChanged(); }
  }

  async function remove(id: string) {
    setBusy(id);
    setError(await removeStay(id));
    setBusy(null);
    onChanged();
  }

  return (
    <Card>
      <Text variant="label">Hébergement</Text>
      {data.stays.length === 0 && !choosing ? (
        <Text variant="muted">Aucun hébergement : ajoute-en un pour voir les trajets depuis et vers l'hébergement dans chaque journée.</Text>
      ) : null}
      {data.stays.map((s) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{s.name}</Text>
            <Text variant="muted">{[s.address, nights.get(s.id) ? `${nights.get(s.id)} nuit${nights.get(s.id)! > 1 ? 's' : ''}` : 'aucune nuit rattachée'].filter(Boolean).join(' · ')}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${s.name}`} disabled={busy === s.id} onPress={() => remove(s.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text2 }}>Retirer</RNText>
          </Pressable>
        </View>
      ))}
      {choosing ? (
        cities.length === 0 ? <Text variant="muted">Choisis d'abord une destination.</Text> : (
          <>
            {cities.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {cities.map((c) => <Chip key={c.city_id} label={c.name} selected={c.city_id === city?.city_id} onPress={() => setCityId(c.city_id)} />)}
              </ScrollView>
            ) : null}
            {city?.collection_status !== 'ready' ? (
              <Text variant="muted">Les lieux de {city?.name} ne sont pas encore collectés : ouvre « Ajouter un lieu » dans un jour pour lancer la collecte.</Text>
            ) : (
              <>
                <Field label={`Rechercher un hébergement à ${city.name}`} value={text} onChangeText={setText} placeholder="Ex. hôtel, auberge, nom…" autoCorrect={false} />
                {hits === null ? <Text variant="muted">Recherche…</Text> : hits.length === 0 ? <Text variant="muted">Aucun hébergement ne correspond.</Text> : hits.map((h) => (
                  <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{h.name}</Text>
                      {h.address ? <Text variant="muted">{h.address}</Text> : null}
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Choisir ${h.name}`} disabled={busy === h.id} onPress={() => pick(h)}
                      style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: 999, justifyContent: 'center', backgroundColor: colors.accent, opacity: busy === h.id ? 0.5 : 1 }}>
                      <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.onAccent }}>Choisir</RNText>
                    </Pressable>
                  </View>
                ))}
                <Text variant="muted" style={{ fontSize: 12 }}>Données de lieux : © contributeurs d'OpenStreetMap (licence ODbL).</Text>
              </>
            )}
          </>
        )
      ) : null}
      <ErrorNote message={error} />
      <Button label={choosing ? 'Fermer' : 'Ajouter un hébergement'} variant="ghost" onPress={() => { setChoosing((v) => !v); setError(null); }} />
    </Card>
  );
}

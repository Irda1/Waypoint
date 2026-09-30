import React, { useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, Share, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { useRequireAuth } from '../../src/auth/useRequireAuth';
import { Button, Card, Columns, ErrorNote, Field, Screen, Text } from '../../src/ui';
import { useTrip } from '../../src/data/useTrip';
import { addDay, addDestination, createInvite, removeDestination } from '../../src/data/trips';
import type { CityOption } from '../../src/data/places';
import { CityPicker } from '../../src/features/trip/CityPicker';
import { DayCard } from '../../src/features/trip/DayCard';
import { WeatherCard } from '../../src/features/trip/WeatherCard';
import { useForecasts } from '../../src/data/weather';
import { ProgramCard } from '../../src/features/trip/ProgramCard';
import { BudgetCard } from '../../src/features/trip/BudgetCard';
import { AddExpenseCard } from '../../src/features/trip/AddExpenseCard';
import { formatDay, isIsoDate } from '../../src/lib/format';
import { photoKeyFor } from '../../src/lib/photoKey';
import { photos } from '../../src/theme/photos';
import { fonts, radius, space } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';

const STATUS = { connecting: 'Connexion en direct…', live: 'Synchronisé en direct', offline: 'Hors ligne : reprise à la reconnexion' } as const;

// Textes posés sur la photo : toujours clairs, quel que soit le mode du téléphone.
const ON_PHOTO = '#F4EFE6';
const ON_PHOTO_SOFT = 'rgba(245, 245, 242, 0.82)';
// Sable clair pour les petits titres posés sur photo (l'accent du thème clair est trop sombre ici).
const ON_PHOTO_ACCENT = '#FFD08A';

function lodgingOf(stayId: string | null, stays: { id: string; name: string; address: string | null; lat: number | null; lng: number | null }[]) {
  const st = stayId ? stays.find((x) => x.id === stayId) : undefined;
  return st && st.lat != null && st.lng != null ? { name: st.name || 'Hébergement', address: st.address, lat: st.lat, lng: st.lng } : null;
}

export default function TripScreen() {
  const guard = useRequireAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { data, error, loading, status, reload } = useTrip(String(id));
  const [newDay, setNewDay] = useState('');
  const [addingDay, setAddingDay] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [editingDest, setEditingDest] = useState(false);
  const [destError, setDestError] = useState<string | null>(null);
  // Stable entre deux rendus : le sélecteur de lieux en dépend.
  const destinationOptions = useMemo<CityOption[]>(
    () => (data?.destinations ?? []).map((d) => ({ id: d.city_id, name: d.name, names: [d.name], country_code: d.country_code, collection_status: d.collection_status })),
    [data?.destinations],
  );

  const spots = useMemo(() => (data?.destinations ?? []).map((d) => ({ id: d.city_id, lat: d.lat, lng: d.lng })), [data?.destinations]);
  const weather = useForecasts(spots);

  if (guard) return guard;
  if (loading) return <Screen><Text variant="muted">Chargement du voyage…</Text></Screen>;
  if (error || !data) {
    return <Screen><ErrorNote message={error ?? 'Voyage introuvable.'} /><Button label="Retour à mes voyages" onPress={() => router.replace('/')} /></Screen>;
  }

  const active = data.members.filter((m) => !m.left_at);
  const travelers = Math.max(1, active.length);
  const { trip } = data;
  const destNames = destinationOptions.map((d) => d.name).join(' · ');
  const destDetail = data.destinations.map((d) => (d.nights > 0 ? `${d.name} (${d.nights} nuit${d.nights > 1 ? 's' : ''})` : d.name)).join(' → ');

  async function changeDestination(action: () => Promise<string | null>) {
    setDestError(await action());
    void reload();
  }
  const dates = trip.starts_on ? `${formatDay(trip.starts_on)}${trip.ends_on ? ` → ${formatDay(trip.ends_on)}` : ''}` : 'Dates à définir';

  async function invite() {
    const res = await createInvite(data!.trip.id);
    setInviteError(res.error);
    if (res.code) {
      const link = Linking.createURL(`/join/${res.code}`);
      await Share.share({ message: `Rejoins « ${data!.trip.title} » sur Waypoint : ${link}\nCode : ${res.code}` });
    }
  }

  async function submitDay() {
    if (!isIsoDate(newDay)) { setDayError('Date au format AAAA-MM-JJ (ex. 2026-10-13).'); return; }
    const err = await addDay(data!.trip.id, newDay);
    setDayError(err);
    if (!err) { setNewDay(''); setAddingDay(false); void reload(); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <ImageBackground source={photos[photoKeyFor(`${trip.title} ${destNames}`)]} resizeMode="cover" style={styles.cover}>
          <View style={styles.veil} pointerEvents="none" />
          <SafeAreaView edges={['top']} style={styles.coverInner}>
            <View style={styles.coverBar}>
              <Pressable accessibilityRole="button" accessibilityLabel="Retour à mes voyages" onPress={() => router.replace('/')} style={styles.glass}>
                <RNText style={styles.glassLabel}>← Mes voyages</RNText>
              </Pressable>
              <View style={styles.glass} accessibilityLiveRegion="polite">
                <RNText style={styles.glassLabel}>{STATUS[status]}</RNText>
              </View>
            </View>
            <View style={styles.coverText}>
              <RNText style={[styles.eyebrow, { color: ON_PHOTO_ACCENT }]}>
                {destNames ? `${destNames} · ` : ''}{data.days.length} jour{data.days.length > 1 ? 's' : ''} · {active.length} voyageur{active.length > 1 ? 's' : ''}
              </RNText>
              <RNText style={styles.poster} accessibilityRole="header">{trip.title}</RNText>
              <RNText style={styles.lead}>{dates}</RNText>
            </View>
          </SafeAreaView>
        </ImageBackground>

        <View style={styles.page}>
          <Card>
            <Text variant="label">Voyageurs</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {active.map((m) => {
                const name = m.profiles?.display_name ?? 'Voyageur';
                return (
                  <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={[styles.avatar, { backgroundColor: m.color }]}>
                      <RNText style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</RNText>
                    </View>
                    <Text variant="body">{name}{m.user_id === session?.user.id ? ' (toi)' : ''}</Text>
                  </View>
                );
              })}
            </View>
            <ErrorNote message={inviteError} />
            <Button label="Inviter un ami" variant="ghost" onPress={invite} />
          </Card>

          <Card>
            <Text variant="label">Destinations</Text>
            {destinationOptions.length === 0 ? (
              <Text variant="muted">Aucune destination choisie : ajoutes-en pour retrouver directement les bonnes villes dans la recherche de lieux.</Text>
            ) : !editingDest ? (
              <Text variant="body">{destDetail}</Text>
            ) : null}
            {editingDest ? (
              <CityPicker
                label="Ajouter une ville"
                selected={destinationOptions}
                onAdd={(c) => changeDestination(() => addDestination(trip.id, c.id, destinationOptions.length))}
                onRemove={(cityId) => changeDestination(() => removeDestination(trip.id, cityId))}
              />
            ) : null}
            <ErrorNote message={destError} />
            <Button label={editingDest ? 'Terminer' : destinationOptions.length ? 'Modifier les destinations' : 'Choisir une destination'} variant="ghost" onPress={() => setEditingDest((v) => !v)} />
          </Card>

          <Button label="Voir la carte" onPress={() => router.push({ pathname: '/map/[id]', params: { id: trip.id } })} />

          <WeatherCard destinations={data.destinations} forecasts={weather.forecasts} loading={weather.loading} error={weather.error} start={trip.starts_on} end={trip.ends_on} />

          <ProgramCard data={data} onApplied={reload} />

          <Text variant="label">Au programme</Text>
          {data.days.length === 0 ? <Card><Text variant="muted">Aucun jour pour l'instant. Ajoute le premier ci-dessous.</Text></Card> : null}
          <Columns>
            {data.days.map((d, index) => (
              <DayCard key={d.id} tripId={trip.id} tripTitle={trip.title} destinations={destinationOptions} day={d} number={index + 1} items={data.items} places={data.places} expenses={data.expenses} travelers={travelers} forecast={weather.forecasts.get(d.city_id ?? data.destinations[0]?.city_id ?? -1) ?? null} lodging={lodgingOf(d.stay_id, data.stays)} onChanged={reload} />
            ))}
          </Columns>

          {addingDay ? (
            <Card>
              <Text variant="heading">Ajouter un jour</Text>
              <Field label="Date" value={newDay} onChangeText={setNewDay} placeholder="2026-10-13" />
              <ErrorNote message={dayError} />
              <Button label="Ajouter le jour" onPress={submitDay} />
              <Button label="Annuler" variant="ghost" onPress={() => { setAddingDay(false); setDayError(null); }} />
            </Card>
          ) : (
            <Button label="+ Ajouter un jour" variant="ghost" onPress={() => setAddingDay(true)} />
          )}

          <BudgetCard data={data} />
          {session ? <AddExpenseCard tripId={trip.id} currency={trip.currency} userId={session.user.id} onChanged={reload} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { minHeight: 400, width: '100%' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 9, 11, 0.5)' },
  coverInner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.xl, minHeight: 400, width: '100%', maxWidth: 880, alignSelf: 'center' },
  coverBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  glass: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: 'rgba(7, 9, 11, 0.45)', borderWidth: 1, borderColor: 'rgba(245, 245, 242, 0.25)' },
  glassLabel: { fontFamily: fonts.sansSemi, fontSize: 13, color: ON_PHOTO },
  coverText: { gap: space.sm, alignItems: 'flex-start', marginTop: 96 },
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase' },
  poster: { fontFamily: fonts.serif, fontSize: 46, lineHeight: 50, color: ON_PHOTO },
  lead: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 23, color: ON_PHOTO_SOFT },
  page: { width: '100%', maxWidth: 880, alignSelf: 'center', padding: space.lg, paddingTop: space.xl, gap: space.lg },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: fonts.sansBold, fontSize: 13, color: '#14100A' },
});

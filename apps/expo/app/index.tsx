import React, { useCallback, useEffect, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useRequireAuth } from '../src/auth/useRequireAuth';
import { Button, Card, Columns, ErrorNote, Field, Text } from '../src/ui';
import { listTrips } from '../src/data/trips';
import type { TripSummary } from '../src/data/trips';
import { formatDay, tripStatusLabel } from '../src/lib/format';
import { todayIso, tripStatus } from '../src/lib/dates';
import { Globe } from '../src/features/globe/Globe';
import { photoKeyFor } from '../src/lib/photoKey';
import { photos } from '../src/theme/photos';
import { fonts, radius, space } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';

// Photo d'ambiance de la maquette (web/index.html), utilisée en couverture de l'accueil.
const horizon = require('../assets/photos/horizon.jpg');

// Textes posés sur la photo : toujours clairs, quel que soit le mode du téléphone.
const ON_PHOTO = '#F4EFE6';
const ON_PHOTO_SOFT = 'rgba(245, 245, 242, 0.82)';
// Sable clair pour les petits titres posés sur photo (l'accent du thème clair est trop sombre ici).
const ON_PHOTO_ACCENT = '#FFD08A';

// Idées de destinations (photos d'ambiance déjà dans l'appli) ; d'autres villes suivront avec leurs photos.
const IDEAS: { key: 'lisbonne' | 'porto' | 'alfama'; name: string; city: string; hint: string }[] = [
  { key: 'lisbonne', name: 'Lisbonne', city: 'Lisbonne', hint: 'Tramways et collines' },
  { key: 'porto', name: 'Porto', city: 'Porto', hint: 'Fleuve et azulejos' },
  { key: 'alfama', name: 'Alfama', city: 'Lisbonne', hint: 'Ruelles et fado' },
];

export default function Home() {
  const guard = useRequireAuth();
  const { colors } = useTheme();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const today = todayIso();

  const refresh = useCallback(async () => {
    const res = await listTrips();
    setTrips(res.trips);
    setError(res.error);
  }, []);
  useEffect(() => { if (!guard) void refresh(); }, [guard, refresh]);

  if (guard) return guard;

  // Prochain départ : le voyage à venir le plus proche.
  const next = (trips ?? [])
    .map((t) => ({ title: t.title, st: tripStatus(t.starts_on, t.ends_on, today) }))
    .flatMap((x) => (x.st.kind === 'upcoming' && x.st.inDays > 0 ? [{ title: x.title, inDays: x.st.inDays }] : []))
    .sort((a, b) => a.inDays - b.inDays)[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <ImageBackground source={horizon} resizeMode="cover" style={styles.hero}>
          <View style={styles.globe} pointerEvents="none"><Globe mode="hero" /></View>
          <View style={styles.veil}>
          <SafeAreaView edges={['top']} style={styles.heroInner}>
            <View style={styles.heroBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Image source={require('../assets/logo.png')} accessibilityLabel="Logo Waypoint" style={{ width: 32, height: 32, borderRadius: 8 }} />
                <RNText style={styles.brand} accessibilityRole="header">Waypoint</RNText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Paramètres" onPress={() => router.push('/settings')} style={styles.glass}>
                <RNText style={styles.glassLabel}>⚙️ Paramètres</RNText>
              </Pressable>
            </View>
            <View style={styles.heroText}>
              <RNText style={[styles.eyebrow, { color: ON_PHOTO_ACCENT }]}>{next ? `Plus que ${next.inDays} jour${next.inDays > 1 ? 's' : ''} avant ${next.title}` : 'Nouveau voyage'}</RNText>
              <RNText style={styles.poster} accessibilityRole="header">Où part-on ?</RNText>
              <RNText style={styles.lead}>Un pays, tes dates, tes envies. Waypoint te propose un programme jour par jour, avec la carte.</RNText>
              <Button label="Démarrer un voyage" onPress={() => router.push('/new-trip')} />
            </View>
          </SafeAreaView>
          </View>
        </ImageBackground>

        <View style={styles.page}>
          <ErrorNote message={error} />

          <Text variant="label">Envie de…</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {IDEAS.map((c) => (
              <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={`Partir à ${c.name}`} onPress={() => router.push({ pathname: '/new-trip', params: { country: 'PT', city: c.city } })}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                <ImageBackground source={photos[c.key]} resizeMode="cover" style={styles.idea} imageStyle={{ borderRadius: radius.card }}>
                  <View style={styles.tripVeil} pointerEvents="none" />
                  <RNText style={styles.ideaName}>{c.name}</RNText>
                  <RNText style={styles.tripDates}>{c.hint}</RNText>
                </ImageBackground>
              </Pressable>
            ))}
          </ScrollView>

          <Text variant="label">{trips && trips.length > 0 ? `Mes voyages · ${trips.length}` : 'Mes voyages'}</Text>
          {trips === null ? <Text variant="muted">Chargement…</Text> : trips.length === 0 ? (
            <Card><Text variant="body">Aucun voyage pour l'instant. Démarre le premier avec le bouton ci-dessus, ou rejoins celui d'un ami avec son lien d'invitation.</Text></Card>
          ) : (
            <Columns>
              {trips.map((t) => (
                <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${t.title}`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}
                  style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.92 : 1 })}>
                  <ImageBackground source={t.cover ? { uri: t.cover.small } : photos[photoKeyFor(t.title)]} resizeMode="cover" style={styles.tripCard} imageStyle={{ borderRadius: radius.card }}>
                    <View style={styles.tripVeil} pointerEvents="none" />
                    <View style={[styles.statusPill, { backgroundColor: colors.accent }]}>
                      <RNText style={[styles.statusLabel, { color: colors.onAccent }]}>{tripStatusLabel(tripStatus(t.starts_on, t.ends_on, today))}</RNText>
                    </View>
                    <View style={{ gap: 2 }}>
                      <RNText style={styles.tripTitle} numberOfLines={2}>{t.title}</RNText>
                      <RNText style={styles.tripDates}>{t.starts_on ? `${formatDay(t.starts_on)}${t.ends_on ? ` → ${formatDay(t.ends_on)}` : ''}` : 'Dates à définir'}</RNText>
                    </View>
                  </ImageBackground>
                </Pressable>
              ))}
            </Columns>
          )}

          <Text variant="label">Rejoindre un voyage</Text>
          <Card>
            <Text variant="muted">Un ami t'a envoyé un code d'invitation ? Entre-le ici.</Text>
            <Field label="Code d'invitation" value={joinCode} onChangeText={(t) => setJoinCode(t.trim())} placeholder="Ex. AB12CD34" autoCapitalize="characters" autoCorrect={false} />
            <Button label="Rejoindre" disabled={joinCode.length < 4} onPress={() => router.push({ pathname: '/join/[code]', params: { code: joinCode } })} />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 500, width: '100%', overflow: 'hidden' },
  veil: { width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.28)' },
  globe: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroInner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.xxl, minHeight: 500, width: '100%', maxWidth: 880, alignSelf: 'center' },
  heroBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.sm },
  brand: { fontFamily: fonts.serif, fontSize: 22, color: ON_PHOTO },
  glass: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: 'rgba(7, 9, 11, 0.45)', borderWidth: 1, borderColor: 'rgba(245, 245, 242, 0.25)' },
  glassLabel: { fontFamily: fonts.sansSemi, fontSize: 14, color: ON_PHOTO },
  heroText: { gap: space.md, alignItems: 'flex-start', marginTop: 32 },
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase' },
  poster: { fontFamily: fonts.serif, fontSize: 56, lineHeight: 60, color: ON_PHOTO },
  lead: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 23, color: ON_PHOTO_SOFT, maxWidth: 440 },
  idea: { width: 148, height: 200, borderRadius: radius.card, overflow: 'hidden', padding: space.md, justifyContent: 'flex-end', backgroundColor: '#101315' },
  ideaName: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, color: ON_PHOTO },
  tripCard: { minHeight: 168, borderRadius: radius.card, overflow: 'hidden', padding: space.lg, justifyContent: 'space-between', backgroundColor: '#101315' },
  tripVeil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.card, backgroundColor: 'rgba(7, 9, 11, 0.5)' },
  statusPill: { alignSelf: 'flex-start', minHeight: 28, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
  statusLabel: { fontFamily: fonts.sansSemi, fontSize: 12.5 },
  tripTitle: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 29, color: ON_PHOTO },
  tripDates: { fontFamily: fonts.sans, fontSize: 14, color: ON_PHOTO_SOFT },
  page: { width: '100%', maxWidth: 880, alignSelf: 'center', padding: space.lg, paddingTop: space.xl, gap: space.lg },
});

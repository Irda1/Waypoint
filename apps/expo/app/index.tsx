import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useRequireAuth } from '../src/auth/useRequireAuth';
import { Button, Card, Columns, ErrorNote, Field, Text } from '../src/ui';
import { savedLabel } from '../src/domain/offlineSnapshot.ts';
import { listTrash, listTrips, restoreTrip } from '../src/data/trips';
import { prefetchTripsOffline } from '../src/data/useTrip';
import type { TripSummary, TrashedTrip } from '../src/data/trips';
import { formatDay, tripStatusLabel } from '../src/lib/format';
import { todayIso, tripStatus } from '../src/lib/dates';
import { Globe } from '../src/features/globe/Globe';
import { ROUTE_BG, routeGlobeOnScreen } from '../src/domain/routeGlobe.ts';
import { COUNTRY_NAME } from '../src/domain/countries.ts';
import { photoKeyFor } from '../src/lib/photoKey';
import { photos } from '../src/theme/photos';
import { fonts, palette, radius, space } from '../src/theme/tokens';
import { useAppearance } from '../src/theme/store';
import { useTheme } from '../src/theme/useTheme';
import { Icon } from '../src/ui/Icon';


// Textes posés sur la photo : toujours clairs, quel que soit le mode du téléphone.
const ON_PHOTO = '#F4EFE6';
const ON_PHOTO_SOFT = 'rgba(245, 245, 242, 0.82)';
// Sable clair pour les petits titres posés sur photo (l'accent du thème clair est trop sombre ici).
const ON_PHOTO_ACCENT = '#FFD08A';
// Titre automatique des voyages « juste les lieux » (mode Simple) : remplacé par un badge sur la carte.
const SIMPLE_PREFIX = 'Lieux · ';

// Idées de destinations (photos d'ambiance déjà dans l'appli) ; d'autres villes suivront avec leurs photos.
const IDEAS: { key: 'lisbonne' | 'porto' | 'alfama'; name: string; city: string; hint: string }[] = [
  { key: 'lisbonne', name: 'Lisbonne', city: 'Lisbonne', hint: 'Tramways et collines' },
  { key: 'porto', name: 'Porto', city: 'Porto', hint: 'Fleuve et azulejos' },
  { key: 'alfama', name: 'Alfama', city: 'Lisbonne', hint: 'Ruelles et fado' },
];

export default function Home() {
  const guard = useRequireAuth();
  const { colors, mode } = useTheme();
  const { accent } = useAppearance();
  // Bandeau : planète sur noir étoilé (Nuit) ou sur sable clair (Jour), textes et tracé accordés au fond.
  const heroAccent = (mode === 'jour' ? colors.accent : palette('nuit', accent).accent).slice(1);
  const H = mode === 'jour'
    ? { text: colors.text, soft: colors.text2, eyebrow: colors.accent, glassBg: colors.surface, glassLine: colors.lineStrong }
    : { text: ON_PHOTO, soft: ON_PHOTO_SOFT, eyebrow: ON_PHOTO_ACCENT, glassBg: 'rgba(7, 9, 11, 0.45)', glassLine: 'rgba(245, 245, 242, 0.25)' };
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [trash, setTrash] = useState<TrashedTrip[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const today = todayIso();

  const refresh = useCallback(async () => {
    const res = await listTrips();
    setTrips(res.trips);
    setError(res.error);
    setSavedAt(res.savedAt ?? null);
    if (!res.savedAt) {
      void listTrash().then((r) => setTrash(r.trips));
      // Copies pour le hors-ligne : les voyages à venir ou en cours d'abord (8 au plus).
      const t = todayIso();
      const ids = res.trips.filter((x) => !x.ends_on || x.ends_on >= t).slice(0, 8).map((x) => x.id);
      void prefetchTripsOffline(ids);
    }
  }, []);
  useEffect(() => { if (!guard) void refresh(); }, [guard, refresh]);

  // Transition « Démarrer un voyage » : l'accueil s'efface en fondu pendant que la planète grossit jusqu'au centre
  // de l'écran ; l'écran suivant s'ouvre en fondu sur la planète 3D. Rien de tout cela si le téléphone réduit les animations.
  const win = useWindowDimensions();
  const [heroSize, setHeroSize] = useState({ w: 0, h: 0 });
  const zoom = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);
  useFocusEffect(useCallback(() => { leaving.current = false; zoom.setValue(0); }, [zoom]));
  const startTrip = useCallback((params?: Record<string, string>) => {
    if (leaving.current) return;
    leaving.current = true;
    const go = () => router.push(params ? { pathname: '/new-trip', params } : '/new-trip');
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (reduce || !heroSize.h) { go(); return; }
      Animated.timing(zoom, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(go);
    });
  }, [zoom, heroSize.h]);

  if (guard) return guard;

  const g = heroSize.h ? routeGlobeOnScreen(heroSize.w, heroSize.h) : { dx: 0, dy: 0, radius: 1 };
  const scale = Math.min(5, Math.max(1.4, (0.44 * Math.min(win.width, win.height)) / g.radius));
  const fadeOut = zoom.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0], extrapolate: 'clamp' });
  const globeMotion = {
    transform: [
      { translateX: zoom.interpolate({ inputRange: [0, 1], outputRange: [0, -scale * g.dx] }) },
      { translateY: zoom.interpolate({ inputRange: [0, 1], outputRange: [0, -scale * g.dy + (win.height - heroSize.h) / 2] }) },
      { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) },
    ],
  };

  // Badge « Nouveau » : le dernier voyage créé, pendant 7 jours.
  const newest = (trips ?? []).reduce<TripSummary | null>((a, t) => (t.created_at && (!a?.created_at || t.created_at > a.created_at) ? t : a), null);
  const newestId = newest?.created_at && Date.now() - Date.parse(newest.created_at) < 7 * 864e5 ? newest.id : null;

  // Prochain départ : le voyage à venir le plus proche.
  const next = (trips ?? [])
    .map((t) => ({ title: t.title, st: tripStatus(t.starts_on, t.ends_on, today) }))
    .flatMap((x) => (x.st.kind === 'upcoming' && x.st.inDays > 0 ? [{ title: x.title, inDays: x.st.inDays }] : []))
    .sort((a, b) => a.inDays - b.inDays)[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: zoom }]} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: ROUTE_BG[mode] }]} onLayout={(e) => setHeroSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <Animated.View style={[styles.globe, globeMotion]} pointerEvents="none"><Globe mode="route" color={heroAccent} theme={mode} /></Animated.View>
          <Animated.View style={[styles.veil, { opacity: fadeOut }]}>
          <SafeAreaView edges={['top']} style={styles.heroInner}>
            <View style={styles.heroBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Image source={require('../assets/logo.png')} accessibilityLabel="Logo Waypoint" style={{ width: 32, height: 32, borderRadius: 8 }} />
                <RNText style={[styles.brand, { color: H.text }]} accessibilityRole="header">Waypoint</RNText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Paramètres" onPress={() => router.push('/settings')} style={[styles.glass, { backgroundColor: H.glassBg, borderColor: H.glassLine }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="settings" size={16} color={H.text} /><RNText style={[styles.glassLabel, { color: H.text }]}>Paramètres</RNText></View>
              </Pressable>
            </View>
            <View style={styles.heroText}>
              <RNText style={[styles.eyebrow, { color: H.eyebrow }]}>{next ? `Plus que ${next.inDays} jour${next.inDays > 1 ? 's' : ''} avant ${next.title}` : 'Nouveau voyage'}</RNText>
              <RNText style={[styles.poster, { color: H.text }]} accessibilityRole="header">Où part-on ?</RNText>
              <RNText style={[styles.lead, { color: H.soft }]}>Un pays, tes dates, tes envies. Waypoint te propose un programme jour par jour, avec la carte.</RNText>
              <Button label="Démarrer un voyage" onPress={() => startTrip()} />
            </View>
          </SafeAreaView>
          </Animated.View>
        </View>

        {/* La page se pose sur le bandeau comme une feuille arrivée par-dessus la planète. */}
        <Animated.View style={[styles.sheet, { backgroundColor: colors.bg, opacity: fadeOut }]}>
        <View style={styles.page}>
          <ErrorNote message={error} />
          {savedAt ? <Text variant="muted">Hors connexion : voyages tels qu'ils étaient {savedLabel(savedAt)}.</Text> : null}

          <Text variant="label">Envie de…</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {IDEAS.map((c) => (
              <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={`Partir à ${c.name}`} onPress={() => startTrip({ country: 'PT', city: c.city })}
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
                <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${t.title}${t.cities?.length ? `, ${t.cities.join(', ')}` : ''}`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}
                  style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.92 : 1 })}>
                  <ImageBackground source={t.cover ? { uri: t.cover.small } : photos[photoKeyFor(t.title)]} resizeMode="cover" style={styles.tripCard} imageStyle={{ borderRadius: radius.card }}>
                    <View style={styles.tripVeil} pointerEvents="none" />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                    {t.title.startsWith(SIMPLE_PREFIX) ? (
                      <View style={[styles.statusPill, { backgroundColor: ON_PHOTO }]}>
                        <RNText style={[styles.statusLabel, { color: '#0E2A35' }]}>Juste les lieux</RNText>
                      </View>
                    ) : (
                      <View style={[styles.statusPill, { backgroundColor: colors.accent }]}>
                        <RNText style={[styles.statusLabel, { color: colors.onAccent }]}>{tripStatusLabel(tripStatus(t.starts_on, t.ends_on, today))}</RNText>
                      </View>
                    )}
                    {t.id === newestId ? (
                      <View style={[styles.statusPill, { backgroundColor: ON_PHOTO, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Icon name="sparkles" size={13} color="#0E2A35" />
                        <RNText style={[styles.statusLabel, { color: '#0E2A35' }]}>Nouveau</RNText>
                      </View>
                    ) : null}
                    </View>
                    <View style={{ gap: 2 }}>
                      <RNText style={styles.tripEyebrow} numberOfLines={1}>
                        {[t.cities?.length ? (t.country_code ? COUNTRY_NAME[t.country_code] : null) ?? t.title.replace(SIMPLE_PREFIX, '') : null, t.starts_on ? `${formatDay(t.starts_on)}${t.ends_on ? ` → ${formatDay(t.ends_on)}` : ''}` : t.title.startsWith(SIMPLE_PREFIX) ? null : 'Dates à définir'].filter(Boolean).join(' · ')}
                      </RNText>
                      <RNText style={styles.tripTitle} numberOfLines={2}>{t.cities?.length ? t.cities.slice(0, 2).join(' · ') + (t.cities.length > 2 ? ` +${t.cities.length - 2}` : '') : t.title.replace(SIMPLE_PREFIX, '')}</RNText>
                    </View>
                  </ImageBackground>
                </Pressable>
              ))}
            </Columns>
          )}

          {trash.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: showTrash }} onPress={() => setShowTrash(!showTrash)}>
                <Text variant="label">{showTrash ? '▾' : '▸'} Corbeille · {trash.length}</Text>
              </Pressable>
              {showTrash ? (
                <Card>
                  {trash.map((t) => (
                    <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 }}>
                      <Text variant="body" style={{ flex: 1 }}>{t.title}</Text>
                      <Button label="Restaurer" variant="ghost" onPress={async () => { const err = await restoreTrip(t.id); setTrashError(err); if (!err) void refresh(); }} />
                    </View>
                  ))}
                  <ErrorNote message={trashError} />
                </Card>
              ) : null}
            </View>
          ) : null}

          <Text variant="label">Rejoindre un voyage</Text>
          <Card>
            <Text variant="muted">Un ami t'a envoyé un code d'invitation ? Entre-le ici.</Text>
            <Field label="Code d'invitation" value={joinCode} onChangeText={(t) => setJoinCode(t.trim())} placeholder="Ex. AB12CD34" autoCapitalize="characters" autoCorrect={false} />
            <Button label="Rejoindre" disabled={joinCode.length < 4} onPress={() => router.push({ pathname: '/join/[code]', params: { code: joinCode } })} />
          </Card>
        </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 500, width: '100%', backgroundColor: '#000', zIndex: 1 },
  veil: { width: '100%' },
  globe: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroInner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.xxl + 28, minHeight: 500, width: '100%', maxWidth: 880, alignSelf: 'center' },
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
  tripEyebrow: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: ON_PHOTO_SOFT },
  sheet: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, zIndex: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -6 }, elevation: 6 },
  page: { width: '100%', maxWidth: 880, alignSelf: 'center', padding: space.lg, paddingTop: space.xl, gap: space.lg },
});

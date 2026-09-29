import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useRequireAuth } from '../../src/auth/useRequireAuth';
import { Button, Chip, ErrorNote, Screen, Text } from '../../src/ui';
import { useTrip } from '../../src/data/useTrip';
import { useCategories } from '../../src/data/categories';
import { loadCandidates } from '../../src/data/itinerary';
import { addPlaceItem } from '../../src/data/places';
import { discoverPoints, planPoints, visiblePoints } from '../../src/domain/map.ts';
import type { MapPoint } from '../../src/domain/map.ts';
import { MapCanvas } from '../../src/features/map/MapCanvas';
import { formatMoney } from '../../src/lib/format';
import { formatDuration } from '../../src/lib/search';
import { categoryColors, fonts, radius, space } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';

export default function TripMap() {
  const guard = useRequireAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, mode } = useTheme();
  const categories = useCategories();
  const { data, error, loading, reload } = useTrip(String(id));
  const [day, setDay] = useState<number | null>(null);
  const [discover, setDiscover] = useState(false);
  const [roots, setRoots] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadCandidates>>['candidates'] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cityIds = useMemo(() => [...new Set((data?.days ?? []).map((d) => d.city_id).filter((c): c is number => c != null).concat((data?.destinations ?? []).map((d) => d.city_id)))], [data?.days, data?.destinations]);

  // Les lieux à découvrir se chargent la première fois qu'on les demande.
  useEffect(() => {
    if (!discover || loaded !== null || !cityIds.length) return;
    void loadCandidates(cityIds, categories.rootOf).then((r) => { setLoaded(r.candidates); if (r.error) setProblem(r.error); });
  }, [discover, loaded, cityIds, categories]);

  const plan = useMemo(() => (data ? planPoints({ days: data.days, items: data.items, places: data.places, rootOf: categories.rootOf }) : []), [data, categories]);
  const disc = useMemo(() => {
    if (!data || !loaded) return [];
    const inTrip = new Set(data.items.map((i) => i.place_id).filter((p): p is number => p != null));
    return discoverPoints({ candidates: loaded, inTrip, colorOf: (r) => categoryColors[mode][r] ?? colors.text3 });
  }, [data, loaded, mode, colors.text3]);
  const points = useMemo(() => visiblePoints([...plan, ...disc], { day, discover, roots }), [plan, disc, day, discover, roots]);
  const point: MapPoint | undefined = points.find((p) => p.id === selected);

  if (guard) return guard;
  if (loading) return <Screen><Text variant="muted">Chargement de la carte…</Text></Screen>;
  if (error || !data) return <Screen><ErrorNote message={error ?? 'Voyage introuvable.'} /><Button label="Retour" onPress={() => router.replace('/')} /></Screen>;

  const first = data.destinations[0];
  const start = first ? { lat: first.lat, lng: first.lng, zoom: 11 } : { lat: 20, lng: 0, zoom: 1.5 };
  const dayId = day ? data.days[day - 1]?.id : null;
  const category = point ? categories.byCode.get(point.root)?.name_fr ?? point.root : '';
  const place = point?.placeId != null ? data.places.get(point.placeId) ?? loaded?.find((c) => c.place.id === point.placeId)?.place : undefined;

  async function add() {
    if (!point?.placeId || !dayId) return;
    const last = data!.items.filter((i) => i.day_id === dayId).reduce((m, i) => Math.max(m, i.position), 0);
    setBusy(true); setProblem(null);
    const err = await addPlaceItem({ tripId: data!.trip.id, dayId, placeId: point.placeId, position: last + 1 });
    setBusy(false);
    if (err) { setProblem(err); return; }
    setNotice(`« ${point.label} » ajouté au jour ${day}.`);
    setSelected(null);
    void reload();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        <MapCanvas points={points} selectedId={selected} dark={mode === 'nuit'} start={start} fitKey={`${day}|${discover}`} onSelect={(pid) => { setSelected(pid); setNotice(null); }} />
        <SafeAreaView edges={['top']} pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <View style={{ padding: space.sm, gap: space.sm }} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Retour au voyage" onPress={() => router.replace({ pathname: '/trip/[id]', params: { id: String(id) } })} style={{ minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
                <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text }}>← Voyage</RNText>
              </Pressable>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                <Chip label="Tous les jours" selected={day === null} onPress={() => setDay(null)} />
                {data.days.map((d, i) => <Chip key={d.id} label={`Jour ${i + 1}`} selected={day === i + 1} onPress={() => setDay(i + 1)} />)}
              </ScrollView>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                <Chip label={discover ? 'Lieux à découvrir : oui' : 'Lieux à découvrir'} selected={discover} onPress={() => setDiscover((v) => !v)} />
                {discover ? categories.activityRoots.map((c) => (
                  <Chip key={c.code} label={c.name_fr} selected={roots.includes(c.code)} onPress={() => setRoots((r) => (r.includes(c.code) ? r.filter((x) => x !== c.code) : [...r, c.code]))} />
                )) : null}
              </ScrollView>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line }}>
        <View style={{ padding: space.lg, gap: space.sm, minHeight: 88 }}>
          {point ? (
            <>
              <Text variant="heading">{point.label}</Text>
              <Text variant="muted">
                {[point.kind === 'plan' ? `Jour ${point.day} · étape ${point.order}` : 'À découvrir', category,
                  place?.visit_duration_min ? `≈ ${formatDuration(place.visit_duration_min)}` : null,
                  place?.price_amount != null ? `≈ ${formatMoney(place.price_amount, data.trip.currency)}` : null].filter(Boolean).join(' · ')}
              </Text>
              {point.kind === 'disc' ? (dayId ? <Button label={`Ajouter au jour ${day}`} onPress={add} loading={busy} /> : <Text variant="muted">Choisis un jour en haut pour l'ajouter à ton programme.</Text>) : null}
            </>
          ) : (
            <Text variant="muted" accessibilityLiveRegion="polite">
              {notice ?? (points.length ? `${points.length} repère${points.length > 1 ? 's' : ''} sur la carte. Touche-en un pour le détail.` : discover ? (loaded === null ? 'Chargement des lieux…' : 'Aucun lieu à afficher pour ce filtre.') : 'Rien au programme pour l\'instant. Active « Lieux à découvrir » pour voir des idées.')}
            </Text>
          )}
          <ErrorNote message={problem} />
          <Text variant="muted" style={{ fontSize: 12 }}>Fond de carte : OpenFreeMap · © contributeurs d'OpenStreetMap. Nécessite une connexion.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

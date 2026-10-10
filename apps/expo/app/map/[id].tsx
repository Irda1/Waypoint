import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text as RNText, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useRequireAuth } from '../../src/auth/useRequireAuth';
import { Button, Chip, ErrorNote, Screen, Text } from '../../src/ui';
import { useTrip } from '../../src/data/useTrip';
import { useCategories } from '../../src/data/categories';
import { loadCandidates } from '../../src/data/itinerary';
import { addPlaceItem } from '../../src/data/places';
import { extendCityNow } from '../../src/data/cityCollection';
import { useFavorites } from '../../src/data/favorites';
import { PlaceSheet } from '../../src/features/trip/PlaceSheet';
import { discoverPoints, legendDays, planPoints, searchPoints, visiblePoints } from '../../src/domain/map.ts';
import type { MapPoint } from '../../src/domain/map.ts';
import { MapCanvas } from '../../src/features/map/MapCanvas';
import { SlidingPanel } from '../../src/features/map/SlidingPanel';
import { useBottomInset } from '../../src/features/nav/FloatingNav';
import type { PanelPos } from '../../src/features/map/SlidingPanel';
import { formatMoney } from '../../src/lib/format';
import { mapsUrl } from '../../src/domain/simple.ts';
import { formatDuration } from '../../src/lib/search';
import { categoryColors, fonts, radius, space } from '../../src/theme/tokens';
import { Icon } from '../../src/ui/Icon';
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
  const [onlyFav, setOnlyFav] = useState(false);
  const favorites = useFavorites(String(id));
  const [term, setTerm] = useState('');
  const [focus, setFocus] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  useEffect(() => { if (data?.mode === 'simple') setDiscover(true); }, [data?.mode]);
  const [zoneStep, setZoneStep] = useState(0);
  const [widening, setWidening] = useState<number | null>(null);
  const [panel, setPanel] = useState<PanelPos>('bas');
  const [areaH, setAreaH] = useState(0);
  const [details, setDetails] = useState(false);

  const cityIds = useMemo(() => [...new Set((data?.days ?? []).map((d) => d.city_id).filter((c): c is number => c != null).concat((data?.destinations ?? []).map((d) => d.city_id)))], [data?.days, data?.destinations]);

  // Les lieux à découvrir se chargent la première fois qu'on les demande.
  useEffect(() => {
    if (!(discover || onlyFav || term.trim().length >= 2) || loaded !== null || !cityIds.length) return;
    void loadCandidates(cityIds, categories.rootOf).then((r) => { setLoaded(r.candidates); if (r.error) setProblem(r.error); });
  }, [discover, onlyFav, term, loaded, cityIds, categories]);

  // « Élargir la zone » : rayon x2 puis x3,5 pour chaque ville du voyage, avec un pourcentage réel.
  const ZONE_SCALES = [2, 3.5];
  const widen = async () => {
    const scale = ZONE_SCALES[zoneStep];
    setWidening(0); setProblem(null);
    const fractions = cityIds.map(() => 0);
    const errors: string[] = [];
    await Promise.all(cityIds.map(async (id, i) => {
      const r = await extendCityNow(id, scale, (f) => { fractions[i] = f; setWidening(fractions.reduce((a, b) => a + b, 0) / fractions.length); });
      if (r.error) errors.push(r.error);
    }));
    setWidening(null);
    if (errors.length) setProblem(errors[0]);
    if (errors.length < cityIds.length) { setZoneStep((n) => n + 1); setLoaded(null); }
  };

  const plan = useMemo(() => (data ? planPoints({ days: data.days, items: data.items, places: data.places, rootOf: categories.rootOf }) : []), [data, categories]);
  const disc = useMemo(() => {
    if (!data || !loaded) return [];
    const inTrip = new Set(data.items.map((i) => i.place_id).filter((p): p is number => p != null));
    return discoverPoints({ candidates: loaded, inTrip, colorOf: (r) => categoryColors[mode][r] ?? colors.text3 });
  }, [data, loaded, mode, colors.text3]);
  const shown = useMemo(() => visiblePoints([...plan, ...disc], { day, discover: discover || onlyFav, roots }), [plan, disc, day, discover, onlyFav, roots]);
  const points = useMemo(() => (onlyFav ? shown.filter((p) => p.placeId != null && favorites.ids.has(p.placeId)) : shown), [shown, onlyFav, favorites.ids]);
  const found = useMemo(() => searchPoints([...plan, ...disc], term), [plan, disc, term]);
  const legend = useMemo(() => legendDays(points), [points]);
  const point: MapPoint | undefined = points.find((p) => p.id === selected);
  // Bande du bas seulement quand il y a quelque chose à dire (le chargement est un badge sur la carte).
  const message = notice ?? (points.length === 0 ? (discover ? (loaded === null ? null : 'Aucun lieu à afficher pour ce filtre.') : 'Rien au programme pour l\'instant. Active « Lieux à découvrir » pour voir des idées.') : null);

  const bottomInset = useBottomInset();
  // Web : la page ne doit jamais défiler quand on déplace la carte (sinon la barre du haut part avec).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const els = [document.documentElement, document.body];
    const saved = els.map((e) => e.style.cssText);
    for (const e of els) { e.style.overflow = 'hidden'; e.style.overscrollBehavior = 'none'; }
    document.body.style.position = 'fixed'; document.body.style.inset = '0'; document.body.style.width = '100%';
    return () => { els.forEach((e, i) => { e.style.cssText = saved[i]; }); };
  }, []);

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
      <View style={{ flex: 1 }} onLayout={(e) => setAreaH(e.nativeEvent.layout.height)}>
        <MapCanvas points={points} selectedId={selected} dark={false} start={start} fitKey={`${day}|${discover}`} focusId={focus} onSelect={(pid) => { setSelected(pid); setNotice(null); }} />
        <SafeAreaView edges={['top']} pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <View style={{ padding: space.sm, gap: space.sm }} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Retour au voyage" onPress={() => router.replace({ pathname: '/trip/[id]', params: { id: String(id) } })} style={{ minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="back" size={16} tone="text" /><RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text }}>Voyage</RNText></View>
              </Pressable>
              {data.days.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                <Chip label="Tous les jours" selected={day === null} onPress={() => setDay(null)} />
                {data.days.map((d, i) => <Chip key={d.id} label={`Jour ${i + 1}`} selected={day === i + 1} onPress={() => setDay(i + 1)} />)}
              </ScrollView> : null}
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, minHeight: 44 }}>
              <Icon name="search" size={18} tone="muted" />
              <TextInput accessibilityLabel="Chercher un lieu" value={term} onChangeText={setTerm} placeholder="Chercher un lieu" placeholderTextColor={colors.text3}
                style={{ flex: 1, minHeight: 44, paddingHorizontal: space.sm, fontFamily: fonts.sans, fontSize: 15, color: colors.text }} />
              {term ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" onPress={() => setTerm('')} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="close" size={18} tone="muted" />
                </Pressable>
              ) : null}
            </View>
            {term.trim().length >= 2 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
                {found.length === 0 ? (
                  <Text variant="muted" style={{ padding: space.md }}>{loaded === null ? 'Recherche…' : 'Aucun lieu trouvé.'}</Text>
                ) : found.map((p) => (
                  <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Voir ${p.label} sur la carte`}
                    onPress={() => { if (p.kind === 'disc') setDiscover(true); setDay(null); setSelected(p.id); setFocus(p.id); setNotice(null); setTerm(''); }}
                    style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderTopWidth: 1, borderTopColor: colors.line }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color }} />
                    <View style={{ flex: 1 }}>
                      <RNText numberOfLines={1} style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text }}>{p.label}</RNText>
                      <RNText style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.text3 }}>{p.kind === 'plan' ? `Jour ${p.day} · étape ${p.order}` : 'À découvrir'}</RNText>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                <Chip label="Favoris" icon="heart" selected={onlyFav} onPress={() => setOnlyFav((v) => !v)} />
                <Chip label={discover ? 'Lieux à découvrir : oui' : 'Lieux à découvrir'} selected={discover} onPress={() => setDiscover((v) => !v)} />
                {discover ? categories.activityRoots.map((c) => (
                  <Chip key={c.code} label={c.name_fr} selected={roots.includes(c.code)} onPress={() => setRoots((r) => (r.includes(c.code) ? r.filter((x) => x !== c.code) : [...r, c.code]))} />
                )) : null}
              </ScrollView>
            </View>
          </View>
        </SafeAreaView>
        {!point ? <SlidingPanel containerHeight={areaH} position={panel} onPosition={setPanel} title={`${points.length} lieu${points.length > 1 ? 'x' : ''} sur la carte`}>
          <ScrollView scrollEnabled={panel !== 'bas'}>
            {points.length === 0 ? <Text variant="muted" style={{ padding: space.md }}>Aucun repère à lister.</Text> : points.map((p, i) => (
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Voir ${p.label} sur la carte`}
                onHoverIn={() => setSelected(p.id)}
                onPress={() => { setSelected(p.id); setFocus(p.id); setNotice(null); setPanel('bas'); }}
                style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, backgroundColor: selected === p.id ? colors.surface2 : 'transparent' }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color }} />
                <View style={{ flex: 1 }}>
                  <RNText numberOfLines={1} style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text }}>{p.label}</RNText>
                  <RNText style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.text3 }}>{p.kind === 'plan' ? `Jour ${p.day} · étape ${p.order}` : 'À découvrir'}</RNText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </SlidingPanel> : null}
        {!point && panel === 'bas' ? <View pointerEvents="box-none" style={{ position: 'absolute', left: space.sm, bottom: 72 + space.sm, gap: space.xs, alignItems: 'flex-start' }}>
          {legendOpen ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: space.md, gap: space.xs }}>
              {legend.map((l) => (
                <View key={l.day} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: l.color }} />
                  <RNText style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.text }}>Jour {l.day}</RNText>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ width: 16, borderTopWidth: 3, borderStyle: 'dashed', borderColor: colors.text2 }} />
                <RNText style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.text }}>Trajet entre les étapes du jour</RNText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.text3, marginHorizontal: 3 }} />
                <RNText style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.text }}>Lieu à découvrir</RNText>
              </View>
            </View>
          ) : null}
          {infoOpen ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: space.md, maxWidth: 280 }}>
              <RNText style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.text }}>Fond de carte : OpenFreeMap · © contributeurs d'OpenStreetMap. Lieux : Geoapify. Nécessite une connexion.</RNText>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={legendOpen ? 'Masquer la légende' : 'Afficher la légende'} onPress={() => setLegendOpen((v) => !v)}
              style={{ minHeight: 32, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
              <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: colors.text }}>Légende</RNText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Crédits de la carte" onPress={() => setInfoOpen((v) => !v)}
              style={{ width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
              <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.text }}>i</RNText>
            </Pressable>
            {discover && loaded === null ? (
              <View accessibilityLiveRegion="polite" style={{ minHeight: 32, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
                <RNText style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.text2 }}>Chargement des lieux…</RNText>
              </View>
            ) : null}
          </View>
        </View> : null}
        {point ? (
          <View style={{ position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm + bottomInset, maxWidth: 560, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: space.md, gap: space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <RNText numberOfLines={2} style={{ fontFamily: fonts.sansBold, fontSize: 17, color: colors.text }}>{point.label}</RNText>
                <RNText numberOfLines={2} style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.text2 }}>
                  {[point.kind === 'plan' ? `Jour ${point.day} · étape ${point.order}` : 'À découvrir', category,
                    place?.visit_duration_min ? `≈ ${formatDuration(place.visit_duration_min)}` : null,
                    place?.price_amount != null ? `≈ ${formatMoney(place.price_amount, data.trip.currency)}` : null].filter(Boolean).join(' · ')}
                </RNText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={8} onPress={() => setSelected(null)} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={20} tone="muted" />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
              {point.placeId != null ? (
                <Pressable accessibilityRole="button" onPress={() => setDetails(true)} style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong }}>
                  <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.text }}>Détails</RNText>
                </Pressable>
              ) : null}
              {point.placeId != null ? (
                <Pressable accessibilityRole="button" accessibilityLabel={favorites.ids.has(point.placeId) ? 'Retirer des favoris' : 'Ajouter aux favoris'} onPress={() => { void favorites.toggle(point.placeId!); }} style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.lineStrong }}>
                  <Icon name="heart" size={16} filled={favorites.ids.has(point.placeId)} />
                  <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.text }}>Favori</RNText>
                </Pressable>
              ) : null}
              {place ? (
                <Pressable accessibilityRole="link" accessibilityLabel={`Ouvrir ${point.label} dans Google Maps`} onPress={() => void Linking.openURL(mapsUrl({ name: point.label, lat: place.lat, lng: place.lng }))} style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.lineStrong }}>
                  <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.text }}>Maps</RNText>
                  <Icon name="external" size={14} tone="text" />
                </Pressable>
              ) : null}
              {point.kind === 'disc' && dayId ? (
                <Pressable accessibilityRole="button" disabled={busy} onPress={add} style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }}>
                  <RNText style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.onAccent }}>{`Ajouter au jour ${day}`}</RNText>
                </Pressable>
              ) : null}
            </View>
            {point.kind === 'disc' && !dayId && data.mode !== 'simple' ? <RNText style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.text3 }}>Choisis un jour en haut pour l'ajouter à ton programme.</RNText> : null}
            {problem ? <ErrorNote message={problem} /> : null}
          </View>
        ) : null}
      </View>

      {!point && (message || problem) ? <View style={{ backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line, paddingBottom: bottomInset }}>
        <View style={{ padding: space.lg, gap: space.sm }}>
          {message ? <Text variant="muted" accessibilityLiveRegion="polite">{message}</Text> : null}
          <ErrorNote message={problem} />
        </View>
      </View> : null}
      {details && point?.placeId != null ? (
        <PlaceSheet visible tripId={data.trip.id} placeId={point.placeId} name={point.label} category={category}
          dot={categoryColors[mode][point.root] ?? colors.text3} place={place ?? null} currency={data.trip.currency}
          travelers={Math.max(1, data.members.filter((m) => !m.left_at).length)} closedToday={false} onClose={() => setDetails(false)} />
      ) : null}
    </View>
  );
}

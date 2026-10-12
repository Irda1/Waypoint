import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Card, Chip, Field, Text } from '../../ui';
import { Flag } from '../../ui/Flag';
import type { TripData } from '../../data/useTrip';
import { useCategories } from '../../data/categories';
import { useFavorites } from '../../data/favorites';
import { ensureCitiesCollected } from '../../data/cityCollection';
import { listCities } from '../../data/places';
import type { CityOption } from '../../data/places';
import { addDestination, removeDestination } from '../../data/trips';
import { loadCityPlaces, setTravelers } from '../../data/simple';
import { filterPlaces, openingToday, selectionBudget } from '../../domain/simple.ts';
import type { SimplePlace } from '../../domain/simple.ts';
import { todayIso } from '../../lib/dates.ts';
import { formatMoney } from '../../lib/format';
import { formatDuration } from '../../lib/search';
import { iconFor } from '../../theme/categoryIcons';
import { Icon } from '../../ui/Icon';
import { categoryColors, fonts, radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { FloatingNav } from '../nav/FloatingNav';
import { SettingsButton } from '../nav/SettingsButton';
import { PlaceCard, PlacePic } from './PlaceCard';
import { PlaceSheet } from '../trip/PlaceSheet';
import type { NavTab } from '../nav/FloatingNav';

const TABS: NavTab[] = [
  { key: 'accueil', label: 'Accueil', icon: 'home' },
  { key: 'lieux', label: 'Lieux', icon: 'places' },
  { key: 'carte', label: 'Carte', icon: 'map' },
  { key: 'budget', label: 'Budget', icon: 'budget' },
];
const PAGE = 40;

/** Voyage en mode Simple : la liste des lieux des villes choisies, la carte, et le budget de la sélection (cœur). */
export function SimpleTrip({ data, reload }: { data: TripData; reload: () => void }) {
  const { colors, mode } = useTheme();
  const categories = useCategories();
  const { trip } = data;
  const favorites = useFavorites(trip.id);
  const [tab, setTab] = useState<'lieux' | 'budget'>('lieux');
  const [cityId, setCityId] = useState<number | null>(null);
  const [root, setRoot] = useState<string | null>(null);
  const [onlySel, setOnlySel] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [places, setPlaces] = useState<SimplePlace[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<CityOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SimplePlace | null>(null);

  const dests = useMemo(() => [...data.destinations].sort((a, b) => a.position - b.position), [data.destinations]);
  const cityIds = dests.map((d) => d.city_id);
  const idsKey = cityIds.join(',');
  const notReady = dests.filter((d) => d.collection_status !== 'ready').map((d) => d.city_id);
  const notReadyKey = notReady.join(',');
  const today = todayIso();

  // Les villes jamais chargées sont collectées en direct (avec un pourcentage), puis la liste se remplit.
  useEffect(() => {
    if (!notReady.length) return;
    let alive = true;
    setProgress(0);
    void ensureCitiesCollected(notReady, (p) => { if (alive) setProgress(p.percent); }, () => alive).then(() => {
      if (!alive) return;
      setProgress(null); reload(); setPlaces(null);
    });
    return () => { alive = false; };
  }, [notReadyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (places !== null || !cityIds.length || (progress !== null && notReady.length)) return;
    let alive = true;
    void loadCityPlaces(cityIds).then((r) => { if (alive) { setPlaces(r.places); setError(r.error); } });
    return () => { alive = false; };
  }, [places, idsKey, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPlaces(null); }, [idsKey]);
  useEffect(() => {
    const term = query.trim();
    if (!editing || term.length < 2) { setFound([]); return; }
    let alive = true;
    const id = setTimeout(() => { void listCities({ query: term }).then((r) => { if (alive) setFound(r.cities.filter((c) => !cityIds.includes(c.id))); }); }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [query, editing, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = places ?? [];
  const rootOf = categories.rootOf;
  const list = useMemo(() => filterPlaces(all, { cityId, root }, rootOf).filter((p) => !onlySel || favorites.ids.has(p.id)), [all, cityId, root, rootOf, onlySel, favorites.ids]);
  const selected = useMemo(() => all.filter((p) => favorites.ids.has(p.id)), [all, favorites.ids]);
  const travelers = Math.max(1, trip.travelers ?? 1);
  const budget = useMemo(() => selectionBudget(selected, travelers, rootOf), [selected, travelers, rootOf]);
  const cityName = (id: number) => dests.find((d) => d.city_id === id)?.name ?? '';
  const eur = (n: number) => formatMoney(Math.round(n), trip.currency || 'EUR');
  const rootName = (r: string) => categories.byCode.get(r)?.name_fr ?? r;

  function onNav(key: string) {
    if (key === 'accueil') router.replace('/');
    else if (key === 'carte') router.push({ pathname: '/map/[id]', params: { id: trip.id } });
    else setTab(key as 'lieux' | 'budget');
  }
  async function change(action: () => Promise<string | null>) { setError(await action()); reload(); }

  const countries = [...new Set(dests.map((d) => d.country_code))];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: 4, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <View style={{ position: 'absolute', right: 0, top: 0 }}><SettingsButton /></View>
            {countries.map((c) => <Flag key={c} code={c} width={22} />)}
            <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: colors.accent }}>{dests.length} ville{dests.length > 1 ? 's' : ''} · {selected.length} gardé{selected.length > 1 ? 's' : ''}</RNText>
          </View>
          <RNText accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.text, paddingRight: 48 }}>{trip.title}</RNText>
        </SafeAreaView>

        <View style={{ padding: space.lg, gap: space.md, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          {tab === 'lieux' ? (
            <>
              {/* Ma sélection mise en avant : vignettes des lieux gardés et budget estimé. */}
              <View style={{ borderRadius: radius.card, padding: space.md, gap: space.sm, backgroundColor: colors.surface2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <RNText style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.text }}>Ma sélection</RNText>
                    <RNText style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.text2 }}>{selected.length} lieu{selected.length > 1 ? 'x' : ''} · ≈ {eur(budget.total)} pour {travelers}</RNText>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Voir le budget de ma sélection" onPress={() => setTab('budget')} style={{ minHeight: 38, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.accent }}>
                    <RNText style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.onAccent }}>Voir</RNText>
                  </Pressable>
                </View>
                {selected.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {selected.map((p) => {
                      const r = rootOf(p.category_code);
                      return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${p.name}`} onPress={() => setSheet(p)}><PlacePic place={p} root={r} dot={categoryColors[mode][r] ?? colors.text3} size={44} /></Pressable>;
                    })}
                  </ScrollView>
                ) : <Text variant="muted">Touche le cœur d'un lieu pour le garder ici.</Text>}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                <Chip label="Toutes les villes" selected={cityId === null} onPress={() => { setCityId(null); setShown(PAGE); }} />
                {dests.map((d) => <Chip key={d.city_id} label={d.name} selected={cityId === d.city_id} onPress={() => { setCityId(d.city_id); setShown(PAGE); }} />)}
                <Chip label={editing ? 'Terminé' : 'Ajouter des villes'} selected={editing} onPress={() => setEditing((v) => !v)} />
              </ScrollView>
              {editing ? (
                <Card>
                  {dests.map((d) => (
                    <View key={d.city_id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.md }}>
                      <Text variant="body" style={{ flex: 1 }}>{d.name}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${d.name}`} onPress={() => change(() => removeDestination(trip.id, d.city_id))} style={{ minHeight: 44, justifyContent: 'center' }}>
                        <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger }}>Retirer</RNText>
                      </Pressable>
                    </View>
                  ))}
                  <Field label="Ajouter une ville" value={query} onChangeText={setQuery} placeholder="Ex. Lisbonne" autoCorrect={false} />
                  {found.slice(0, 8).map((c) => (
                    <Pressable key={c.id} accessibilityRole="button" onPress={() => { setQuery(''); void change(() => addDestination(trip.id, c.id, dests.length)); }} style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.line }}>
                      <Text variant="body">{c.name} · {c.country_code}</Text>
                    </Pressable>
                  ))}
                </Card>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                <Chip label={`Ma sélection (${selected.length})`} icon="heart" selected={onlySel} onPress={() => { setOnlySel((v) => !v); setShown(PAGE); }} />
                <Chip label="Tout" selected={root === null} onPress={() => { setRoot(null); setShown(PAGE); }} />
                {categories.activityRoots.map((c) => <Chip key={c.code} label={c.name_fr} icon={iconFor(c.code)} selected={root === c.code} onPress={() => { setRoot(root === c.code ? null : c.code); setShown(PAGE); }} />)}
              </ScrollView>
              {progress !== null ? <Text variant="muted" accessibilityLiveRegion="polite">Chargement des lieux… {Math.round(progress)} %</Text> : null}
              {places === null && progress === null ? <Text variant="muted">Chargement des lieux…</Text> : null}
              {places !== null && !list.length && progress === null ? <Text variant="muted">{onlySel ? 'Aucun lieu dans ta sélection : touche le cœur d’un lieu pour le garder.' : 'Aucun lieu pour ce filtre.'}</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {list.slice(0, shown).map((p) => {
                  const r = rootOf(p.category_code);
                  const open = openingToday(p, today);
                  const line = [cityId === null && dests.length > 1 ? cityName(p.city_id) : null, p.price_amount != null ? (p.price_amount === 0 ? 'Gratuit' : `≈ ${eur(p.price_amount)}`) : null, p.visit_duration_min ? `≈ ${formatDuration(p.visit_duration_min)}` : null].filter(Boolean).join(' · ') || rootName(r);
                  return <PlaceCard key={p.id} place={p} root={r} dot={categoryColors[mode][r] ?? colors.text3} line={line} open={open} closed={!!open?.startsWith('Fermé')}
                    on={favorites.ids.has(p.id)} onToggle={() => { void favorites.toggle(p.id); }} onOpen={() => setSheet(p)} />;
                })}
              </View>
              {list.length > shown ? <Button label={`Voir plus (${list.length - shown})`} variant="ghost" onPress={() => setShown((n) => n + PAGE)} /> : null}
              <Text variant="muted" style={{ fontSize: 12 }}>Prix et durées : estimations d'après la catégorie du lieu. Lieux : © contributeurs d'OpenStreetMap · Powered by Geoapify.</Text>
              {error ? <Text variant="muted" style={{ color: colors.danger }} accessibilityRole="alert">{error}</Text> : null}
            </>
          ) : (
            <>
              <Card>
                <Text variant="label">Ma sélection · {selected.length} lieu{selected.length > 1 ? 'x' : ''}</Text>
                {selected.length === 0 ? <Text variant="muted">Touche le cœur des lieux de l'onglet Lieux : leur budget s'additionne ici.</Text> : (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <Text variant="muted" style={{ flex: 1 }}>Personnes</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel="Une personne de moins" disabled={travelers <= 1} onPress={() => change(() => setTravelers(trip.id, travelers - 1))} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, opacity: travelers <= 1 ? 0.4 : 1 }}>
                        <RNText style={{ fontFamily: fonts.sansBold, fontSize: 20, color: colors.text }}>−</RNText>
                      </Pressable>
                      <RNText style={{ fontFamily: fonts.sansBold, fontSize: 18, color: colors.text, minWidth: 24, textAlign: 'center' }}>{travelers}</RNText>
                      <Pressable accessibilityRole="button" accessibilityLabel="Une personne de plus" onPress={() => change(() => setTravelers(trip.id, travelers + 1))} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 }}>
                        <RNText style={{ fontFamily: fonts.sansBold, fontSize: 20, color: colors.text }}>+</RNText>
                      </Pressable>
                    </View>
                    <RNText style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.text }}>≈ {eur(budget.total)}</RNText>
                    <Text variant="muted">{travelers > 1 ? `pour ${travelers} personnes · ≈ ${eur(budget.perPerson)} par personne` : 'pour une personne'}</Text>
                    {budget.byRoot.map((b) => (
                      <View key={b.root} style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 28 }}>
                          <Icon name={iconFor(b.root)} size={18} />
                          <Text variant="body" style={{ flex: 1 }}>{rootName(b.root)} · {b.count}</Text>
                          <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>≈ {eur(b.amount)}</Text>
                        </View>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: 'hidden' }}>
                          <View style={{ height: '100%', borderRadius: 3, width: `${Math.max(4, Math.round((b.amount / Math.max(1, budget.byRoot[0].amount)) * 100))}%`, backgroundColor: categoryColors[mode][b.root] ?? colors.accent }} />
                        </View>
                      </View>
                    ))}
                    {budget.unpriced ? <Text variant="muted">{budget.unpriced} lieu{budget.unpriced > 1 ? 'x' : ''} sans prix connu n'{budget.unpriced > 1 ? 'entrent' : 'entre'} pas dans le total.</Text> : null}
                  </>
                )}
              </Card>
              {selected.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${p.name}`} onPress={() => setSheet(p)}>
                    <PlacePic place={p} root={rootOf(p.category_code)} dot={categoryColors[mode][rootOf(p.category_code)] ?? colors.text3} size={44} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{p.name}</Text>
                    {dests.length > 1 ? <Text variant="muted">{cityName(p.city_id)}</Text> : null}
                  </View>
                  <Text variant="muted">{p.price_amount == null ? 'prix inconnu' : p.price_amount === 0 ? 'Gratuit' : `≈ ${eur(p.price_amount * travelers)}`}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${p.name} de ma sélection`} hitSlop={8} onPress={() => { void favorites.toggle(p.id); }} style={{ minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="heart" filled size={20} />
                  </Pressable>
                </View>
              ))}
              <Text variant="muted" style={{ fontSize: 12 }}>Estimations d'après la catégorie des lieux, pas des prix réels.</Text>
            </>
          )}
        </View>
      </ScrollView>
      {sheet ? (
        <PlaceSheet visible tripId={trip.id} placeId={sheet.id} name={sheet.name} category={rootName(rootOf(sheet.category_code))} root={rootOf(sheet.category_code)}
          context={dests.length > 1 ? cityName(sheet.city_id) : undefined} dot={categoryColors[mode][rootOf(sheet.category_code)] ?? colors.text3}
          place={sheet} currency={trip.currency || 'EUR'} travelers={travelers} closedToday={false} onClose={() => setSheet(null)} />
      ) : null}
      <FloatingNav tabs={TABS} active={tab} onSelect={onNav} />
    </View>
  );
}

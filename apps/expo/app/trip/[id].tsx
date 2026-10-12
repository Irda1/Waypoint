import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useJournal } from '../../src/data/journal';
import { JournalCard, JournalSection } from '../../src/features/trip/JournalCard';
import { Recap } from '../../src/features/trip/Recap';
import { FinalBalanceCard } from '../../src/features/trip/FinalBalanceCard';
import { finalBalance } from '../../src/domain/finalBalance.ts';
import { markSouvenirsSeen } from '../../src/lib/souvenirs';
import { useAuth } from '../../src/auth/AuthProvider';
import { useRequireAuth } from '../../src/auth/useRequireAuth';
import { Button, Card, Columns, ErrorNote, Field, Screen, Section, Text } from '../../src/ui';
import { useTrip } from '../../src/data/useTrip';
import { addDay, addDestination, createInvite, removeDestination } from '../../src/data/trips';
import type { CityOption } from '../../src/data/places';
import { MiniCalendar } from '../../src/features/trip/MiniCalendar';
import { DestinationsCard } from '../../src/features/trip/DestinationsCard';
import { Globe } from '../../src/features/globe/Globe';
import { TripSummary } from '../../src/features/trip/TripSummary';
import { ROUTE_BG, routeParam } from '../../src/domain/routeGlobe.ts';
import { useAppearance } from '../../src/theme/store';
import { DayCard } from '../../src/features/trip/DayCard';
import { DayStrip } from '../../src/features/trip/DayStrip';
import { WeatherCard } from '../../src/features/trip/WeatherCard';
import { useForecasts } from '../../src/data/weather';
import { ProgramCard } from '../../src/features/trip/ProgramCard';
import { activityLines } from '../../src/domain/budget.ts';
import { buildReminders } from '../../src/domain/reminders.ts';
import { deleteTrip } from '../../src/data/trips';
import { loadNotifPrefs, syncTripReminders } from '../../src/lib/reminders';
import { savedLabel } from '../../src/domain/offlineSnapshot.ts';
import { shareText } from '../../src/lib/share';
import { ChecklistCard } from '../../src/features/trip/ChecklistCard';
import { BookingsCard } from '../../src/features/trip/BookingsCard';
import { ExportCard } from '../../src/features/trip/ExportCard';
import { UnplannedCard } from '../../src/features/trip/UnplannedCard';
import { HoursCard } from '../../src/features/trip/HoursCard';
import { MemoCard } from '../../src/features/trip/MemoCard';
import { StayCard } from '../../src/features/trip/StayCard';
import { FriendsCard } from '../../src/features/trip/FriendsCard';
import { BudgetCard } from '../../src/features/trip/BudgetCard';
import { QuickExpenseSheet } from '../../src/features/trip/QuickExpenseSheet';
import { deleteExpense } from '../../src/data/trips';
import { ShareCard } from '../../src/features/trip/ShareCard';
import { FlightsCard } from '../../src/features/trip/FlightsCard';
import { ConverterCard } from '../../src/features/trip/ConverterCard';
import { ToPayCard } from '../../src/features/trip/ToPayCard';
import { formatDay, isIsoDate } from '../../src/lib/format';
import { photoKeyFor } from '../../src/lib/photoKey';
import { checkNewDay, suggestNewDay, todayIso } from '../../src/lib/dates.ts';
import { cityRuns } from '../../src/domain/dayruns.ts';
import { pickSource } from '../../src/data/cityCover';
import { useCityPhotos } from '../../src/data/cityPhoto';
import { photos } from '../../src/theme/photos';
import { PlusMenu } from '../../src/features/nav/PlusMenu';
import type { PlusChoice } from '../../src/features/nav/PlusMenu';
import { FloatingNav, NAV_HEIGHT, useBottomInset } from '../../src/features/nav/FloatingNav';
import { SettingsButton } from '../../src/features/nav/SettingsButton';
import { SimpleTrip } from '../../src/features/simple/SimpleTrip';
import type { NavTab } from '../../src/features/nav/FloatingNav';
import { Icon } from '../../src/ui/Icon';
import { FadeIn } from '../../src/ui/FadeIn';
import { fonts, palette, radius, space } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';
import { SkeletonPage } from '../../src/ui/motion';

const TABS: NavTab[] = [
  { key: 'accueil', label: 'Accueil', icon: 'home' },
  { key: 'voyage', label: 'Voyage', icon: 'trip' },
  { key: 'jour', label: 'Jour', icon: 'day' },
  { key: 'carte', label: 'Carte', icon: 'map' },
  { key: 'budget', label: 'Budget', icon: 'budget' },
  { key: 'amis', label: 'Amis', icon: 'friends' },
];

function weekdayShort(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
}


const STATUS = { connecting: 'Connexion en direct…', live: 'Synchronisé en direct', offline: 'Hors ligne : reprise à la reconnexion' } as const;

// Textes posés sur la photo : toujours clairs, quel que soit le mode du téléphone.
const ON_PHOTO = '#F4EFE6';
const ON_PHOTO_SOFT = 'rgba(245, 245, 242, 0.82)';
// Sable clair pour les petits titres posés sur photo (l'accent du thème clair est trop sombre ici).

function lodgingOf(stayId: string | null, stays: { id: string; name: string; address: string | null; lat: number | null; lng: number | null }[]) {
  const st = stayId ? stays.find((x) => x.id === stayId) : undefined;
  return st && st.lat != null && st.lng != null ? { name: st.name || 'Hébergement', address: st.address, lat: st.lat, lng: st.lng } : null;
}

export default function TripScreen() {
  const guard = useRequireAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { accent } = useAppearance();
  const bottomInset = useBottomInset();
  const { data, error, loading, status, savedAt, reload } = useTrip(String(id));
  const [tab, setTab] = useState<'voyage' | 'jour' | 'budget' | 'amis'>('voyage');
  // Pendant le voyage, il s'ouvre sur la journée du jour (une seule fois, l'onglet choisi ensuite est respecté).
  const openedOnToday = useRef(false);
  useEffect(() => {
    if (!data || openedOnToday.current) return;
    openedOnToday.current = true;
    if (data.days.some((d) => d.day_date === todayIso())) setTab('jour');
  }, [data]);
  const [chosenDay, setChosenDay] = useState<number | null>(null);
  const [dayDir, setDayDir] = useState<1 | -1>(1);
  const [plusOpen, setPlusOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [added, setAdded] = useState<{ id: string | null; summary: string } | null>(null);
  useEffect(() => { if (!added) return; const t = setTimeout(() => setAdded(null), 5000); return () => clearTimeout(t); }, [added]);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [pendingAdd, setPendingAdd] = useState(false);
  const [pendingMemo, setPendingMemo] = useState(false);
  const [newDay, setNewDay] = useState('');
  const [addingDay, setAddingDay] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  useEffect(() => { if (!focusItem) return; const id = setTimeout(() => setFocusItem(null), 6000); return () => clearTimeout(id); }, [focusItem]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const [editingDest, setEditingDest] = useState(false);
  const [destError, setDestError] = useState<string | null>(null);
  // Stable entre deux rendus : le sélecteur de lieux en dépend.
  const destinationOptions = useMemo<CityOption[]>(
    () => (data?.destinations ?? []).map((d) => ({ id: d.city_id, name: d.name, names: [d.name], country_code: d.country_code, collection_status: d.collection_status })),
    [data?.destinations],
  );

  const spots = useMemo(() => (data?.destinations ?? []).map((d) => ({ id: d.city_id, lat: d.lat, lng: d.lng })), [data?.destinations]);
  const weather = useForecasts(spots);
  // Photos des villes sans photo en base (Wikipédia) ; en attendant, la photo du pays reste affichée.
  const cityPhotos = useCityPhotos(data?.destinations ?? []);
  // Carnet de voyage (migration 2600) : rechargé avec les données du voyage.
  const journal = useJournal(String(id), data);
  const [recap, setRecap] = useState(false);
  // Récap ou bilan ouvert : la pastille « Récap prêt » de l'accueil disparaît.
  useEffect(() => { if (recap || tab === 'budget') void markSouvenirsSeen(String(id)); }, [recap, tab, id]);

  // Rappels du téléphone : reprogrammés à chaque changement du voyage (sans effet sur le web ni si les rappels sont coupés).
  useEffect(() => {
    if (!data || savedAt) return;
    const placeName = (pid: number) => data.places.get(pid)?.name;
    const travelers = Math.max(1, data.members.filter((m) => !m.left_at).length);
    const dueByDay: Record<string, string[]> = {};
    for (const l of activityLines({ days: data.days, items: data.items, places: data.places, expenses: data.expenses, travelers })) {
      if (l.due <= 0) continue;
      const day = data.days[l.day - 1];
      if (day) (dueByDay[day.id] ??= []).push(l.name);
    }
    void loadNotifPrefs().then((prefs) => syncTripReminders(data.trip.id, buildReminders({ tripTitle: data.trip.title, startsOn: data.trip.starts_on, days: data.days, items: data.items, placeName, prefs, dueByDay }))).catch(() => {});
  }, [data, savedAt]);

  if (guard) return guard;
  if (loading) return <Screen><SkeletonPage /></Screen>;
  if (error || !data) {
    return <Screen><ErrorNote message={error ?? 'Voyage introuvable.'} /><Button label="Retour à mes voyages" onPress={() => router.replace('/')} /></Screen>;
  }

  if (data.mode === 'simple') return <SimpleTrip data={data} reload={() => void reload()} />;
  const active = data.members.filter((m) => !m.left_at);
  const travelers = Math.max(1, active.length);
  const { trip } = data;
  const destNames = destinationOptions.map((d) => d.name).join(' · ');
  // Bandeau du haut (onglet Voyage) : mêmes couleurs que l'accueil selon le mode.
  const H = mode === 'jour'
    ? { text: colors.text, soft: colors.text2, eyebrow: colors.accent, glassBg: colors.surface, glassLine: colors.lineStrong }
    : { text: ON_PHOTO, soft: ON_PHOTO_SOFT, eyebrow: palette('nuit', accent).accent2, glassBg: 'rgba(7, 9, 11, 0.45)', glassLine: 'rgba(245, 245, 242, 0.25)' };
  const destDetail = data.destinations.map((d) => (d.nights > 0 ? `${d.name} (${d.nights} nuit${d.nights > 1 ? 's' : ''})` : d.name)).join(' → ');

  async function changeDestination(action: () => Promise<string | null>) {
    setDestError(await action());
    void reload();
  }
  const dates = trip.starts_on ? `${formatDay(trip.starts_on)}${trip.ends_on ? ` → ${formatDay(trip.ends_on)}` : ''}` : 'Dates à définir';
  const ended = !!trip.ends_on && trip.ends_on < todayIso();
  const balance = finalBalance({
    expenses: data.expenses, budgetTotal: trip.budget_total, days: data.days.length, payments: data.payments ?? [],
    envelopes: Object.fromEntries(data.budgetLines.map((l) => [l.poste, Number(l.amount)])),
    memberIds: data.members.filter((m) => !m.left_at).map((m) => m.user_id),
  });

  async function invite() {
    const res = await createInvite(data!.trip.id);
    setInviteError(res.error);
    if (res.code) setInviteCode(res.code);
  }
  async function shareInvite() {
    if (!inviteCode) return;
    const link = Linking.createURL(`/join/${inviteCode}`);
    const r = await shareText(`Rejoins « ${data!.trip.title} » sur Waypoint : ${link}\nCode : ${inviteCode}`);
    setInviteNote(r === 'copied' ? 'Invitation copiée : colle-la dans un message.' : r === 'failed' ? 'Partage impossible ici : recopie le code.' : null);
  }

  async function submitDay() {
    if (!isIsoDate(newDay)) { setDayError('Date au format AAAA-MM-JJ (ex. 2026-10-13).'); return; }
    const outside = checkNewDay(newDay, data!.trip.starts_on, data!.trip.ends_on);
    if (outside) { setDayError(outside); return; }
    const err = await addDay(data!.trip.id, newDay);
    setDayError(err);
    if (!err) { setNewDay(''); setAddingDay(false); void reload(); }
  }

  // Sans choix, on ouvre le jour d'aujourd'hui s'il fait partie du voyage, sinon le premier.
  const todayIdx = data.days.findIndex((d) => d.day_date === todayIso());
  const dayIndex = chosenDay ?? Math.max(0, todayIdx);

  function onPlus(c: PlusChoice) {
    setPlusOpen(false);
    if (c === 'activite') { setTab('jour'); setPendingAdd(true); }
    else if (c === 'depense') setQuickOpen(true);
    else { setTab('voyage'); setPendingMemo(true); }
  }

  function onNav(key: string) {
    if (key === 'accueil') router.replace('/');
    else if (key === 'carte') router.push({ pathname: '/map/[id]', params: { id: trip.id } });
    else setTab(key as typeof tab);
  }

  // Jour choisi : sa ville, sa photo, et les séries de jours par ville pour la bande du haut.
  const selIdx = Math.min(dayIndex, Math.max(data.days.length - 1, 0));
  const pickDay = (i: number) => { setDayDir(i >= selIdx ? 1 : -1); setChosenDay(i); };
  const selDay = data.days[selIdx];
  const cityOfDay = (d: { city_id: number | null }) => d.city_id ?? data.destinations[0]?.city_id ?? null;
  const nameOfCity = (id: number | null) => data.destinations.find((x) => x.city_id === id)?.name ?? '';
  const selCity = selDay ? nameOfCity(cityOfDay(selDay)) : '';
  const selDest = data.destinations.find((x) => x.city_id === (selDay ? cityOfDay(selDay) : null));
  const dayPick = pickSource(photos[photoKeyFor(`${selCity} ${trip.title}`)], selDest?.cover ?? (selDest ? cityPhotos.get(selDest.city_id) : null), data.capitalCover);
  const runs = cityRuns(data.days.map(cityOfDay));
  const activitiesLine = data.budgetLines.find((l) => l.poste === 'activites');
  const dailyActivityBudget = activitiesLine && data.days.length ? Number(activitiesLine.amount) / data.days.length : null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <FadeIn key={tab}>
        {tab === 'voyage' ? (
          // Itinéraire en fond : la planète de l'accueil suit le trajet de ville en ville, puis montre tout le parcours.
          <View style={[styles.cover, { backgroundColor: ROUTE_BG[mode] }]}>
            {data.destinations.length ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Globe mode="route" color={(mode === 'jour' ? colors.accent : palette('nuit', accent).accent).slice(1)} theme={mode} route={routeParam(data.destinations)} />
              </View>
            ) : null}
            <SafeAreaView edges={['top']} style={styles.coverInner}>
              <View style={styles.coverBar}>
                <Pressable accessibilityRole="button" accessibilityLabel="Retour à mes voyages" onPress={() => router.replace('/')} style={[styles.glass, { backgroundColor: H.glassBg, borderColor: H.glassLine }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="back" size={16} color={H.text} /><RNText style={[styles.glassLabel, { color: H.text }]}>Mes voyages</RNText></View>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 }}>
                  <View style={[styles.glass, { backgroundColor: H.glassBg, borderColor: H.glassLine, flexShrink: 1 }]} accessibilityLiveRegion="polite">
                    <RNText numberOfLines={1} style={[styles.glassLabel, { color: H.text }]}>{savedAt ? `Copie hors ligne · ${savedLabel(savedAt)}` : STATUS[status]}</RNText>
                  </View>
                  <SettingsButton glass={{ bg: H.glassBg, line: H.glassLine, text: H.text }} />
                </View>
              </View>
              <View style={styles.coverText} pointerEvents="none">
                <RNText style={[styles.eyebrow, { color: H.eyebrow }]}>
                  {data.days.length} jour{data.days.length > 1 ? 's' : ''} · {active.length} voyageur{active.length > 1 ? 's' : ''}
                </RNText>
                <RNText style={[styles.poster, { color: H.text }]} accessibilityRole="header">{trip.title}</RNText>
                <RNText style={[styles.lead, { color: H.soft }]}>{dates}</RNText>
                {destNames ? <RNText style={[styles.route, { color: H.text }]} numberOfLines={2}>{destNames.replace(/ · /g, ' → ')}</RNText> : null}
              </View>
              {ended && data.days.length > 0 && data.destinations.length > 0 ? (
                // Récap animé : un souvenir, proposé une fois la dernière date passée.
                <Pressable accessibilityRole="button" onPress={() => setRecap(true)}
                  style={[styles.glass, { alignSelf: 'flex-start', marginTop: space.md, backgroundColor: palette('nuit', accent).accent, borderColor: 'transparent' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="sparkles" size={16} color={palette('nuit', accent).onAccent} />
                    <RNText style={[styles.glassLabel, { color: palette('nuit', accent).onAccent }]}>Revoir le voyage</RNText>
                  </View>
                </Pressable>
              ) : null}
            </SafeAreaView>
          </View>
        ) : tab === 'jour' && data.days.length > 0 ? (
          <ImageBackground source={dayPick.source} resizeMode="cover" style={styles.dayHero}>
            <View style={styles.veil} pointerEvents="none" />
            <SafeAreaView edges={['top']} style={styles.dayHeroInner}>
              <View style={{ position: 'absolute', top: insets.top + space.sm, right: space.lg }}><SettingsButton glass={{ bg: 'rgba(7, 9, 11, 0.45)', line: 'rgba(245, 245, 242, 0.25)', text: ON_PHOTO }} /></View>
              <RNText style={[styles.eyebrow, { color: palette('nuit', accent).accent2 }]}>Jour {selIdx + 1} sur {data.days.length} · {formatDay(selDay.day_date)}</RNText>
              <RNText style={styles.poster} accessibilityRole="header">{selCity || trip.title}</RNText>
              <RNText style={styles.lead}>{selCity ? trip.title : dates}</RNText>
              {dayPick.cover?.credit ? <RNText style={{ fontFamily: fonts.sans, fontSize: 10, color: ON_PHOTO_SOFT }}>{dayPick.cover.credit}</RNText> : null}
            </SafeAreaView>
          </ImageBackground>
        ) : (
          <SafeAreaView edges={['top']} style={[styles.slimHead, { flexDirection: 'row', alignItems: 'flex-start', gap: space.md }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <RNText style={[styles.eyebrow, { color: colors.accent }]}>{dates}</RNText>
              <RNText style={[styles.slimTitle, { color: colors.text }]} accessibilityRole="header">{trip.title}</RNText>
            </View>
            <SettingsButton />
          </SafeAreaView>
        )}

        {tab === 'voyage' ? (
        <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
        <View style={styles.page}>
          <TripSummary data={data} onOpen={(t) => onNav(t)} />
          {data.days.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <Text variant="label">Les journées · {data.days.length} jour{data.days.length > 1 ? 's' : ''}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {data.days.map((d, i) => {
                  const dest = data.destinations.find((x) => x.city_id === d.city_id);
                  const city = dest?.name ?? destinationOptions[0]?.name ?? '';
                  const tile = pickSource(photos[photoKeyFor(`${city} ${trip.title}`)], dest?.cover ?? (dest ? cityPhotos.get(dest.city_id) : null), data.capitalCover);
                  return (
                    <Pressable key={d.id} accessibilityRole="button" accessibilityLabel={`Ouvrir le jour ${i + 1}`} onPress={() => { setChosenDay(i); setTab('jour'); }}>
                      <ImageBackground source={tile.cover ? { uri: tile.cover.small } : tile.source} resizeMode="cover" style={styles.dayTile} imageStyle={{ borderRadius: radius.card }}>
                        <View style={styles.tileVeil} pointerEvents="none" />
                        <RNText style={styles.tileNumber}>{d.day_date.slice(8, 10).replace(/^0/, '')}</RNText>
                        <RNText style={styles.tileCity} numberOfLines={2}>{city || weekdayShort(d.day_date)}</RNText>
                      </ImageBackground>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <MemoCard tripId={trip.id} memo={trip.memo ?? ''} onChanged={reload} startEditing={pendingMemo} onStarted={() => setPendingMemo(false)} />

          <Section title="Itinéraire" icon="map">
            <DestinationsCard data={data} onChanged={reload} />
            <HoursCard data={data} onOpen={(i, itemId) => { setChosenDay(i); setFocusItem(itemId); setTab('jour'); }} />
            <ProgramCard data={data} onApplied={reload} />
            <UnplannedCard data={data} onChanged={reload} />
          </Section>

          <Section title="Transports et nuits" icon="plane" hint="Vols, hébergements, réservations" defaultOpen={false}>
            <FlightsCard data={data} />
            <StayCard data={data} userId={session?.user.id ?? null} onChanged={reload} />
            <BookingsCard tripId={trip.id} />
          </Section>

          <Section title="Préparation" icon="note" hint="Météo, liste, export" defaultOpen={false}>
            <WeatherCard destinations={data.destinations} forecasts={weather.forecasts} loading={weather.loading} error={weather.error} start={trip.starts_on} end={trip.ends_on} />
            <ChecklistCard tripId={trip.id} />
            <ExportCard data={data} />
          </Section>

          {journal.available ? (
            <Section title="Carnet" icon="book" hint="Notes et photos du voyage" defaultOpen={false}>
              <JournalSection journal={journal} days={data.days.map((d) => ({ ...d, city_id: cityOfDay(d) }))} cityName={nameOfCity} onRecap={ended && data.destinations.length ? () => setRecap(true) : undefined} />
            </Section>
          ) : null}
        </View>
        </View>
        ) : null}

        {tab === 'jour' ? (
        <View style={data.days.length > 0 ? [styles.sheet, { backgroundColor: colors.bg }] : undefined}>
        <View style={styles.page}>
          {data.days.length === 0 ? <Card><Text variant="muted">Aucun jour pour l'instant. Ajoute le premier ci-dessous.</Text></Card> : (
            <>
              <DayStrip days={data.days} selected={selIdx} runs={runs} cityName={nameOfCity} onPick={pickDay} />
              {(() => {
                const i = Math.min(dayIndex, data.days.length - 1);
                const d = data.days[i];
                // Changement de jour : la journée arrive du côté où l'on va (glissé latéral, 220 ms).
                return <FadeIn key={d.id} dx={24 * dayDir} dy={0}><View style={{ gap: space.lg }}><DayCard tripId={trip.id} tripTitle={trip.title} destinations={destinationOptions} day={d} number={i + 1} items={data.items} places={data.places} expenses={data.expenses} travelers={travelers} forecast={weather.forecasts.get(d.city_id ?? data.destinations[0]?.city_id ?? -1) ?? null} lodging={lodgingOf(d.stay_id, data.stays)} allDayIds={data.days.map((x) => x.id)} currency={trip.currency} dailyActivityBudget={dailyActivityBudget} onChanged={reload} openAdd={pendingAdd} onOpenedAdd={() => setPendingAdd(false)} focusItemId={focusItem} /><JournalCard tripId={trip.id} dayId={d.id} journal={journal} members={data.members} userId={session?.user.id ?? null} /></View></FadeIn>;
              })()}
            </>
          )}

          {addingDay ? (
            <Card>
              <Text variant="heading">Ajouter un jour</Text>
              <MiniCalendar value={newDay} taken={new Set(data.days.map((d) => d.day_date))} onPick={(iso) => { setNewDay(iso); setDayError(null); }} />
              <Text variant="muted">{newDay ? `Jour choisi : ${formatDay(newDay)}` : 'Touche une date.'}</Text>
              <ErrorNote message={dayError} />
              <Button label="Ajouter le jour" onPress={submitDay} />
              <Button label="Annuler" variant="ghost" onPress={() => { setAddingDay(false); setDayError(null); }} />
            </Card>
          ) : (
            <Button label="+ Ajouter un jour" variant="ghost" onPress={() => { setNewDay(suggestNewDay(data.days.map((d) => d.day_date), trip.starts_on, trip.ends_on)); setAddingDay(true); }} />
          )}
        </View>
        </View>
        ) : null}

        {tab === 'budget' ? (
        <View style={styles.page}>
          {/* Bilan seulement une fois la dernière date passée : avant, l'onglet Budget suffit. */}
          {ended ? <FinalBalanceCard data={data} balance={balance} onOpenFriends={() => setTab('amis')} /> : null}
          <BudgetCard data={data} onChanged={reload} activitiesPanel={session ? <ToPayCard data={data} userId={session.user.id} onChanged={reload} embedded /> : undefined} />
          <ConverterCard data={data} />
          {session ? <Button label="Ajouter une dépense" icon="expense" onPress={() => setQuickOpen(true)} /> : null}
        </View>
        ) : null}

        {tab === 'amis' ? (
        <View style={styles.page}>
          {session ? <FriendsCard data={data} userId={session.user.id} onChanged={reload} /> : null}
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
            {inviteCode ? (
              <View style={{ gap: space.sm, padding: space.md, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface2 }}>
                <Text variant="label">Code d'invitation</Text>
                <RNText selectable style={{ fontFamily: fonts.sansBold, fontSize: 28, letterSpacing: 4, color: colors.text }}>{inviteCode}</RNText>
                <Text variant="muted">Ton ami l'entre dans « Rejoindre un voyage » sur l'accueil, ou ouvre le lien partagé.</Text>
                <Button label="Partager" onPress={shareInvite} />
                {inviteNote ? <Text variant="muted">{inviteNote}</Text> : null}
              </View>
            ) : null}
            <Button label={inviteCode ? 'Nouveau code' : 'Inviter un ami'} variant="ghost" onPress={invite} />
          </Card>

          <ShareCard tripId={trip.id} title={trip.title} />

          <Card>
            <Text variant="label">Supprimer le voyage</Text>
            {confirmTrash ? (
              <View style={{ gap: space.sm }}>
                <Text variant="body">« {trip.title} » ira dans la corbeille de l'accueil, pour tous les voyageurs. Tu pourras le restaurer.</Text>
                <Button label="Oui, mettre à la corbeille" onPress={async () => { const err = await deleteTrip(trip.id); if (err) setTrashError(err); else router.replace('/'); }} />
                <Button label="Annuler" variant="ghost" onPress={() => { setConfirmTrash(false); setTrashError(null); }} />
                <ErrorNote message={trashError} />
              </View>
            ) : <Button label="Supprimer ce voyage" variant="ghost" onPress={() => setConfirmTrash(true)} />}
          </Card>

        </View>
        ) : null}
        </FadeIn>
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Ajouter" onPress={() => setPlusOpen(true)}
        style={({ pressed }) => ({ position: 'absolute', right: 16, bottom: bottomInset + NAV_HEIGHT + 4, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
        <Icon name="add" size={26} tone="onAccent" filled />
      </Pressable>
      <FloatingNav tabs={TABS} active={tab} onSelect={onNav} />
      <PlusMenu visible={plusOpen} onPick={onPlus} onClose={() => setPlusOpen(false)} />
      {recap ? (
        <Recap visible onClose={() => setRecap(false)} title={trip.title} dates={dates} currency={trip.currency} days={data.days} destinations={data.destinations}
          items={data.items} expenses={data.expenses} journal={journal} members={data.members} cityName={(d) => nameOfCity(cityOfDay(d))} balance={balance} />
      ) : null}
      {session ? (
        <QuickExpenseSheet visible={quickOpen} data={data} userId={session.user.id} onClose={() => setQuickOpen(false)}
          onSaved={(id, summary) => { setQuickOpen(false); setAdded({ id, summary }); reload(); }} />
      ) : null}
      {added ? (
        <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 16, right: 16, bottom: bottomInset + NAV_HEIGHT + 64, alignItems: 'center' }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.text, borderRadius: radius.pill, paddingLeft: space.lg, paddingRight: space.sm, minHeight: 44, maxWidth: 520 }}>
            <RNText numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.bg }}>Dépense ajoutée · {added.summary}</RNText>
            {added.id ? (
              <Pressable accessibilityRole="button" onPress={async () => { const id = added.id!; setAdded(null); await deleteExpense(id); reload(); }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm }}>
                <RNText style={{ fontFamily: fonts.sansBold, fontSize: 13.5, color: mode === 'jour' ? palette('nuit', accent).accent : colors.accent }}>Annuler</RNText>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// La page se pose sur la photo comme une feuille (même geste que l'accueil).
const SHEET_OVERLAP = 28;

const styles = StyleSheet.create({
  sheet: { marginTop: -SHEET_OVERLAP, borderTopLeftRadius: SHEET_OVERLAP, borderTopRightRadius: SHEET_OVERLAP, zIndex: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -6 }, elevation: 6 },
  cover: { minHeight: 460, width: '100%' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 9, 11, 0.5)' },
  coverInner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.xl + SHEET_OVERLAP, minHeight: 460, width: '100%', maxWidth: 880, alignSelf: 'center' },
  coverBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  glass: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: 'rgba(7, 9, 11, 0.45)', borderWidth: 1, borderColor: 'rgba(245, 245, 242, 0.25)' },
  glassLabel: { fontFamily: fonts.sansSemi, fontSize: 13, color: ON_PHOTO },
  coverText: { gap: space.sm, alignItems: 'flex-start', marginTop: 96 },
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase' },
  poster: { fontFamily: fonts.serif, fontSize: 46, lineHeight: 50, color: ON_PHOTO },
  lead: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 23, color: ON_PHOTO_SOFT },
  route: { fontFamily: fonts.sansSemi, fontSize: 14, lineHeight: 20, maxWidth: 420 },
  page: { width: '100%', maxWidth: 880, alignSelf: 'center', padding: space.lg, paddingTop: space.xl, gap: space.lg },
  dayHero: { minHeight: 230, width: '100%' },
  dayHeroInner: { justifyContent: 'flex-end', gap: 4, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.lg + SHEET_OVERLAP, minHeight: 230, width: '100%', maxWidth: 880, alignSelf: 'center' },
  slimHead: { width: '100%', maxWidth: 880, alignSelf: 'center', paddingHorizontal: space.lg, paddingTop: space.lg, gap: 4 },
  slimTitle: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 34 },
  dayTile: { width: 124, height: 128, borderRadius: radius.card, padding: 12, justifyContent: 'space-between', backgroundColor: '#101315', overflow: 'hidden' },
  tileVeil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.card, backgroundColor: 'rgba(7, 9, 11, 0.45)' },
  tileNumber: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 36, color: ON_PHOTO },
  tileCity: { fontFamily: fonts.sansBold, fontSize: 15, lineHeight: 17, color: ON_PHOTO },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: fonts.sansBold, fontSize: 13, color: '#14100A' },
});

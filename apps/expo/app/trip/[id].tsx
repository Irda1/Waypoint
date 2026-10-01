import React, { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { useRequireAuth } from '../../src/auth/useRequireAuth';
import { Button, Card, Columns, ErrorNote, Field, Screen, Text } from '../../src/ui';
import { useTrip } from '../../src/data/useTrip';
import { addDay, addDestination, createInvite, removeDestination } from '../../src/data/trips';
import type { CityOption } from '../../src/data/places';
import { MiniCalendar } from '../../src/features/trip/MiniCalendar';
import { DestinationsCard } from '../../src/features/trip/DestinationsCard';
import { DayCard } from '../../src/features/trip/DayCard';
import { WeatherCard } from '../../src/features/trip/WeatherCard';
import { useForecasts } from '../../src/data/weather';
import { ProgramCard } from '../../src/features/trip/ProgramCard';
import { buildReminders } from '../../src/domain/reminders.ts';
import { syncTripReminders } from '../../src/lib/reminders';
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
import { AddExpenseCard } from '../../src/features/trip/AddExpenseCard';
import { ToPayCard } from '../../src/features/trip/ToPayCard';
import { formatDay, isIsoDate } from '../../src/lib/format';
import { photoKeyFor } from '../../src/lib/photoKey';
import { checkNewDay, suggestNewDay, todayIso } from '../../src/lib/dates.ts';
import { cityRuns } from '../../src/domain/dayruns.ts';
import { pickSource } from '../../src/data/cityCover';
import { photos } from '../../src/theme/photos';
import { PlusMenu } from '../../src/features/nav/PlusMenu';
import type { PlusChoice } from '../../src/features/nav/PlusMenu';
import { FloatingNav } from '../../src/features/nav/FloatingNav';
import type { NavTab } from '../../src/features/nav/FloatingNav';
import { fonts, radius, space } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';

const TABS: NavTab[] = [
  { key: 'accueil', label: 'Accueil', icon: '🏠' },
  { key: 'voyage', label: 'Voyage', icon: '🧳' },
  { key: 'jour', label: 'Jour', icon: '☀️' },
  { key: 'carte', label: 'Carte', icon: '🗺️' },
  { key: 'budget', label: 'Budget', icon: '💶' },
  { key: 'amis', label: 'Amis', icon: '👥' },
];

function weekdayShort(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
}

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
  const { data, error, loading, status, savedAt, reload } = useTrip(String(id));
  const [tab, setTab] = useState<'voyage' | 'jour' | 'budget' | 'amis'>('voyage');
  const [chosenDay, setChosenDay] = useState<number | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
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

  // Rappels du téléphone : reprogrammés à chaque changement du voyage (sans effet sur le web ni si les rappels sont coupés).
  useEffect(() => {
    if (!data || savedAt) return;
    const placeName = (pid: number) => data.places.get(pid)?.name;
    void syncTripReminders(data.trip.id, buildReminders({ tripTitle: data.trip.title, startsOn: data.trip.starts_on, days: data.days, items: data.items, placeName })).catch(() => {});
  }, [data, savedAt]);

  if (guard) return guard;
  if (loading) return <Screen><Text variant="muted">Chargement du voyage…</Text></Screen>;
  if (error || !data) {
    return <Screen><ErrorNote message={error ?? 'Voyage introuvable.'} /><Button label="Retour à mes voyages" onPress={() => router.replace('/')} /></Screen>;
  }

  const active = data.members.filter((m) => !m.left_at);
  const travelers = Math.max(1, active.length);
  const { trip } = data;
  const destNames = destinationOptions.map((d) => d.name).join(' · ');
  // Grande photo : la capitale du pays, sinon la première ville, sinon l'image intégrée à l'appli.
  const heroPick = pickSource(photos[photoKeyFor(`${data?.trip.title ?? ''} ${destNames}`)], data?.capitalCover, data?.destinations[0]?.cover);
  const destDetail = data.destinations.map((d) => (d.nights > 0 ? `${d.name} (${d.nights} nuit${d.nights > 1 ? 's' : ''})` : d.name)).join(' → ');

  async function changeDestination(action: () => Promise<string | null>) {
    setDestError(await action());
    void reload();
  }
  const dates = trip.starts_on ? `${formatDay(trip.starts_on)}${trip.ends_on ? ` → ${formatDay(trip.ends_on)}` : ''}` : 'Dates à définir';

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
    else if (c === 'depense') setTab('budget');
    else { setTab('voyage'); setPendingMemo(true); }
  }

  function onNav(key: string) {
    if (key === 'accueil') router.replace('/');
    else if (key === 'carte') router.push({ pathname: '/map/[id]', params: { id: trip.id } });
    else setTab(key as typeof tab);
  }

  // Jour choisi : sa ville, sa photo, et les séries de jours par ville pour la bande du haut.
  const selIdx = Math.min(dayIndex, Math.max(data.days.length - 1, 0));
  const selDay = data.days[selIdx];
  const cityOfDay = (d: { city_id: number | null }) => d.city_id ?? data.destinations[0]?.city_id ?? null;
  const nameOfCity = (id: number | null) => data.destinations.find((x) => x.city_id === id)?.name ?? '';
  const selCity = selDay ? nameOfCity(cityOfDay(selDay)) : '';
  const dayPick = pickSource(photos[photoKeyFor(`${selCity} ${trip.title}`)], data.destinations.find((x) => x.city_id === (selDay ? cityOfDay(selDay) : null))?.cover, data.capitalCover);
  const runs = cityRuns(data.days.map(cityOfDay));
  const activitiesLine = data.budgetLines.find((l) => l.poste === 'activites');
  const dailyActivityBudget = activitiesLine && data.days.length ? Number(activitiesLine.amount) / data.days.length : null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {tab === 'voyage' ? (
          <ImageBackground source={heroPick.source} resizeMode="cover" style={styles.cover}>
            <View style={styles.veil} pointerEvents="none" />
            <SafeAreaView edges={['top']} style={styles.coverInner}>
              <View style={styles.coverBar}>
                <Pressable accessibilityRole="button" accessibilityLabel="Retour à mes voyages" onPress={() => router.replace('/')} style={styles.glass}>
                  <RNText style={styles.glassLabel}>← Mes voyages</RNText>
                </Pressable>
                <View style={styles.glass} accessibilityLiveRegion="polite">
                  <RNText style={styles.glassLabel}>{savedAt ? `Copie hors ligne · ${savedLabel(savedAt)}` : STATUS[status]}</RNText>
                </View>
              </View>
              <View style={styles.coverText}>
                <RNText style={[styles.eyebrow, { color: ON_PHOTO_ACCENT }]}>
                  {destNames ? `${destNames} · ` : ''}{data.days.length} jour{data.days.length > 1 ? 's' : ''} · {active.length} voyageur{active.length > 1 ? 's' : ''}
                </RNText>
                <RNText style={styles.poster} accessibilityRole="header">{trip.title}</RNText>
                <RNText style={styles.lead}>{dates}</RNText>
                {heroPick.cover?.credit ? (
                  <RNText style={{ fontFamily: fonts.sans, fontSize: 10, color: ON_PHOTO_SOFT }}>{heroPick.cover.credit}</RNText>
                ) : null}
              </View>
            </SafeAreaView>
          </ImageBackground>
        ) : tab === 'jour' && data.days.length > 0 ? (
          <ImageBackground source={dayPick.source} resizeMode="cover" style={styles.dayHero}>
            <View style={styles.veil} pointerEvents="none" />
            <SafeAreaView edges={['top']} style={styles.dayHeroInner}>
              <RNText style={[styles.eyebrow, { color: ON_PHOTO_ACCENT }]}>Jour {selIdx + 1} sur {data.days.length} · {formatDay(selDay.day_date)}</RNText>
              <RNText style={styles.poster} accessibilityRole="header">{selCity || trip.title}</RNText>
              <RNText style={styles.lead}>{selCity ? trip.title : dates}</RNText>
              {dayPick.cover?.credit ? <RNText style={{ fontFamily: fonts.sans, fontSize: 10, color: ON_PHOTO_SOFT }}>{dayPick.cover.credit}</RNText> : null}
            </SafeAreaView>
          </ImageBackground>
        ) : (
          <SafeAreaView edges={['top']} style={styles.slimHead}>
            <RNText style={[styles.eyebrow, { color: colors.accent }]}>{dates}</RNText>
            <RNText style={[styles.slimTitle, { color: colors.text }]} accessibilityRole="header">{trip.title}</RNText>
          </SafeAreaView>
        )}

        {tab === 'voyage' ? (
        <View style={styles.page}>
          {data.days.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <Text variant="label">Les journées · {data.days.length} jour{data.days.length > 1 ? 's' : ''}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {data.days.map((d, i) => {
                  const dest = data.destinations.find((x) => x.city_id === d.city_id);
                  const city = dest?.name ?? destinationOptions[0]?.name ?? '';
                  const tile = pickSource(photos[photoKeyFor(`${city} ${trip.title}`)], dest?.cover, data.capitalCover);
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

          <DestinationsCard data={data} onChanged={reload} />

          <MemoCard tripId={trip.id} memo={trip.memo ?? ''} onChanged={reload} startEditing={pendingMemo} onStarted={() => setPendingMemo(false)} />
          <StayCard data={data} userId={session?.user.id ?? null} onChanged={reload} />

          <WeatherCard destinations={data.destinations} forecasts={weather.forecasts} loading={weather.loading} error={weather.error} start={trip.starts_on} end={trip.ends_on} />

          <HoursCard data={data} onOpen={(i, itemId) => { setChosenDay(i); setFocusItem(itemId); setTab('jour'); }} />
          <ProgramCard data={data} onApplied={reload} />
          <UnplannedCard data={data} onChanged={reload} />
          <BookingsCard tripId={trip.id} />
          <ChecklistCard tripId={trip.id} />
          <ExportCard data={data} />
        </View>
        ) : null}

        {tab === 'jour' ? (
        <View style={styles.page}>
          {data.days.length === 0 ? <Card><Text variant="muted">Aucun jour pour l'instant. Ajoute le premier ci-dessous.</Text></Card> : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist">
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    {runs.map((r) => {
                      const here = selIdx >= r.start && selIdx < r.start + r.count;
                      return (
                        <View key={r.start} style={{ width: r.count * 56 + (r.count - 1) * 8, gap: 4 }}>
                          {r.start > 0 ? <View style={{ position: 'absolute', left: -5, top: 0, width: 2, height: 30, borderRadius: 1, backgroundColor: colors.line }} /> : null}
                          <RNText numberOfLines={1} style={[styles.runLabel, { color: here ? colors.accent : colors.text3 }]}>{nameOfCity(r.cityId) || 'Ville à choisir'}{r.count > 1 ? ` · ${r.count} j` : ''}</RNText>
                          <View style={{ height: 3, borderRadius: 2, backgroundColor: here ? colors.accent : colors.surface2 }} />
                        </View>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    {data.days.map((d, i) => {
                      const on = i === selIdx;
                      return (
                        <Pressable key={d.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`Jour ${i + 1}, ${formatDay(d.day_date)}`} onPress={() => setChosenDay(i)}
                          style={[styles.bubble, { backgroundColor: on ? colors.accent : colors.surface2 }]}>
                          <RNText style={[styles.bubbleNum, { color: on ? colors.onAccent : colors.text }]}>{i + 1}</RNText>
                          <RNText style={[styles.bubbleDay, { color: on ? colors.onAccent : colors.text3 }]}>{weekdayShort(d.day_date)}</RNText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
              {(() => {
                const i = Math.min(dayIndex, data.days.length - 1);
                const d = data.days[i];
                return <DayCard key={d.id} tripId={trip.id} tripTitle={trip.title} destinations={destinationOptions} day={d} number={i + 1} items={data.items} places={data.places} expenses={data.expenses} travelers={travelers} forecast={weather.forecasts.get(d.city_id ?? data.destinations[0]?.city_id ?? -1) ?? null} lodging={lodgingOf(d.stay_id, data.stays)} allDayIds={data.days.map((x) => x.id)} currency={trip.currency} dailyActivityBudget={dailyActivityBudget} onChanged={reload} openAdd={pendingAdd} onOpenedAdd={() => setPendingAdd(false)} focusItemId={focusItem} />;
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
        ) : null}

        {tab === 'budget' ? (
        <View style={styles.page}>
          <BudgetCard data={data} onChanged={reload} activitiesPanel={session ? <ToPayCard data={data} userId={session.user.id} onChanged={reload} embedded /> : undefined} />
          {session ? <AddExpenseCard data={data} userId={session.user.id} onChanged={reload} /> : null}
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

        </View>
        ) : null}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Ajouter" onPress={() => setPlusOpen(true)}
        style={{ position: 'absolute', right: 20, bottom: 84, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
        <RNText style={{ fontSize: 28, lineHeight: 30, color: colors.onAccent, fontFamily: fonts.sansBold }}>＋</RNText>
      </Pressable>
      <FloatingNav tabs={TABS} active={tab} onSelect={onNav} />
      <PlusMenu visible={plusOpen} onPick={onPlus} onClose={() => setPlusOpen(false)} />
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
  dayHero: { minHeight: 230, width: '100%' },
  dayHeroInner: { justifyContent: 'flex-end', gap: 4, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.lg, minHeight: 230, width: '100%', maxWidth: 880, alignSelf: 'center' },
  runLabel: { fontFamily: fonts.sansBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  slimHead: { width: '100%', maxWidth: 880, alignSelf: 'center', paddingHorizontal: space.lg, paddingTop: space.lg, gap: 4 },
  slimTitle: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 34 },
  dayTile: { width: 124, height: 128, borderRadius: radius.card, padding: 12, justifyContent: 'space-between', backgroundColor: '#101315', overflow: 'hidden' },
  tileVeil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.card, backgroundColor: 'rgba(7, 9, 11, 0.45)' },
  tileNumber: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 36, color: ON_PHOTO },
  tileCity: { fontFamily: fonts.sansBold, fontSize: 15, lineHeight: 17, color: ON_PHOTO },
  bubble: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  bubbleNum: { fontFamily: fonts.sansBold, fontSize: 18 },
  bubbleDay: { fontFamily: fonts.sansBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: fonts.sansBold, fontSize: 13, color: '#14100A' },
});

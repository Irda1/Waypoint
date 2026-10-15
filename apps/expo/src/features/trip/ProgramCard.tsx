import React, { useState } from 'react';
import { Linking, Pressable, Text as RNText, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, ErrorNote, Text } from '../../ui';
import { formatMoney } from '../../lib/format';
import { formatDuration } from '../../lib/search';
import { formatTime } from '../../domain/planning.ts';
import { bookedLegs, buildPlan, dayCost } from '../../domain/itinerary.ts';
import type { BookedLeg, PlannedDay, Spot } from '../../domain/itinerary.ts';
import { applyPlan, loadCandidates } from '../../data/itinerary';
import { loadBookings } from '../../data/bookings';
import { useCategories } from '../../data/categories';
import type { TripData } from '../../data/useTrip';
import { useTheme } from '../../theme/useTheme';
import { categoryColors, fonts, space } from '../../theme/tokens';
import { formatDay } from '../../lib/format';
import { iconFor } from '../../theme/categoryIcons';
import { Icon } from '../../ui/Icon';
import { HOME_KEY, tripHomeKey } from './FlightsCard';

const BADGE = { pour_toi: 'Pour toi', incontournable: 'Incontournable' } as const;

/** Propose un programme pour les jours encore vides ; l'utilisateur retire ce qu'il ne veut pas, puis applique. */
export function ProgramCard({ data, onApplied }: { data: TripData; onApplied: () => void }) {
  const { colors, mode } = useTheme();
  const categories = useCategories();
  const [plan, setPlan] = useState<{ dayId: string; plan: PlannedDay }[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Awaited<ReturnType<typeof loadCandidates>>['candidates']>([]);
  // Ville de départ et vols ou trains réservés : lus au moment de proposer, gardés pour recalculer après un « Retirer ».
  const [context, setContext] = useState<{ home: Spot | null; booked: BookedLeg[] }>({ home: null, booked: [] });

  const { trip } = data;
  const busyDays = new Set(data.items.map((i) => i.day_id));
  const emptyDays = data.days.filter((d) => !busyDays.has(d.id));
  const inTrip = new Set(data.items.map((i) => i.place_id).filter((id): id is number => id != null));
  const cityIds = [...new Set(data.days.map((d) => d.city_id).filter((c): c is number => c != null).concat(data.destinations.map((d) => d.city_id)))];
  const travelers = Math.max(trip.travelers, 1);
  const activityBudget = trip.budget_total ? (trip.budget_total * 0.15) / Math.max(data.days.length, 1) : null;

  // Tous les jours sont passés (ceux déjà programmés servent à savoir où l'on dort), avec l'hébergement de chaque nuit.
  function compute(cands: typeof candidates, ex: Set<number>, ctx: typeof context) {
    const days = data.days.map((d) => {
      const stay = data.stays.find((s) => s.id === d.stay_id);
      return {
        date: d.day_date, cityId: d.city_id ?? data.destinations[0]?.city_id ?? null, fixed: busyDays.has(d.id),
        stay: stay && stay.lat != null && stay.lng != null ? { name: stay.name, lat: stay.lat, lng: stay.lng } : null,
      };
    });
    const cities = new Map(data.destinations.map((d) => [d.city_id, { name: d.name, lat: d.lat, lng: d.lng }]));
    const built = buildPlan(days, cands, { interests: trip.styles, travelers, activityBudgetPerDay: activityBudget, excluded: new Set([...ex, ...inTrip]), cities, home: ctx.home, booked: ctx.booked });
    setPlan(built.map((p, i) => ({ dayId: data.days[i].id, plan: p })).filter((p) => !busyDays.has(p.dayId)));
  }

  async function propose() {
    setBusy(true); setError(null);
    const [res, saved, bookings] = await Promise.all([
      loadCandidates(cityIds, categories.rootOf),
      // Ville de départ (carte Vols ou assistant) : le premier jour commence par le trajet depuis elle.
      AsyncStorage.getItem(tripHomeKey(trip.id)).then((v) => v ?? AsyncStorage.getItem(HOME_KEY)).catch(() => null),
      loadBookings(trip.id),
    ]);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    let from: Spot | null = null;
    try { const h = saved ? (JSON.parse(saved) as Spot) : null; from = h && typeof h.name === 'string' && typeof h.lat === 'number' && typeof h.lng === 'number' ? { name: h.name, lat: h.lat, lng: h.lng } : null; } catch { /* ignorée */ }
    const ctx = { home: from, booked: bookedLegs(bookings) };
    setContext(ctx);
    setCandidates(res.candidates);
    setExcluded(new Set());
    compute(res.candidates, new Set(), ctx);
  }

  function remove(placeId: number) {
    const next = new Set(excluded).add(placeId);
    setExcluded(next);
    compute(candidates, next, context);
  }

  async function apply() {
    if (!plan) return;
    setBusy(true);
    const err = await applyPlan(trip.id, plan.filter((p) => p.plan.items.length));
    setBusy(false);
    if (err) { setError(err); return; }
    setPlan(null);
    onApplied();
  }

  if (emptyDays.length === 0) return null;
  const nothing = plan !== null && plan.every((p) => p.plan.empty);

  return (
    <Card>
      <Text variant="label">Programme automatique</Text>
      {plan === null ? (
        <>
          <Text variant="muted">Waypoint peut remplir {emptyDays.length > 1 ? `les ${emptyDays.length} jours vides` : 'le jour vide'} selon tes envies, ton budget et la proximité de ton hébergement, avec les trajets entre les villes (tes vols et trains réservés compris). Tu gardes la main : tu retires ce que tu ne veux pas avant de valider, et rien de ce que tu as déjà prévu n'est touché.</Text>
          <ErrorNote message={error} />
          <Button label="Proposer un programme" onPress={propose} loading={busy} />
        </>
      ) : (
        <>
          {nothing ? <Text variant="muted">Aucun lieu disponible pour ces jours. Les lieux de la ville n'ont peut-être pas encore été collectés : demande-les depuis « Ajouter un lieu ».</Text> : null}
          {plan.map(({ dayId, plan: d }) => (
            <View key={dayId} style={{ gap: space.xs }}>
              <Text variant="label" style={{ textTransform: 'capitalize' }}>{formatDay(d.date)}{dayCost(d, travelers) > 0 ? ` · ≈ ${formatMoney(dayCost(d, travelers), trip.currency)}` : ''}</Text>
              {d.empty ? <Text variant="muted">Rien à proposer (aucun lieu ouvert ce jour-là).</Text> : d.items.map((i, k) => {
                const name = i.place?.name ?? i.title ?? 'Étape';
                const dot = categoryColors[mode][i.root ?? ''] ?? colors.text3;
                return (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 }}>
                    <View style={{ width: 48 }}>
                      <Text variant="mono" style={{ color: colors.text2, fontSize: 14 }}>{formatTime(i.startMin)}</Text>
                      {i.kind === 'transfer' || i.kind === 'arrival' ? <Text variant="mono" style={{ color: colors.text3, fontSize: 12.5 }}>{formatTime(i.startMin + i.durationMin)}</Text> : null}
                    </View>
                    <View accessible={false} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${dot}33`, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={i.kind === 'arrival' ? 'trip' : iconFor(i.root ?? '')} size={15} color={dot} />
                    </View>
                    {/* Toucher une étape ouvre le lieu dans Google Maps ; une étape sans lieu ne fait rien. */}
                    <Pressable disabled={!i.place} accessibilityRole={i.place ? 'link' : undefined} accessibilityLabel={i.place ? `Ouvrir ${name} dans Google Maps` : name}
                      onPress={() => { if (i.place) void Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(name)}/@${i.place.lat},${i.place.lng},17z`); }} style={{ flex: 1 }}>
                      <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{name}</Text>
                      <Text variant="muted">{[i.note, i.place && i.place.visit_duration_min ? `≈ ${formatDuration(i.durationMin)}` : null, ...i.badges.map((b) => BADGE[b])].filter(Boolean).join(' · ')}</Text>
                    </Pressable>
                    {i.place ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${name} de la proposition`} onPress={() => remove(i.place!.id)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
                        <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger, opacity: 0.85 }}>Retirer</RNText>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
          <Text variant="muted">Durées et prix : estimations d'après la catégorie du lieu. Les trajets sont estimés à vol d'oiseau.</Text>
          <ErrorNote message={error} />
          {!nothing ? <Button label="Appliquer ce programme" onPress={apply} loading={busy} /> : null}
          <Button label="Annuler" variant="ghost" onPress={() => { setPlan(null); setError(null); }} />
        </>
      )}
    </Card>
  );
}

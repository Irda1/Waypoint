import React, { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, PayBadge, Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { categoryColors, fonts, space } from '../../theme/tokens';
import { formatDay, isTime } from '../../lib/format';
import { formatTime, scheduleDay } from '../../domain/planning.ts';
import { organizeTimes } from '../../domain/itinerary.ts';
import { applyTimes } from '../../data/itinerary';
import { paymentState } from '../../domain/budget.ts';
import type { Expense, Place, TripItem } from '../../domain/types.ts';
import { addItem, deleteItem, setItemTime } from '../../data/trips';
import { useCategories } from '../../data/categories';
import { useWalkRoutes } from '../../data/routes';
import { PlacePicker } from './PlacePicker';
import type { CityOption } from '../../data/places';
import type { Day } from '../../data/useTrip';
import { describeCode, tempRange, weatherForDay } from '../../domain/weather.ts';
import type { Forecast } from '../../domain/weather.ts';

interface Props {
  tripId: string;
  tripTitle: string;
  destinations: CityOption[];
  day: Day;
  /** Numéro du jour dans le voyage, à partir de 1. */
  number: number;
  items: TripItem[];
  places: Map<number, Place>;
  expenses: Pick<Expense, 'amount' | 'item_id'>[];
  travelers: number;
  /** Prévisions de la ville de ce jour, si connues. */
  forecast?: Forecast | null;
  onChanged: () => void;
}

export function DayCard({ tripId, tripTitle, destinations, day, number, items, places, expenses, travelers, forecast, onChanged }: Props) {
  const { colors, mode } = useTheme();
  const categories = useCategories();
  const [plan, setPlan] = useState<'A' | 'B' | 'C'>('A');
  const [adding, setAdding] = useState<null | 'place' | 'free'>(null);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');

  const schedule = scheduleDay({ date: day.day_date, plan, items: items.filter((i) => i.day_id === day.id), places });
  // Trajets à pied : durée réelle (itinéraire piéton) quand le service répond, estimation sinon.
  const walkLegs = schedule.flatMap((s, i) => (s.travelFromPrevious?.mode === 'walk' && schedule[i - 1]?.place && s.place
    ? [{ key: s.item.id, from: schedule[i - 1].place!, to: s.place }] : []));
  const walks = useWalkRoutes(walkLegs);
  const lastPosition = schedule.reduce((max, s) => Math.max(max, s.item.position), 0);

  async function add() {
    if (!title.trim()) { setError('Donne un nom à l\'étape.'); return; }
    if (time && !isTime(time)) { setError('Heure au format 09:30.'); return; }
    const err = await addItem({ tripId, dayId: day.id, title, startTime: time || null, position: lastPosition + 1 });
    setError(err);
    if (!err) { setTitle(''); setTime(''); setAdding(null); onChanged(); }
  }

  const weather = forecast ? weatherForDay(forecast, day.day_date, schedule.map((s) => categories.rootOf(s.place?.category_code ?? s.item.category_code ?? ''))) : null;
  const untimed = schedule.filter((s) => s.startMin == null).length;
  async function tidy() {
    const changes = organizeTimes(schedule.map((s) => ({
      id: s.item.id, place: s.place ?? null, root: categories.rootOf(s.place?.category_code ?? s.item.category_code ?? ''),
      startTime: s.item.start_time, durationMin: s.item.duration_min, position: s.item.position,
    })));
    setError(await applyTimes(changes));
    onChanged();
  }

  async function saveTime(itemId: string) {
    if (editTime && !isTime(editTime)) { setError('Heure au format 09:30.'); return; }
    const err = await setItemTime(itemId, editTime || null);
    setError(err);
    if (!err) { setEditing(null); onChanged(); }
  }

  return (
    <Card>
      <View style={{ gap: space.xs }}>
        <Text variant="label" style={{ color: colors.accent }}>Jour {number}</Text>
        <Text variant="heading" style={{ textTransform: 'capitalize' }}>{formatDay(day.day_date)}</Text>
      </View>
      {weather ? (
        <View style={{ gap: 2 }} accessibilityLabel={`Météo prévue : ${describeCode(weather.day.code).label}, ${tempRange(weather.day)}`}>
          <Text variant="muted">{describeCode(weather.day.code).icon} {describeCode(weather.day.code).label} · {tempRange(weather.day)} · prévision</Text>
          {weather.advice ? <Text variant="muted" style={{ color: colors.warm }}>{weather.advice}</Text> : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="tablist">
        {(['A', 'B', 'C'] as const).map((p) => <Chip key={p} label={`Plan ${p}`} selected={plan === p} onPress={() => setPlan(p)} />)}
      </View>

      {schedule.length === 0 ? <Text variant="muted">Rien de prévu dans ce plan.</Text> : null}
      <View>
        {schedule.map((s, index) => {
          const state = paymentState(s.item, s.place, expenses, travelers);
          const category = s.place?.category_code ?? s.item.category_code ?? '';
          const dot = categoryColors[mode][categories.rootOf(category)] ?? colors.text3;
          const isLast = index === schedule.length - 1;
          const name = s.place?.name ?? s.item.title ?? 'Étape';
          return (
            <View key={s.item.id}>
              {s.travelFromPrevious ? (
                <Text variant="muted" style={{ paddingLeft: 52 + space.md + 16, paddingBottom: space.xs }}>
                  {walks.get(s.item.id)
                    ? `${walks.get(s.item.id)!.minutes} min à pied · ${walks.get(s.item.id)!.km.toString().replace('.', ',')} km (itinéraire piéton)`
                    : `≈ ${s.travelFromPrevious.minutes} min ${s.travelFromPrevious.mode === 'walk' ? 'à pied' : 'en transports'} · estimé`}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: space.md, minHeight: 56 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Modifier l'heure de ${name}`}
                  onPress={() => { setEditing(s.item.id); setEditTime(s.item.start_time ? s.item.start_time.slice(0, 5) : ''); setError(null); }}
                  style={{ width: 52, minHeight: 32 }}
                >
                  <Text variant="mono" style={{ color: s.startMin != null ? colors.text2 : colors.accent, fontSize: 14, paddingTop: 1 }}>
                    {s.startMin != null ? formatTime(s.startMin) : '--:--'}
                  </Text>
                </Pressable>
                <View style={{ alignItems: 'center', width: 16 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot, marginTop: 5 }} />
                  {!isLast ? <View style={{ flex: 1, width: 1, backgroundColor: colors.lineStrong, marginTop: 4 }} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: space.md, gap: 2 }}>
                  <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{name}</Text>
                  {s.issues.map((issue) => (
                    <Text key={issue.type} variant="muted" style={{ color: colors.warm }}>
                      {issue.type === 'closed_day' ? 'Fermé ce jour-là' : issue.type === 'overlap' ? `Chevauche l'étape précédente de ${issue.minutes} min (trajet compris)` : 'Heure à choisir'}
                    </Text>
                  ))}
                  {editing === s.item.id ? (
                    <View style={{ gap: space.sm, paddingVertical: space.xs }}>
                      <Field label="Heure de début" value={editTime} onChangeText={setEditTime} placeholder="09:30 (vide pour effacer)" keyboardType="numbers-and-punctuation" />
                      <View style={{ flexDirection: 'row', gap: space.sm }}>
                        <Button label="Enregistrer" onPress={() => saveTime(s.item.id)} />
                        <Button label="Annuler" variant="ghost" onPress={() => { setEditing(null); setError(null); }} />
                      </View>
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer ${name}`}
                    hitSlop={8}
                    onPress={async () => { setError(await deleteItem(s.item.id)); onChanged(); }}
                    style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}
                  >
                    <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text3 }}>Retirer</RNText>
                  </Pressable>
                </View>
                <PayBadge state={state} />
              </View>
            </View>
          );
        })}
      </View>

      {adding === 'place' ? (
        <PlacePicker
          tripId={tripId}
          dayId={day.id}
          tripTitle={tripTitle}
          destinations={destinations}
          defaultCityId={day.city_id}
          nextPosition={lastPosition + 1}
          existingPlaceIds={new Set(schedule.map((s) => s.place?.id).filter((id): id is number => id != null))}
          onAdded={onChanged}
          onClose={() => setAdding(null)}
        />
      ) : adding === 'free' ? (
        <View style={{ gap: space.sm }}>
          <Field label="Nouvelle étape" value={title} onChangeText={setTitle} placeholder="Ex. Déjeuner à la Ribeira" />
          <Field label="Heure (facultatif)" value={time} onChangeText={setTime} placeholder="09:30" keyboardType="numbers-and-punctuation" />
          <ErrorNote message={error} />
          <Button label="Ajouter l'étape" onPress={add} />
          <Button label="Annuler" variant="ghost" onPress={() => { setAdding(null); setError(null); }} />
        </View>
      ) : (
        <>
          <ErrorNote message={error} />
          {untimed > 0 ? <Button label={`Ranger les horaires (${untimed})`} variant="ghost" onPress={tidy} /> : null}
          <Button label="+ Ajouter un lieu" onPress={() => setAdding('place')} />
          <Button label="+ Étape libre" variant="ghost" onPress={() => setAdding('free')} />
        </>
      )}
    </Card>
  );
}

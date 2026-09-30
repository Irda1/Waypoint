import React, { useEffect, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, PayBadge, Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { categoryColors, fonts, radius, space } from '../../theme/tokens';
import { formatDay, isTime } from '../../lib/format';
import { formatTime, scheduleDay } from '../../domain/planning.ts';
import { organizeTimes } from '../../domain/itinerary.ts';
import { applyTimes } from '../../data/itinerary';
import { amountDue, paymentState, posteForCategory } from '../../domain/budget.ts';
import type { Expense, Place, TripItem } from '../../domain/types.ts';
import { swapWithNeighbor } from '../../domain/reorder.ts';
import { addExpense, addItem, applyItemMoves, copyItemsToPlan, deleteItem, setDayHours, setItemTime } from '../../data/trips';
import { deriveAltPlan } from '../../domain/altplan.ts';
import { DEFAULT_DEPART, DEFAULT_RETURN, dayHours, hoursIssues, liveStatus } from '../../domain/dayhours.ts';
import { todayIso } from '../../lib/dates.ts';
import { useCategories } from '../../data/categories';
import { LegRow } from './LegRow';
import { dayTips } from '../../domain/advice.ts';
import { formatMoney } from '../../lib/format';
import type { Point } from '../../domain/routes.ts';
import { PlacePicker } from './PlacePicker';
import { PlaceSheet } from './PlaceSheet';
import { useAuth } from '../../auth/AuthProvider';
import { formatDuration } from '../../lib/search';
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
  /** Hébergement de la nuit (avec coordonnées) : trajets vers la première étape et depuis la dernière. */
  lodging?: (Point & { name: string }) | null;
  /** Monnaie du voyage et budget « activités » par jour, pour la recommandation de budget. */
  currency?: string;
  dailyActivityBudget?: number | null;
  onChanged: () => void;
  /** Le menu « + » demande d'ouvrir tout de suite la recherche de lieux. */
  openAdd?: boolean;
  onOpenedAdd?: () => void;
}

export function DayCard({ tripId, tripTitle, destinations, day, number, items, places, expenses, travelers, forecast, lodging, currency = 'EUR', dailyActivityBudget = null, onChanged, openAdd = false, onOpenedAdd }: Props) {
  const { colors, mode } = useTheme();
  const categories = useCategories();
  const { session } = useAuth();
  const [plan, setPlan] = useState<'A' | 'B' | 'C'>('A');
  const [adding, setAdding] = useState<null | 'place' | 'free'>(null);
  useEffect(() => { if (openAdd) { setAdding('place'); onOpenedAdd?.(); } }, [openAdd]); // eslint-disable-line react-hooks/exhaustive-deps
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState(false);
  const [departInput, setDepartInput] = useState('');
  const [returnInput, setReturnInput] = useState('');

  const schedule = scheduleDay({ date: day.day_date, plan, items: items.filter((i) => i.day_id === day.id), places });
  const planA = plan === 'A' ? schedule : scheduleDay({ date: day.day_date, plan: 'A', items: items.filter((i) => i.day_id === day.id), places });
  async function createAlt(kind: 'light' | 'shelter') {
    const keep = new Set(deriveAltPlan(kind, planA.map((s) => ({
      itemId: s.item.id,
      root: categories.rootOf(s.place?.category_code ?? s.item.category_code ?? ''),
      durationMin: s.startMin != null && s.endMin != null ? s.endMin - s.startMin : s.item.duration_min ?? s.place?.visit_duration_min ?? 60,
      travelMin: s.travelFromPrevious?.minutes ?? 0,
    }))));
    const err = await copyItemsToPlan({ tripId, dayId: day.id, plan: plan === 'C' ? 'C' : 'B', items: planA.filter((s) => keep.has(s.item.id)).map((s) => s.item) });
    setError(err);
    if (!err) onChanged();
  }
  const lastPosition = schedule.reduce((max, s) => Math.max(max, s.item.position), 0);

  async function add() {
    if (!title.trim()) { setError('Donne un nom à l\'étape.'); return; }
    if (time && !isTime(time)) { setError('Heure au format 09:30.'); return; }
    const err = await addItem({ tripId, dayId: day.id, title, startTime: time || null, position: lastPosition + 1 });
    setError(err);
    if (!err) { setTitle(''); setTime(''); setAdding(null); onChanged(); }
  }

  const weather = forecast ? weatherForDay(forecast, day.day_date, schedule.map((s) => categories.rootOf(s.place?.category_code ?? s.item.category_code ?? ''))) : null;
  const tips = dayTips({
    stops: schedule.map((s) => ({
      name: s.place?.name ?? s.item.title ?? 'Étape',
      root: categories.rootOf(s.place?.category_code ?? s.item.category_code ?? ''),
      startMin: s.startMin, endMin: s.endMin,
      durationMin: s.startMin != null && s.endMin != null ? s.endMin - s.startMin : s.item.duration_min ?? s.place?.visit_duration_min ?? 60,
      travelMin: s.travelFromPrevious?.minutes ?? 0,
    })),
    weather,
    dayCost: schedule.reduce((sum, s) => sum + (s.place?.price_amount ?? 0) * travelers, 0),
    dailyActivityBudget,
    formatMoney: (n) => formatMoney(n, currency),
  });
  const hours = dayHours(day.depart_time, day.return_time);
  const hIssues = hoursIssues(schedule, hours, lodging ?? null);
  const isToday = day.day_date === todayIso();
  const now = new Date();
  const live = isToday && schedule.some((s) => s.startMin != null) ? liveStatus(schedule, now.getHours() * 60 + now.getMinutes()) : null;
  function openHours() { setDepartInput(hours.depart); setReturnInput(hours.return); setEditHours(true); setError(null); }
  async function saveHours(reset: boolean) {
    const d = reset ? DEFAULT_DEPART : departInput;
    const r = reset ? DEFAULT_RETURN : returnInput;
    if (!isTime(d) || !isTime(r)) { setError('Heures au format 09:30.'); return; }
    const err = await setDayHours(day.id, d === DEFAULT_DEPART ? null : d, r === DEFAULT_RETURN ? null : r);
    setError(err);
    if (!err) { setEditHours(false); onChanged(); }
  }
  const untimed = schedule.filter((s) => s.startMin == null).length;
  async function tidy() {
    const changes = organizeTimes(schedule.map((s) => ({
      id: s.item.id, place: s.place ?? null, root: categories.rootOf(s.place?.category_code ?? s.item.category_code ?? ''),
      startTime: s.item.start_time, durationMin: s.item.duration_min, position: s.item.position,
    })));
    setError(await applyTimes(changes));
    onChanged();
  }

  async function move(index: number, dir: -1 | 1) {
    const moves = swapWithNeighbor(schedule.map((x) => ({ id: x.item.id, start_time: x.item.start_time, position: x.item.position })), index, dir);
    if (!moves.length) return;
    setError(await applyItemMoves(moves));
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
      {schedule.length === 0 && plan !== 'A' && planA.length > 0 ? (
        <Button label={plan === 'B' ? 'Créer une journée allégée depuis le plan A' : 'Créer un plan à l\'abri depuis le plan A'} variant="ghost" onPress={() => createAlt(plan === 'B' ? 'light' : 'shelter')} />
      ) : null}
      {schedule.length === 0 && plan !== 'A' && planA.length > 0 ? (
        <Text variant="muted">{plan === 'B' ? 'Garde les repas et retire les visites les plus longues.' : 'Retire les activités de plein air (nature, sport).'}</Text>
      ) : null}
      {schedule.filter((s) => s.issues.some((i) => i.type === 'closed_day')).map((s) => (
        <View key={`closed-${s.item.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.field, backgroundColor: colors.surface2 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warm }} />
          <Text variant="body" style={{ flex: 1, fontFamily: fonts.sansSemi }}>{s.place?.name ?? s.item.title ?? 'Étape'} est fermé ce jour-là</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Voir la fiche" onPress={() => setSheetId(s.item.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <RNText style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.accent }}>Voir</RNText>
          </Pressable>
        </View>
      ))}
      {live && schedule.length > 0 ? (
        <View style={{ gap: 2, padding: space.md, borderRadius: radius.field, backgroundColor: colors.surface2 }} accessibilityLabel="En ce moment">
          <Text variant="label" style={{ color: colors.accent }}>En ce moment</Text>
          {live.current ? (
            <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>
              {schedule[live.current.index].place?.name ?? schedule[live.current.index].item.title ?? 'Étape'} · il reste {formatDuration(live.current.remainingMin)}
            </Text>
          ) : <Text variant="body">{live.next ? 'Pas d\'étape en cours.' : 'Journée terminée.'}</Text>}
          {live.next ? (
            <Text variant="muted">
              Ensuite : {schedule[live.next.index].place?.name ?? schedule[live.next.index].item.title ?? 'Étape'} à {formatTime(live.next.startMin)}
              {live.next.travelMin ? ` · ${live.next.travelMin} min de trajet` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}
      {hIssues.map((h) => (
        <View key={h.kind} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.field, backgroundColor: colors.surface2 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warm }} />
          <Text variant="body" style={{ flex: 1, fontFamily: fonts.sansSemi }}>
            {h.kind === 'late_return' ? `Retour vers ${h.at}, après ${hours.return}` : `Première étape à ${h.at}, avant ${hours.depart}`}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Changer l'heure" onPress={openHours} style={{ minHeight: 44, justifyContent: 'center' }}>
            <RNText style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.accent }}>Changer</RNText>
          </Pressable>
        </View>
      ))}
      {tips.length ? (
        <View style={{ gap: space.xs, padding: space.md, borderRadius: radius.field, backgroundColor: colors.surface2 }} accessibilityLabel="Conseils pour cette journée">
          <Text variant="label">Conseils</Text>
          {tips.map((t) => <Text key={t.id} variant="muted">💡 {t.text}</Text>)}
        </View>
      ) : null}
      <View>
        {schedule.map((s, index) => {
          const state = paymentState(s.item, s.place, expenses, travelers);
          const category = s.place?.category_code ?? s.item.category_code ?? '';
          const dot = categoryColors[mode][categories.rootOf(category)] ?? colors.text3;
          const isLast = index === schedule.length - 1;
          const name = s.place?.name ?? s.item.title ?? 'Étape';
          return (
            <View key={s.item.id}>
              {index === 0 && lodging && s.place ? <LegRow from={lodging} to={s.place} fromName={lodging.name} toName={s.place.name} /> : null}
              {index > 0 && schedule[index - 1].place && s.place ? <LegRow from={schedule[index - 1].place!} to={s.place} fromName={schedule[index - 1].place!.name} toName={s.place.name} /> : null}
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
                  {s.endMin != null ? <Text variant="mono" style={{ color: colors.text3, fontSize: 12.5 }}>{formatTime(s.endMin)}</Text> : null}
                </Pressable>
                <View style={{ alignItems: 'center', width: 16 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot, marginTop: 5 }} />
                  {!isLast ? <View style={{ flex: 1, width: 1, backgroundColor: colors.lineStrong, marginTop: 4 }} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: space.md, gap: 2 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir la fiche de ${name}`} onPress={() => setSheetId(s.item.id)}>
                    <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{name}</Text>
                  </Pressable>
                  {live ? <Text variant="muted" style={{ color: live.states[index] === 'current' ? colors.accent : colors.text3, fontFamily: fonts.sansSemi }}>{live.states[index] === 'past' ? 'Passé' : live.states[index] === 'current' ? 'En cours' : 'À venir'}</Text> : null}
                  {(() => {
                    const dur = s.startMin != null && s.endMin != null ? s.endMin - s.startMin : s.item.duration_min ?? s.place?.visit_duration_min ?? null;
                    const price = s.place?.price_amount;
                    const meta = [dur ? formatDuration(dur) : null, price != null ? (price === 0 ? 'Gratuit' : formatMoney(price * travelers, currency)) : null].filter(Boolean).join(' · ');
                    return meta ? <Text variant="muted">{meta}</Text> : null;
                  })()}
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
                  <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer ${name}`}
                      hitSlop={8}
                      onPress={async () => { setError(await deleteItem(s.item.id)); onChanged(); }}
                      style={{ minHeight: 32, justifyContent: 'center' }}
                    >
                      <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text3 }}>Retirer</RNText>
                    </Pressable>
                    {index > 0 ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Monter ${name}`} hitSlop={8} onPress={() => move(index, -1)} style={{ minHeight: 32, justifyContent: 'center' }}>
                        <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text3 }}>↑ Monter</RNText>
                      </Pressable>
                    ) : null}
                    {!isLast ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Descendre ${name}`} hitSlop={8} onPress={() => move(index, 1)} style={{ minHeight: 32, justifyContent: 'center' }}>
                        <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text3 }}>↓ Descendre</RNText>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <PayBadge state={state} />
              </View>
            </View>
          );
        })}
        {lodging && schedule.length > 0 && schedule[schedule.length - 1].place ? <LegRow from={schedule[schedule.length - 1].place!} to={lodging} fromName={schedule[schedule.length - 1].place!.name} toName={lodging.name} /> : null}
      </View>

      {editHours ? (
        <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.field, backgroundColor: colors.surface2 }}>
          <Text variant="label">Horaires du jour</Text>
          <Field label="Départ du logement" value={departInput} onChangeText={setDepartInput} placeholder="09:30" keyboardType="numbers-and-punctuation" />
          <Field label="Retour souhaité" value={returnInput} onChangeText={setReturnInput} placeholder="23:30" keyboardType="numbers-and-punctuation" />
          <ErrorNote message={error} />
          <Button label="Enregistrer" onPress={() => saveHours(false)} />
          <Button label="Remettre par défaut" variant="ghost" onPress={() => saveHours(true)} />
          <Button label="Annuler" variant="ghost" onPress={() => { setEditHours(false); setError(null); }} />
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Modifier les horaires du jour" onPress={openHours} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text variant="muted">Horaires · départ {hours.depart} · retour {hours.return}{hours.isDefault ? ' (par défaut)' : ''}  ·  <Text variant="muted" style={{ color: colors.accent, fontFamily: fonts.sansSemi }}>Modifier</Text></Text>
        </Pressable>
      )}

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
      {(() => {
        const s = schedule.find((x) => x.item.id === sheetId);
        if (!s) return null;
        const category = s.place?.category_code ?? s.item.category_code ?? '';
        return (
          <PlaceSheet visible tripId={tripId} placeId={s.place?.id ?? null} name={s.place?.name ?? s.item.title ?? 'Étape'} category={categories.byCode.get(category)?.name_fr ?? 'Étape'}
            dot={categoryColors[mode][categories.rootOf(category)] ?? colors.text3} place={s.place ?? null} currency={currency} travelers={travelers}
            closedToday={s.issues.some((i) => i.type === 'closed_day')}
            due={amountDue(s.item, s.place, expenses, travelers)}
            onPay={session ? async () => {
              const err = await addExpense({ tripId, label: s.place?.name ?? s.item.title ?? 'Étape', poste: posteForCategory(categories.rootOf(category)), amount: amountDue(s.item, s.place, expenses, travelers), currency, paidBy: session.user.id, itemId: s.item.id });
              if (!err) onChanged();
              return err;
            } : undefined}
            onRemove={async () => { setError(await deleteItem(s.item.id)); onChanged(); }} onClose={() => setSheetId(null)} />
        );
      })()}
    </Card>
  );
}

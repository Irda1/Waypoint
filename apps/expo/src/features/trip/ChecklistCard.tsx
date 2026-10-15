import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, ErrorNote, Field, Text } from '../../ui';
import { cleanLabel, orderItems, progress } from '../../domain/checklist.ts';
import type { CheckItem } from '../../domain/checklist.ts';
import { GROUPS, baseLabel, groupOf, newIdeas, packFacts, packingIdeas } from '../../domain/packing.ts';
import type { PackContext, PackIdea } from '../../domain/packing.ts';
import type { Forecast } from '../../domain/weather.ts';
import { diffDays } from '../../lib/dates.ts';
import { addItems, removeItem, setDone, useChecklist } from '../../data/checklist';
import type { TripData } from '../../data/useTrip';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';

// Idées écartées (×) : gardées sur l'appareil, elles ne reviennent pas.
const dismissKey = (tripId: string) => `waypoint.valise.dismissed.${tripId}`;

/** Contexte de la valise à partir du voyage et des prévisions déjà chargées par l'écran. */
function contextOf(data: TripData, forecasts: Map<number, Forecast>): PackContext {
  const { trip, days, destinations } = data;
  const first = days[0]?.day_date ?? trip.starts_on;
  const nights = trip.starts_on && trip.ends_on ? diffDays(trip.starts_on, trip.ends_on) : Math.max(days.length - 1, destinations.reduce((n, d) => n + d.nights, 0));
  const cityName = (id: number | null) => destinations.find((d) => d.city_id === id)?.name ?? '';
  let min: number | null = null, max: number | null = null, covered = false;
  const rainy: { city: string; date: string }[] = [];
  for (const d of days) {
    const city = d.city_id ?? destinations[0]?.city_id ?? null;
    const f = city !== null ? forecasts.get(city)?.days.find((x) => x.date === d.day_date) : undefined;
    if (!f) continue;
    covered = true;
    if (f.min !== null) min = min === null ? f.min : Math.min(min, f.min);
    if (f.max !== null) max = max === null ? f.max : Math.max(max, f.max);
    if ((f.rainProb ?? 0) >= 60) rainy.push({ city: cityName(city), date: d.day_date });
  }
  const dayDate = new Map(days.map((d) => [d.id, d.day_date]));
  const activities = data.items.filter((i) => i.plan === 'A').flatMap((i) => {
    const place = i.place_id !== null ? data.places.get(i.place_id) : undefined;
    const code = place?.category_code ?? i.category_code, date = dayDate.get(i.day_id);
    return code && date ? [{ code, name: place?.name ?? i.title ?? '', date }] : [];
  });
  return {
    country: trip.country_code ?? destinations[0]?.country_code ?? null, currency: trip.currency, nights, party: trip.party_type ?? null,
    month: first ? Number(first.slice(5, 7)) : null, lat: destinations[0]?.lat ?? null, weather: { covered, min, max, rainy }, activities,
  };
}

/** « Valise » : liste commune du voyage, cochée pour tout le monde, avec des idées selon la météo, la durée, les voyageurs, le programme et le pays. */
export function ChecklistCard({ tripId, data, forecasts }: { tripId: string; data: TripData; forecasts: Map<number, Forecast> }) {
  const { colors } = useTheme();
  const { items, setItems, error: loadError, loading, reload } = useChecklist(tripId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(dismissKey(tripId)).then((v) => { try { setDismissed(v ? (JSON.parse(v) as string[]) : []); } catch { setDismissed([]); } }).catch(() => {});
  }, [tripId]);

  const ctx = useMemo(() => contextOf(data, forecasts), [data, forecasts]);
  const ideas = useMemo(() => packingIdeas(ctx), [ctx]);
  const left = newIdeas(ideas, items.map((i) => i.label), dismissed);
  const showIdeas = open || (!loading && items.length === 0);

  async function add(labels: string[]) {
    setError(null);
    const err = await addItems(tripId, labels);
    if (err) setError(err); else { setText(''); void reload(); }
  }
  async function submit() {
    const label = cleanLabel(text, items);
    if (!label) { setError(text.trim() ? 'Déjà dans la valise.' : null); return; }
    await add([label]);
  }
  async function toggle(id: string, done: boolean) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, done } : i)));   // affichage immédiat
    const err = await setDone(id, done);
    if (err) { setError(err); void reload(); }
  }
  function dismiss(label: string) {
    const next = [...dismissed, baseLabel(label)];
    setDismissed(next);
    void AsyncStorage.setItem(dismissKey(tripId), JSON.stringify(next)).catch(() => {});
  }
  async function remove(item: CheckItem) {
    const err = await removeItem(item.id);
    if (err) { setError(err); return; }
    if (groupOf(item.label, ideas) !== 'Autres') dismiss(item.label);   // une idée retirée ne revient pas
    void reload();
  }

  const { done, total } = progress(items);
  const facts = packFacts(ctx);
  const whyOf = (label: string) => ideas.find((i) => baseLabel(i.label) === baseLabel(label))?.why ?? null;

  const name = (label: string) => {
    const [main, qty] = label.split(' · ');
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <RNText style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.text }}>{main}</RNText>
        {qty ? <RNText style={{ fontFamily: fonts.sansBold, fontSize: 12, color: colors.text2, backgroundColor: colors.surface2, paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, overflow: 'hidden' }}>{qty}</RNText> : null}
      </View>
    );
  };
  const savedRow = (i: CheckItem) => {
    const why = i.done ? null : whyOf(i.label);
    return (
      <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: i.done }} accessibilityLabel={i.label} onPress={() => { void toggle(i.id, !i.done); }}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 }}>
          <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: i.done ? colors.accent : colors.lineStrong, backgroundColor: i.done ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {i.done ? <Icon name="check" size={16} tone="onAccent" filled /> : null}
          </View>
          <View style={{ flex: 1, gap: 1, opacity: i.done ? 0.55 : 1 }}>
            <View style={{ flexDirection: 'row' }}><View style={{ flexShrink: 1 }}>{name(i.label)}</View></View>
            {why ? <RNText style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.text3 }}>{why}</RNText> : null}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${i.label}`} onPress={() => { void remove(i); }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={20} tone="muted" />
        </Pressable>
      </View>
    );
  };
  const ideaRow = (idea: PackIdea) => (
    <View key={idea.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}>
      <View style={{ flex: 1, gap: 1 }}>
        {name(idea.label)}
        <RNText style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.accent }}>{idea.why}</RNText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter ${idea.label}`} onPress={() => { void add([idea.label]); }}
        style={{ minWidth: 44, minHeight: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="add" size={18} tone="text" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Pas besoin : ${idea.label}`} onPress={() => dismiss(idea.label)} style={{ minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={18} tone="muted" />
      </Pressable>
    </View>
  );

  return (
    <Card>
      <Text variant="label">Valise</Text>
      {loadError ? <Text variant="muted">{loadError}</Text> : null}
      {!loadError ? (
        <>
          {total ? (
            <View style={{ gap: 6 }}>
              <Text variant="muted">{done} sur {total} prêt{done > 1 ? 's' : ''}</Text>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round((done / total) * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: colors.accent }} />
              </View>
            </View>
          ) : !loading ? <Text variant="muted">Des idées selon la météo, la durée, les voyageurs et le programme. Tout le monde voit et coche la même valise.</Text> : null}
          {facts.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {facts.map((f) => <RNText key={f} style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: colors.text2, backgroundColor: colors.surface2, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' }}>{f}</RNText>)}
            </View>
          ) : null}
          {!showIdeas && left.length ? (
            <View style={{ gap: 6, padding: space.md, borderRadius: radius.field, backgroundColor: colors.surface2 }}>
              <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text }}>{left.length} idée{left.length > 1 ? 's' : ''} pour ta valise</RNText>
              <Text variant="muted">Selon la météo, le programme et le pays. Elles changent avec eux.</Text>
              <Button label="Voir et ajouter" variant="ghost" onPress={() => setOpen(true)} />
            </View>
          ) : null}
          {GROUPS.map((g) => {
            const saved = orderItems(items.filter((i) => groupOf(i.label, ideas) === g));
            const extra = showIdeas ? left.filter((i) => i.group === g) : [];
            if (!saved.length && !extra.length) return null;
            return (
              <View key={g} style={{ gap: 2 }}>
                <Text variant="label">{g}</Text>
                {saved.map(savedRow)}
                {extra.map(ideaRow)}
              </View>
            );
          })}
          {showIdeas && left.length ? <Button label={`Tout ajouter (${left.length})`} onPress={() => { void add(left.map((i) => i.label)); setOpen(false); }} /> : null}
          <Field label="Ajouter un élément" value={text} onChangeText={setText} onSubmitEditing={() => { void submit(); }} placeholder="Ex. livre pour l'avion" returnKeyType="done" />
          <ErrorNote message={error} />
          <Button label="Ajouter" variant="ghost" onPress={() => { void submit(); }} disabled={!text.trim()} />
        </>
      ) : null}
    </Card>
  );
}

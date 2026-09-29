import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, PayBadge, Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/tokens';
import { formatDay, isTime } from '../../lib/format';
import { formatTime, scheduleDay } from '../../domain/planning.ts';
import { paymentState } from '../../domain/budget.ts';
import type { Expense, Place, TripItem } from '../../domain/types.ts';
import { addItem, deleteItem } from '../../data/trips';
import type { Day } from '../../data/useTrip';

interface Props {
  tripId: string;
  day: Day;
  items: TripItem[];
  places: Map<number, Place>;
  expenses: Pick<Expense, 'amount' | 'item_id'>[];
  travelers: number;
  onChanged: () => void;
}

export function DayCard({ tripId, day, items, places, expenses, travelers, onChanged }: Props) {
  const { colors } = useTheme();
  const [plan, setPlan] = useState<'A' | 'B' | 'C'>('A');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  const schedule = scheduleDay({ date: day.day_date, plan, items: items.filter((i) => i.day_id === day.id), places });
  const lastPosition = schedule.reduce((max, s) => Math.max(max, s.item.position), 0);

  async function add() {
    if (!title.trim()) { setError('Donne un nom à l\'étape.'); return; }
    if (time && !isTime(time)) { setError('Heure au format 09:30.'); return; }
    const err = await addItem({ tripId, dayId: day.id, title, startTime: time || null, position: lastPosition + 1 });
    setError(err);
    if (!err) { setTitle(''); setTime(''); onChanged(); }
  }

  return (
    <Card>
      <Text variant="heading" style={{ textTransform: 'capitalize' }}>{formatDay(day.day_date)}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="tablist">
        {(['A', 'B', 'C'] as const).map((p) => <Chip key={p} label={`Plan ${p}`} selected={plan === p} onPress={() => setPlan(p)} />)}
      </View>

      {schedule.length === 0 ? <Text variant="muted">Rien de prévu dans ce plan.</Text> : null}
      {schedule.map((s) => {
        const state = paymentState(s.item, s.place, expenses, travelers);
        return (
          <View key={s.item.id} style={{ gap: space.xs }}>
            {s.travelFromPrevious ? (
              <Text variant="muted">≈ {s.travelFromPrevious.minutes} min {s.travelFromPrevious.mode === 'walk' ? 'à pied' : 'en transports'} · estimé</Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Text variant="mono" style={{ width: 52 }}>{s.startMin != null ? formatTime(s.startMin) : '--:--'}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="body">{s.place?.name ?? s.item.title}</Text>
                {s.issues.map((issue) => (
                  <Text key={issue.type} variant="muted" style={{ color: colors.warm }}>
                    {issue.type === 'closed_day' ? 'Fermé ce jour-là' : issue.type === 'overlap' ? `Chevauche l'étape précédente de ${issue.minutes} min (trajet compris)` : 'Heure à choisir'}
                  </Text>
                ))}
              </View>
              <PayBadge state={state} />
              <Button label="Retirer" variant="ghost" onPress={async () => { setError(await deleteItem(s.item.id)); onChanged(); }} />
            </View>
          </View>
        );
      })}

      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Field label="Nouvelle étape" value={title} onChangeText={setTitle} placeholder="Ex. Déjeuner à la Ribeira" />
        <Field label="Heure (facultatif)" value={time} onChangeText={setTime} placeholder="09:30" keyboardType="numbers-and-punctuation" />
        <ErrorNote message={error} />
        <Button label="Ajouter l'étape" onPress={add} />
      </View>
    </Card>
  );
}

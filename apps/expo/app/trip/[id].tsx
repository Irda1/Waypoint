import React, { useState } from 'react';
import { Share, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { useRequireAuth } from '../../src/auth/useRequireAuth';
import { Button, Card, Columns, ErrorNote, Field, Screen, Text } from '../../src/ui';
import { useTrip } from '../../src/data/useTrip';
import { addDay, createInvite } from '../../src/data/trips';
import { DayCard } from '../../src/features/trip/DayCard';
import { BudgetCard } from '../../src/features/trip/BudgetCard';
import { AddExpenseCard } from '../../src/features/trip/AddExpenseCard';
import { isIsoDate } from '../../src/lib/format';
import { space } from '../../src/theme/tokens';

const STATUS = { connecting: 'Connexion en direct…', live: 'Synchronisé en direct avec tes amis', offline: 'Hors ligne : les modifications reprendront à la reconnexion' } as const;

export default function TripScreen() {
  const guard = useRequireAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { data, error, loading, status, reload } = useTrip(String(id));
  const [newDay, setNewDay] = useState('');
  const [dayError, setDayError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  if (guard) return guard;
  if (loading) return <Screen><Text variant="muted">Chargement du voyage…</Text></Screen>;
  if (error || !data) {
    return <Screen><ErrorNote message={error ?? 'Voyage introuvable.'} /><Button label="Retour à mes voyages" onPress={() => router.replace('/')} /></Screen>;
  }

  const active = data.members.filter((m) => !m.left_at);
  const travelers = Math.max(1, active.length);

  async function invite() {
    const res = await createInvite(data!.trip.id);
    setInviteError(res.error);
    if (res.code) {
      const link = Linking.createURL(`/join/${res.code}`);
      await Share.share({ message: `Rejoins « ${data!.trip.title} » sur Waypoint : ${link}\nCode : ${res.code}` });
    }
  }

  async function submitDay() {
    if (!isIsoDate(newDay)) { setDayError('Date au format AAAA-MM-JJ (ex. 2026-10-13).'); return; }
    const err = await addDay(data!.trip.id, newDay);
    setDayError(err);
    if (!err) { setNewDay(''); void reload(); }
  }

  return (
    <Screen>
      <Button label="← Mes voyages" variant="ghost" onPress={() => router.replace('/')} />
      <Text variant="title">{data.trip.title}</Text>
      <Text variant="muted" accessibilityLiveRegion="polite">{STATUS[status]}</Text>

      <Card>
        <Text variant="label">Voyageurs · {active.length}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {active.map((m) => (
            <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: m.color }} />
              <Text variant="body">{m.profiles?.display_name ?? 'Voyageur'}{m.user_id === session?.user.id ? ' (toi)' : ''}</Text>
            </View>
          ))}
        </View>
        <ErrorNote message={inviteError} />
        <Button label="Inviter un ami" variant="ghost" onPress={invite} />
      </Card>

      <Columns>
        {data.days.map((d) => (
          <DayCard key={d.id} tripId={data.trip.id} day={d} items={data.items} places={data.places} expenses={data.expenses} travelers={travelers} onChanged={reload} />
        ))}
      </Columns>

      <Card>
        <Text variant="heading">Ajouter un jour</Text>
        <Field label="Date" value={newDay} onChangeText={setNewDay} placeholder="2026-10-13" />
        <ErrorNote message={dayError} />
        <Button label="Ajouter le jour" onPress={submitDay} />
      </Card>

      <BudgetCard data={data} />
      {session ? <AddExpenseCard tripId={data.trip.id} currency={data.trip.currency} userId={session.user.id} onChanged={reload} /> : null}
    </Screen>
  );
}

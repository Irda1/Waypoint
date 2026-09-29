import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { useRequireAuth } from '../src/auth/useRequireAuth';
import { Button, Card, Columns, ErrorNote, Field, Screen, Text } from '../src/ui';
import { createTrip, listTrips } from '../src/data/trips';
import type { TripSummary } from '../src/data/trips';
import { formatDay, isIsoDate } from '../src/lib/format';
import { space } from '../src/theme/tokens';

export default function MyTrips() {
  const guard = useRequireAuth();
  const { signOut } = useAuth();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await listTrips();
    setTrips(res.trips);
    setError(res.error);
  }, []);
  useEffect(() => { if (!guard) void refresh(); }, [guard, refresh]);

  if (guard) return guard;

  async function create() {
    if (!title.trim()) { setError('Donne un nom à ton voyage.'); return; }
    if ((start && !isIsoDate(start)) || (end && !isIsoDate(end))) { setError('Dates au format AAAA-MM-JJ (ex. 2026-10-13).'); return; }
    if (start && end && end < start) { setError('La fin du voyage est avant le début.'); return; }
    setBusy(true);
    const res = await createTrip(title, start || null, end || null);
    setBusy(false);
    if (res.error || !res.id) { setError(res.error ?? 'Création impossible.'); return; }
    router.push({ pathname: '/trip/[id]', params: { id: res.id } });
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="title">Mes voyages</Text>
        <Button label="Déconnexion" variant="ghost" onPress={signOut} />
      </View>
      <ErrorNote message={error} />

      {trips === null ? <Text variant="muted">Chargement…</Text> : trips.length === 0 ? (
        <Card><Text variant="body">Aucun voyage pour l'instant. Crée le premier ci-dessous, ou rejoins celui d'un ami avec son lien d'invitation.</Text></Card>
      ) : (
        <Columns>
          {trips.map((t) => (
            <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${t.title}`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}>
              <Card>
                <Text variant="heading">{t.title}</Text>
                <Text variant="muted">{t.starts_on ? `${formatDay(t.starts_on)}${t.ends_on ? ` → ${formatDay(t.ends_on)}` : ''}` : 'Dates à définir'}</Text>
              </Card>
            </Pressable>
          ))}
        </Columns>
      )}

      <Card>
        <Text variant="heading">Nouveau voyage</Text>
        <Field label="Nom" value={title} onChangeText={setTitle} placeholder="Lisbonne entre amis" />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}><Field label="Début (facultatif)" value={start} onChangeText={setStart} placeholder="2026-10-13" /></View>
          <View style={{ flex: 1 }}><Field label="Fin (facultatif)" value={end} onChangeText={setEnd} placeholder="2026-10-16" /></View>
        </View>
        <Button label="Créer le voyage" onPress={create} loading={busy} />
      </Card>
    </Screen>
  );
}

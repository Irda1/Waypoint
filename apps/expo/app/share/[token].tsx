import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Card, Screen, Text } from '../../src/ui';
import { loadSharedTrip } from '../../src/data/trips';
import type { SharedTrip } from '../../src/data/trips';
import { formatDay } from '../../src/lib/format';

/** Page publique en lecture seule : le programme d'un voyage partagé par lien, sans compte. */
export default function SharedTripPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [trip, setTrip] = useState<SharedTrip | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSharedTrip(String(token)).then((r) => { setTrip(r.trip); setError(r.error); });
  }, [token]);

  return (
    <Screen>
      {trip === undefined ? <Text variant="muted">Chargement…</Text> : trip === null ? (
        <Card><Text variant="body">{error ?? 'Ce lien n\'existe pas ou n\'est plus partagé.'}</Text></Card>
      ) : (
        <>
          <Text variant="title" accessibilityRole="header">{trip.title}</Text>
          <Text variant="muted">{trip.destinations.join(' · ')}{trip.starts_on ? ` · ${formatDay(trip.starts_on)}${trip.ends_on ? ` → ${formatDay(trip.ends_on)}` : ''}` : ''}</Text>
          <Text variant="muted">Programme en lecture seule.</Text>
          {trip.days.map((d, i) => (
            <Card key={d.date}>
              <Text variant="label" style={{ textTransform: 'capitalize' }}>Jour {i + 1} · {formatDay(d.date)}{d.city ? ` · ${d.city}` : ''}</Text>
              {d.items.length === 0 ? <Text variant="muted">Rien de prévu.</Text> : d.items.map((it, k) => (
                <Text key={k} variant="body">{it.time ? `${it.time.slice(0, 5)}  ` : ''}{it.name ?? 'Étape'}{it.note ? ` — ${it.note}` : ''}</Text>
              ))}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

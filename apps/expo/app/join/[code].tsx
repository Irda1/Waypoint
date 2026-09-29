import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useRequireAuth } from '../../src/auth/useRequireAuth';
import { Button, Card, ErrorNote, Screen, Text } from '../../src/ui';
import { joinTrip, previewInvite } from '../../src/data/trips';
import type { InvitePreview } from '../../src/data/trips';

export default function JoinTrip() {
  const guard = useRequireAuth();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (guard) return;
    void previewInvite(String(code)).then((res) => { setPreview(res.preview); setError(res.error); });
  }, [guard, code]);

  if (guard) return guard;

  async function join() {
    setBusy(true);
    const res = await joinTrip(String(code));
    setBusy(false);
    if (res.error || !res.tripId) { setError(res.error ?? 'Impossible de rejoindre ce voyage.'); return; }
    router.replace({ pathname: '/trip/[id]', params: { id: res.tripId } });
  }

  return (
    <Screen>
      <Text variant="title">Invitation</Text>
      {preview === undefined ? <Text variant="muted">Vérification de l'invitation…</Text> : preview === null ? (
        <Card><Text variant="body">Cette invitation est invalide, expirée ou révoquée. Demande un nouveau lien à ton ami.</Text></Card>
      ) : (
        <Card>
          <Text variant="heading">{preview.title}</Text>
          <Text variant="muted">{preview.member_count} voyageur{preview.member_count > 1 ? 's' : ''} déjà dans ce voyage. Tout le monde peut le modifier, sans rôle particulier.</Text>
          <Button label="Rejoindre le voyage" onPress={join} loading={busy} />
        </Card>
      )}
      <ErrorNote message={error} />
      <Button label="Mes voyages" variant="ghost" onPress={() => router.replace('/')} />
    </Screen>
  );
}

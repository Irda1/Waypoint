import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Card, ErrorNote, Text } from '../../ui';
import { createShare, getShareToken, revokeShare } from '../../data/trips';
import { WEB_URL } from '../../lib/env';
import { shareText } from '../../lib/share';
import { space } from '../../theme/tokens';

function shareUrl(token: string): string {
  const origin = Platform.OS === 'web' ? (globalThis as { location?: { origin: string } }).location?.origin ?? WEB_URL : WEB_URL;
  return `${origin}/share/${token}`;
}

/** Lien en lecture seule : la famille voit le programme sans compte et sans rien pouvoir modifier (ni budget, ni amis). */
export function ShareCard({ tripId, title }: { tripId: string; title: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getShareToken(tripId).then((r) => { if (!alive) return; setToken(r.token); setMissing(r.missing); setError(r.missing ? null : r.error); setLoaded(true); });
    return () => { alive = false; };
  }, [tripId]);

  if (!loaded) return null;
  if (missing) return <Card><Text variant="label">Partage en lecture seule</Text><Text variant="muted">Pas encore disponible : la migration 1500 doit être lancée dans Supabase (SQL Editor).</Text></Card>;

  async function create() {
    const r = await createShare(tripId);
    setError(r.error); if (r.token) setToken(r.token);
  }
  async function send() {
    if (!token) return;
    const r = await shareText(`Voici le programme de « ${title} » (lecture seule) : ${shareUrl(token)}`);
    setNote(r === 'copied' ? 'Lien copié : colle-le dans un message.' : r === 'failed' ? 'Partage impossible ici : recopie le lien.' : null);
  }
  async function stop() {
    const err = await revokeShare(tripId);
    setError(err); if (!err) { setToken(null); setNote(null); }
  }

  return (
    <Card>
      <Text variant="label">Partage en lecture seule</Text>
      <Text variant="muted">Un lien pour que ta famille voie le programme (jours, étapes, villes), sans compte et sans pouvoir le modifier. Ni budget ni amis ne sont montrés.</Text>
      {token ? (
        <View style={{ gap: space.sm }}>
          <Text variant="mono" selectable>{shareUrl(token)}</Text>
          <Button label="Partager le lien" onPress={send} />
          <Button label="Arrêter le partage" variant="ghost" onPress={stop} />
          {note ? <Text variant="muted">{note}</Text> : null}
        </View>
      ) : <Button label="Créer un lien de partage" variant="ghost" onPress={create} />}
      <ErrorNote message={error} />
    </Card>
  );
}

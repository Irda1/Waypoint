import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Card, Text } from '../../ui';
import { buildIcs, exportEntries, programText } from '../../domain/exportTrip.ts';
import type { ExportInput } from '../../domain/exportTrip.ts';
import { downloadTextFile, shareText } from '../../lib/share';
import type { TripData } from '../../data/useTrip';
import { space } from '../../theme/tokens';

/** Partage ou exporte le programme (plan A) : texte pour un message, agenda .ics pour Google/Apple Agenda. */
export function ExportCard({ data }: { data: TripData }) {
  const [note, setNote] = useState<string | null>(null);
  const input: ExportInput = {
    title: data.trip.title,
    days: data.days,
    items: data.items,
    placeName: (id) => data.places.get(id)?.name,
  };
  const count = exportEntries(input).length;
  const slug = data.trip.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'voyage';

  async function share() {
    const r = await shareText(programText(input));
    setNote(r === 'copied' ? 'Programme copié : colle-le dans un message.' : r === 'failed' ? 'Partage impossible ici.' : null);
  }
  function calendar() {
    const ok = downloadTextFile(`${slug}.ics`, buildIcs(input), 'text/calendar');
    setNote(ok ? 'Fichier agenda téléchargé : ouvre-le pour l\'ajouter à ton agenda.' : 'Le fichier agenda se télécharge depuis la version web.');
  }

  return (
    <Card>
      <Text variant="label">Partager le programme</Text>
      <Text variant="muted">{count ? `${count} étape${count > 1 ? 's' : ''} du plan A, jour par jour.` : 'Ajoute des étapes aux jours pour pouvoir exporter le programme.'}</Text>
      <View style={{ gap: space.sm }}>
        <Button label="Partager le programme" variant="ghost" onPress={share} disabled={!count} />
        {Platform.OS === 'web' ? <Button label="Ajouter à mon agenda (.ics)" variant="ghost" onPress={calendar} disabled={!count} /> : null}
      </View>
      {note ? <Text variant="muted" accessibilityLiveRegion="polite">{note}</Text> : null}
    </Card>
  );
}

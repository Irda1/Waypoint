import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, Card, ErrorNote, Text } from '../../ui';
import { setTripMemo } from '../../data/trips';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';

export const MEMO_MAX = 4000;

/** Notes libres du voyage (codes, adresses, idées) : visibles et modifiables par tous les voyageurs. */
export function MemoCard({ tripId, memo, onChanged, startEditing = false, onStarted }: { tripId: string; memo: string; onChanged: () => void; startEditing?: boolean; onStarted?: () => void }) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (startEditing) { setDraft(memo); setEditing(true); onStarted?.(); } }, [startEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true);
    const err = await setTripMemo(tripId, draft);
    setBusy(false);
    setError(err);
    if (!err) { setEditing(false); onChanged(); }
  }

  return (
    <Card>
      <Text variant="label">Mémo du voyage</Text>
      {editing ? (
        <View style={{ gap: space.sm }}>
          <TextInput
            accessibilityLabel="Mémo du voyage"
            value={draft}
            onChangeText={(t) => setDraft(t.slice(0, MEMO_MAX))}
            multiline
            autoFocus
            placeholder="Codes d'accès, adresses, idées à ne pas oublier…"
            placeholderTextColor={colors.text3}
            style={{ minHeight: 140, borderRadius: radius.field, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface2, padding: space.md, fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.text, textAlignVertical: 'top' }}
          />
          <Text variant="muted" style={{ fontSize: 12 }}>{draft.length} / {MEMO_MAX}</Text>
          <ErrorNote message={error} />
          <Button label="Enregistrer" onPress={save} loading={busy} />
          <Button label="Annuler" variant="ghost" onPress={() => { setEditing(false); setDraft(memo); setError(null); }} />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          {memo.trim() ? <Text variant="body">{memo}</Text> : <Text variant="muted">Rien pour l'instant. Note ici ce que tous les voyageurs doivent retrouver : codes, adresses, idées.</Text>}
          <Button label={memo.trim() ? 'Modifier le mémo' : 'Écrire un mémo'} variant="ghost" onPress={() => { setDraft(memo); setEditing(true); }} />
        </View>
      )}
    </Card>
  );
}

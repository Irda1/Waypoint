import React, { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Button, Card, ErrorNote, Field, Text } from '../../ui';
import { cleanLabel, missingSuggestions, orderItems, progress } from '../../domain/checklist.ts';
import { addItems, removeItem, setDone, useChecklist } from '../../data/checklist';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';

/** « À ne pas oublier » : bagages, papiers, démarches ; coché pour tous les voyageurs du voyage. */
export function ChecklistCard({ tripId }: { tripId: string }) {
  const { colors } = useTheme();
  const { items, setItems, error: loadError, loading, reload } = useChecklist(tripId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(labels: string[]) {
    setError(null);
    const err = await addItems(tripId, labels);
    if (err) setError(err); else { setText(''); void reload(); }
  }
  async function submit() {
    const label = cleanLabel(text, items);
    if (!label) { setError(text.trim() ? 'Déjà dans la liste.' : null); return; }
    await add([label]);
  }
  async function toggle(id: string, done: boolean) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, done } : i)));   // affichage immédiat
    const err = await setDone(id, done);
    if (err) { setError(err); void reload(); }
  }
  async function remove(id: string) {
    const err = await removeItem(id);
    if (err) setError(err); else void reload();
  }

  const { done, total } = progress(items);
  const left = missingSuggestions(items);

  return (
    <Card>
      <Text variant="label">À ne pas oublier</Text>
      {loadError ? <Text variant="muted">{loadError}</Text> : null}
      {!loadError ? (
        <>
          {total ? <Text variant="muted">{done} / {total} prêt{done > 1 ? 's' : ''}</Text> : !loading ? <Text variant="muted">Bagages, papiers, démarches : coche au fur et à mesure, tout le monde voit la même liste.</Text> : null}
          {orderItems(items).map((i) => (
            <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: i.done }} accessibilityLabel={i.label} onPress={() => { void toggle(i.id, !i.done); }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 }}>
                <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: i.done ? colors.accent : colors.lineStrong, backgroundColor: i.done ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {i.done ? <RNText style={{ color: colors.onAccent, fontFamily: fonts.sansBold, fontSize: 14 }}>✓</RNText> : null}
                </View>
                <Text variant="body" style={{ flex: 1, textDecorationLine: i.done ? 'line-through' : 'none', color: i.done ? colors.text3 : colors.text }}>{i.label}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${i.label}`} onPress={() => { void remove(i.id); }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <RNText style={{ color: colors.text3, fontSize: 18 }}>✕</RNText>
              </Pressable>
            </View>
          ))}
          <Field label="Ajouter un élément" value={text} onChangeText={setText} onSubmitEditing={() => { void submit(); }} placeholder="Ex. Maillot de bain" returnKeyType="done" />
          <ErrorNote message={error} />
          <Button label="Ajouter" variant="ghost" onPress={() => { void submit(); }} disabled={!text.trim()} />
          {left.length ? <Button label={`Ajouter les indispensables (${left.length})`} variant="ghost" onPress={() => { void add(left); }} /> : null}
        </>
      ) : null}
    </Card>
  );
}

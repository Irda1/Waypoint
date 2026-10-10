import React, { useState } from 'react';
import { Linking, Pressable, Text as RNText, View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, Text } from '../../ui';
import { BOOKING_KINDS, emptyDraft, validateDraft } from '../../domain/bookings.ts';
import type { Booking, BookingDraft } from '../../domain/bookings.ts';
import { removeBooking, saveBooking, useBookings } from '../../data/bookings';
import { formatDay } from '../../lib/format';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';

const icon = (k: Booking['kind']) => BOOKING_KINDS.find((x) => x.kind === k)?.icon ?? 'pin';

/** Réservations du voyage : vols, trains, hébergements, billets, avec numéro de confirmation et lien. */
export function BookingsCard({ tripId }: { tripId: string }) {
  const { colors } = useTheme();
  const { bookings, error: loadError, loading, reload } = useBookings(tripId);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [editId, setEditId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(b?: Booking) {
    setEditId(b?.id);
    setDraft(b ? { kind: b.kind, title: b.title, reference: b.reference ?? '', starts_on: b.starts_on ?? '', start_time: b.start_time ?? '', url: b.url ?? '', notes: b.notes ?? '' } : emptyDraft());
    setError(null);
  }
  async function save() {
    if (!draft) return;
    const invalid = validateDraft(draft);
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    const err = await saveBooking(tripId, draft, editId);
    setBusy(false);
    if (err) { setError(err); return; }
    setDraft(null); setEditId(undefined);
    void reload();
  }
  async function remove(id: string) {
    const err = await removeBooking(id);
    if (err) setError(err); else { setDraft(null); setEditId(undefined); void reload(); }
  }
  const set = (patch: Partial<BookingDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Card>
      <Text variant="label">Réservations</Text>
      {loadError ? <Text variant="muted">{loadError}</Text> : null}
      {!loadError && !loading && !bookings.length && !draft ? <Text variant="muted">Garde ici tes vols, trains, hôtels et billets avec leur numéro de confirmation.</Text> : null}
      {bookings.map((b) => (
        <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`Modifier ${b.title}`} onPress={() => startEdit(b)}
          style={{ flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface2 }}>
          <Icon name={icon(b.kind)} size={22} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{b.title}</Text>
            <Text variant="muted">{[b.starts_on ? formatDay(b.starts_on) : null, b.start_time, b.reference ? `N° ${b.reference}` : null].filter(Boolean).join(' · ') || 'Sans date'}</Text>
            {b.notes ? <Text variant="muted">{b.notes}</Text> : null}
            {b.url ? <Text variant="muted" style={{ color: colors.accent }} onPress={() => { void Linking.openURL(b.url!); }} accessibilityRole="link">Ouvrir le billet / le lien</Text> : null}
          </View>
        </Pressable>
      ))}

      {draft ? (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole="radiogroup">
            {BOOKING_KINDS.map((k) => <Chip key={k.kind} label={k.label} icon={k.icon} selected={draft.kind === k.kind} onPress={() => set({ kind: k.kind })} />)}
          </View>
          <Field label="Titre" value={draft.title} onChangeText={(t) => set({ title: t })} placeholder="Ex. Vol Paris → Lisbonne" />
          <Field label="N° de confirmation" value={draft.reference} onChangeText={(t) => set({ reference: t })} autoCapitalize="characters" autoCorrect={false} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 2 }}><Field label="Date (AAAA-MM-JJ)" value={draft.starts_on} onChangeText={(t) => set({ starts_on: t })} placeholder="2026-10-30" autoCorrect={false} /></View>
            <View style={{ flex: 1 }}><Field label="Heure" value={draft.start_time} onChangeText={(t) => set({ start_time: t })} placeholder="14:35" autoCorrect={false} /></View>
          </View>
          <Field label="Lien (billet, e-mail…)" value={draft.url} onChangeText={(t) => set({ url: t })} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Field label="Notes" value={draft.notes} onChangeText={(t) => set({ notes: t })} multiline />
          <ErrorNote message={error} />
          <Button label={editId ? 'Enregistrer' : 'Ajouter la réservation'} onPress={save} loading={busy} />
          {editId ? <Button label="Supprimer cette réservation" variant="ghost" onPress={() => remove(editId)} /> : null}
          <Button label="Annuler" variant="ghost" onPress={() => { setDraft(null); setEditId(undefined); setError(null); }} />
        </View>
      ) : (
        <>
          <ErrorNote message={error} />
          {!loadError ? <Button label="Ajouter une réservation" variant="ghost" onPress={() => startEdit()} /> : null}
        </>
      )}
    </Card>
  );
}

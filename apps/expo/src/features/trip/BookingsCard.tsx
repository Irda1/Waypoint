import React, { useState } from 'react';
import { Linking, Modal, Pressable, Switch, Text as RNText, View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, Text } from '../../ui';
import { BOOKING_KINDS, MAX_FILES, emptyDraft, fileSize, validateDraft } from '../../domain/bookings.ts';
import type { Booking, BookingDraft } from '../../domain/bookings.ts';
import { removeBooking, saveBooking, useBookings } from '../../data/bookings';
import { attachFile, extOf, fileUrl, openFile, removeFile, removeOwnFiles, useBookingFiles } from '../../data/bookingFiles';
import type { BookingFile } from '../../data/bookingFiles';
import { ImportEmailSheet } from './ImportEmailSheet';
import { canKeep, forget, isKept, keep } from '../../lib/offlineFile';
import { formatDay } from '../../lib/format';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';

const icon = (k: Booking['kind']) => BOOKING_KINDS.find((x) => x.kind === k)?.icon ?? 'pin';

/** Pastille d'un billet joint : type, nom, et « hors ligne » s'il est gardé sur le téléphone. */
function FileChip({ file, onPress }: { file: BookingFile; onPress: () => void }) {
  const { colors } = useTheme();
  const pdf = file.content_type === 'application/pdf';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${file.name}`} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.bg, maxWidth: '100%' }}>
      <RNText style={{ flexShrink: 0, fontFamily: fonts.sansBold, fontSize: 10, color: '#FFFFFF', backgroundColor: pdf ? '#B4452D' : '#2E7D4F', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' }}>{pdf ? 'PDF' : 'IMG'}</RNText>
      <RNText numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.text }}>{file.name}</RNText>
      {isKept(file.id, extOf(file)) ? <RNText style={{ fontFamily: fonts.sansBold, fontSize: 11, color: colors.paid }}>✓ hors ligne</RNText> : null}
    </Pressable>
  );
}

/** Réservations du voyage : vols, trains, hébergements, billets, avec numéro de confirmation, lien et billets joints. */
export function BookingsCard({ tripId, userId }: { tripId: string; userId: string | null }) {
  const { colors } = useTheme();
  const { bookings, error: loadError, loading, reload } = useBookings(tripId);
  const attached = useBookingFiles(tripId);
  const [viewing, setViewing] = useState<BookingFile | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [, setKeptTick] = useState(0);
  const [importing, setImporting] = useState(false);
  const filesOf = (id: string) => attached.files.filter((f) => f.booking_id === id);

  async function attach(bookingId: string) {
    setFileError(null); setFileBusy(true);
    const err = await attachFile(tripId, bookingId, filesOf(bookingId).length).catch((e: unknown) => String(e));
    setFileBusy(false);
    if (err) setFileError(err); else void attached.reload();
  }
  async function detach(f: BookingFile) {
    const err = await removeFile(f);
    if (err) setFileError(err); else { forget(f.id, extOf(f)); void attached.reload(); }
  }
  async function open(f: BookingFile) {
    setFileError(null);
    const err = await openFile(f).catch(() => 'Impossible d\'ouvrir ce billet.');
    if (err) setFileError(err);
  }
  async function toggleKeep(f: BookingFile, on: boolean) {
    setFileError(null); setFileBusy(true);
    try {
      if (on) { const url = await fileUrl(f); if (!url) throw new Error(); await keep(f.id, extOf(f), url); }
      else forget(f.id, extOf(f));
    } catch { setFileError('Copie impossible : vérifie ta connexion.'); }
    setFileBusy(false); setKeptTick((n) => n + 1);
  }
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
    const mine = filesOf(id).filter((f) => f.created_by === userId);
    const err = await removeBooking(id);
    if (!err) { await removeOwnFiles(mine); mine.forEach((f) => forget(f.id, extOf(f))); void attached.reload(); }
    if (err) setError(err); else { setDraft(null); setEditId(undefined); void reload(); }
  }
  // Réservations trouvées dans un e-mail : ajoutées d'un coup.
  async function addImported(drafts: BookingDraft[]): Promise<string | null> {
    for (const d of drafts) {
      const err = await saveBooking(tripId, d);
      if (err) { void reload(); return err; }
    }
    void reload();
    return null;
  }
  function editImported(d: BookingDraft) { setEditId(undefined); setDraft(d); setError(null); }
  const set = (patch: Partial<BookingDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Card>
      <Text variant="label">Réservations</Text>
      {loadError ? <Text variant="muted">{loadError}</Text> : null}
      {!loadError && !loading && !bookings.length && !draft ? <Text variant="muted">Garde ici tes vols, trains, hôtels et billets avec leur numéro de confirmation.</Text> : null}
      {bookings.map((b) => (
        // La ligne s'ouvre pour modification ; billets et lien restent des boutons à part (pas de bouton dans un bouton).
        <View key={b.id} style={{ gap: 6, padding: space.md, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface2 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${b.title}`} onPress={() => startEdit(b)} style={{ flexDirection: 'row', gap: space.md }}>
            <Icon name={icon(b.kind)} size={22} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{b.title}</Text>
              <Text variant="muted">{[b.starts_on ? formatDay(b.starts_on) : null, b.start_time, b.reference ? `N° ${b.reference}` : null].filter(Boolean).join(' · ') || 'Sans date'}</Text>
              {b.notes ? <Text variant="muted">{b.notes}</Text> : null}
            </View>
          </Pressable>
          {filesOf(b.id).length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 22 + space.md }}>
              {filesOf(b.id).map((f) => <FileChip key={f.id} file={f} onPress={() => setViewing(f)} />)}
            </View>
          ) : null}
          {b.url ? <Text variant="muted" style={{ color: colors.accent, paddingLeft: 22 + space.md }} onPress={() => { void Linking.openURL(b.url!); }} accessibilityRole="link">Ouvrir le billet / le lien</Text> : null}
        </View>
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
          {attached.available ? (
            <View style={{ gap: space.sm, padding: space.md, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineStrong }}>
              <Text variant="label">{editId ? `Billets et documents · ${filesOf(editId).length} sur ${MAX_FILES}` : 'Billets et documents'}</Text>
              {editId ? (
                <>
                  {filesOf(editId).map((f) => (
                    <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <View style={{ flex: 1 }}><FileChip file={f} onPress={() => setViewing(f)} /></View>
                      <RNText style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.text3 }}>{fileSize(f.size)}</RNText>
                      {f.created_by === userId ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${f.name}`} onPress={() => { void detach(f); }} style={{ minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="close" size={18} tone="muted" />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                  {filesOf(editId).length < MAX_FILES ? <Button label="Joindre un PDF ou une photo" icon="link" variant="ghost" loading={fileBusy} onPress={() => { void attach(editId); }} /> : null}
                  <Text variant="muted">PDF ou image, 10 Mo au plus. Visible par les voyageurs de ce voyage seulement.</Text>
                </>
              ) : <Text variant="muted">Ajoute la réservation, puis rouvre-la pour joindre un billet.</Text>}
              <ErrorNote message={fileError} />
            </View>
          ) : null}
          <Field label="Notes" value={draft.notes} onChangeText={(t) => set({ notes: t })} multiline />
          <ErrorNote message={error} />
          <Button label={editId ? 'Enregistrer' : 'Ajouter la réservation'} onPress={save} loading={busy} />
          {editId ? <Button label="Supprimer cette réservation" variant="ghost" onPress={() => remove(editId)} /> : null}
          <Button label="Annuler" variant="ghost" onPress={() => { setDraft(null); setEditId(undefined); setError(null); }} />
        </View>
      ) : (
        <>
          <ErrorNote message={error} />
          {!draft ? <ErrorNote message={fileError} /> : null}
          {!loadError ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <View style={{ flexGrow: 1, flexBasis: 160 }}><Button label="Importer un e-mail" icon="mail" variant="ghost" onPress={() => setImporting(true)} /></View>
              <View style={{ flexGrow: 1, flexBasis: 160 }}><Button label="Ajouter une réservation" variant="ghost" onPress={() => startEdit()} /></View>
            </View>
          ) : null}
        </>
      )}

      <ImportEmailSheet visible={importing} onClose={() => setImporting(false)} onAdd={addImported} onEdit={editImported} />

      {/* Billet ouvert : l'ouvrir, et le garder sur le téléphone pour l'avoir sans réseau. */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable accessibilityLabel="Fermer" onPress={() => setViewing(null)} style={{ flex: 1, backgroundColor: 'rgba(3, 5, 6, 0.6)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 560, alignSelf: 'center', padding: space.lg, paddingBottom: space.xl, gap: space.md }}>
            {viewing ? (
              <>
                <Text variant="heading" accessibilityRole="header" numberOfLines={2}>{viewing.name}</Text>
                <Text variant="muted">{[viewing.content_type === 'application/pdf' ? 'PDF' : 'Image', fileSize(viewing.size)].filter(Boolean).join(' · ')}</Text>
                <Button label="Ouvrir le billet" icon="external" onPress={() => { void open(viewing); }} />
                {canKeep ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 14, backgroundColor: colors.surface2 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.text }}>Garder sur ce téléphone</RNText>
                      <Text variant="muted">S'ouvre même sans réseau (mode avion, aéroport).</Text>
                    </View>
                    <Switch value={isKept(viewing.id, extOf(viewing))} disabled={fileBusy} onValueChange={(on) => { void toggleKeep(viewing, on); }}
                      accessibilityLabel="Garder sur ce téléphone" trackColor={{ true: colors.accent, false: colors.lineStrong }} />
                  </View>
                ) : null}
                <ErrorNote message={fileError} />
                <Button label="Fermer" variant="ghost" onPress={() => setViewing(null)} />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

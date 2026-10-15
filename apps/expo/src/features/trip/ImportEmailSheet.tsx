import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Button, ErrorNote, Field, Text } from '../../ui';
import { BOOKING_KINDS } from '../../domain/bookings.ts';
import type { BookingDraft } from '../../domain/bookings.ts';
import { parseBookingEmail } from '../../domain/emailImport.ts';
import { todayIso } from '../../lib/dates.ts';
import { formatDay } from '../../lib/format';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';

/**
 * « Importer un e-mail » : on colle le texte d'une confirmation, l'appli propose les réservations trouvées (lues sur l'appareil,
 * rien n'est envoyé). `onAdd` ajoute celles cochées ; `onEdit` ouvre le formulaire prérempli ; rien trouvé → formulaire avec le texte en notes.
 */
export function ImportEmailSheet({ visible, onClose, onAdd, onEdit }: {
  visible: boolean; onClose: () => void;
  onAdd: (drafts: BookingDraft[]) => Promise<string | null>; onEdit: (draft: BookingDraft) => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [found, setFound] = useState<BookingDraft[] | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() { setText(''); setFound(null); setChecked([]); setError(null); }
  function read() {
    const list = parseBookingEmail(text, todayIso());
    if (!list.length) {
      // Rien de reconnu : le formulaire habituel, avec le texte gardé dans les notes.
      onEdit({ kind: 'autre', title: '', reference: '', starts_on: '', start_time: '', url: '', notes: text.trim().slice(0, 1000) });
      reset(); onClose(); return;
    }
    setFound(list); setChecked(list.map(() => true));
  }
  async function addAll() {
    if (!found) return;
    setBusy(true); setError(null);
    const err = await onAdd(found.filter((_, i) => checked[i]));
    setBusy(false);
    if (err) { setError(err); return; }
    reset(); onClose();
  }
  function edit(i: number) {
    if (!found) return;
    onEdit(found[i]);
    const rest = found.filter((_, k) => k !== i);
    setFound(rest.length ? rest : null); setChecked(checked.filter((_, k) => k !== i));
    onClose();   // les autres réservations trouvées restent là au prochain « Importer un e-mail »
  }
  const n = checked.filter(Boolean).length;
  const row = (label: string, value: string) => value ? (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <RNText style={{ width: 70, fontFamily: fonts.sans, fontSize: 13, color: colors.text3 }}>{label}</RNText>
      <RNText style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.text }}>{value}</RNText>
    </View>
  ) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fermer" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(3, 5, 6, 0.6)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '94%' }}>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl, gap: space.md }} keyboardShouldPersistTaps="handled">
            {!found ? (
              <>
                <Text variant="heading" accessibilityRole="header">Importer un e-mail</Text>
                <Text variant="muted">Dans ta messagerie, ouvre l'e-mail de confirmation (vol, train, hôtel), sélectionne tout le texte et copie-le, puis colle-le ici.</Text>
                <Field label="Texte de l'e-mail" value={text} onChangeText={setText} multiline textAlignVertical="top" placeholder="Colle ici le texte de l'e-mail" style={{ minHeight: 170, paddingVertical: space.md, fontSize: 14 }} />
                <Button label="Lire l'e-mail" onPress={read} disabled={!text.trim()} />
                <Text variant="muted">Le texte est lu sur ton appareil : il n'est ni envoyé ni gardé.</Text>
              </>
            ) : (
              <>
                <Text variant="heading" accessibilityRole="header">{found.length} réservation{found.length > 1 ? 's' : ''} trouvée{found.length > 1 ? 's' : ''}</Text>
                <Text variant="muted">Vérifie, corrige au besoin, puis ajoute.</Text>
                {found.map((d, i) => (
                  <View key={i} style={{ gap: 6, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg }}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: checked[i] }} accessibilityLabel={d.title}
                      onPress={() => setChecked(checked.map((c, k) => (k === i ? !c : c)))} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: checked[i] ? colors.accent : colors.lineStrong, backgroundColor: checked[i] ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {checked[i] ? <Icon name="check" size={14} tone="onAccent" filled /> : null}
                      </View>
                      <Icon name={BOOKING_KINDS.find((k) => k.kind === d.kind)?.icon ?? 'pin'} size={18} />
                      <RNText style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text }}>{d.title}</RNText>
                    </Pressable>
                    {row('Date', d.starts_on ? formatDay(d.starts_on) : 'à compléter')}
                    {row('Heure', d.start_time)}
                    {row('N°', d.reference)}
                    {row('Détails', d.notes)}
                    {row('Lien', d.url.replace(/^https?:\/\//, '').slice(0, 40))}
                    <Button label="Modifier avant d'ajouter" variant="ghost" onPress={() => edit(i)} />
                  </View>
                ))}
                <ErrorNote message={error} />
                <Button label={n > 1 ? `Ajouter les ${n} réservations` : 'Ajouter la réservation'} onPress={() => { void addAll(); }} loading={busy} disabled={!n} />
                <Button label="Coller un autre e-mail" variant="ghost" onPress={reset} />
              </>
            )}
            <Button label="Fermer" variant="ghost" onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

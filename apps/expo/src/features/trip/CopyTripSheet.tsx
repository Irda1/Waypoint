import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorNote, Field, Text } from '../../ui';
import { Icon } from '../../ui/Icon';
import { MiniCalendar } from './MiniCalendar';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { formatDay } from '../../lib/format';
import { todayIso } from '../../lib/dates.ts';
import { copyTitle, shiftedRange, suggestStart } from '../../domain/copyTrip.ts';
import { copyTrip } from '../../data/trips';

/** Case à cocher simple (« Villes et nuits » est toujours reprise : affichée cochée, non modifiable). */
function Check({ label, on, onPress }: { label: string; on: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !onPress }} disabled={!onPress} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: colors.lineStrong, opacity: onPress ? 1 : 0.6 }}>
        {on ? <Icon name="check" size={14} tone="onAccent" /> : null}
      </View>
      <Text variant="body" style={{ flex: 1, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

/** « Refaire ce voyage » : nom, nouvelle date de départ, ce qu'on reprend ; le nouveau voyage s'ouvre ensuite. */
export function CopyTripSheet({ visible, onClose, trip }: { visible: boolean; onClose: () => void; trip: { id: string; title: string; starts_on: string | null; ends_on: string | null } }) {
  const { colors } = useTheme();
  const [start, setStart] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [edited, setEdited] = useState(false);
  const [program, setProgram] = useState(true);
  const [budget, setBudget] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const s = suggestStart(trip.starts_on, todayIso());
    setStart(s); setTitle(copyTitle(trip.title, s)); setEdited(false); setError(null); setOpened((n) => n + 1);
  }, [visible, trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (iso: string) => { setStart(iso); if (!edited) setTitle(copyTitle(trip.title, iso)); };
  const range = start ? shiftedRange(trip.starts_on, trip.ends_on, start) : null;

  async function create() {
    setBusy(true); setError(null);
    const res = await copyTrip({ tripId: trip.id, title, start, program, budget });
    setBusy(false);
    if (!res.id) { setError(res.error ?? 'Copie impossible pour le moment.'); return; }
    onClose();
    router.replace(`/trip/${res.id}`);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fermer" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(3, 5, 6, 0.6)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '94%' }}>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl, gap: space.md }} keyboardShouldPersistTaps="handled">
            <Text variant="heading" accessibilityRole="header">Refaire ce voyage</Text>
            <Field label="Nom" value={title} onChangeText={(v) => { setTitle(v); setEdited(true); }} maxLength={120} />
            {trip.starts_on ? (
              <View style={{ gap: space.xs }}>
                <Text variant="label">Nouvelle date de départ</Text>
                {/* Le calendrier s'ouvre sur le mois du départ proposé (il garde ensuite le mois affiché). */}
                {start ? <MiniCalendar key={opened} value={start} taken={new Set()} onPick={pick} /> : null}
                {start ? (
                  <Text variant="muted">
                    {formatDay(start)}{range?.end ? ` → ${formatDay(range.end)}` : ''}{range?.days ? ` · même durée (${range.days} jour${range.days > 1 ? 's' : ''})` : ''} : les villes, les nuits et les jours suivent.
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View>
              <Text variant="label">On reprend</Text>
              <Check label="Villes et nuits" on />
              <Check label="Programme jour par jour (lieux et horaires)" on={program} onPress={() => setProgram(!program)} />
              <Check label="Budget prévu par poste" on={budget} onPress={() => setBudget(!budget)} />
            </View>
            <RNText style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.text3 }}>Jamais repris : dépenses, carnet, photos, hébergements, voyageurs. Tu inviteras qui tu veux.</RNText>
            <ErrorNote message={error} />
            <Button label="Créer le voyage" loading={busy} disabled={!title.trim() || (!!trip.starts_on && !start)} onPress={() => void create()} />
            <Button label="Annuler" variant="ghost" onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Button, Card, Text } from '../../ui';
import { tripHoursProblems } from '../../domain/hoursCheck.ts';
import type { TripData } from '../../data/useTrip';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { formatDay } from '../../lib/format';

/**
 * Petit récap des horaires d'ouverture sur tout le voyage. Sans souci : une ligne verte. Sinon un bouton « N à vérifier »
 * ouvre un volet qui liste les activités et leur problème ; toucher une ligne mène à l'activité dans le planning du jour.
 */
export function HoursCard({ data, onOpen }: { data: TripData; onOpen: (dayIndex: number, itemId: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const report = useMemo(() => tripHoursProblems({ days: data.days, items: data.items, places: data.places }), [data.days, data.items, data.places]);
  if (report.checked + report.unknown === 0 && report.problems.length === 0) return null;
  const n = report.problems.length;
  return (
    <Card>
      <Text variant="label">Horaires des activités</Text>
      {n === 0 ? (
        <Text variant="body" style={{ color: colors.accent, fontFamily: fonts.sansSemi }}>
          ✓ Tout est cohérent{report.checked ? ` (${report.checked} activité${report.checked > 1 ? 's' : ''} vérifiée${report.checked > 1 ? 's' : ''})` : ''}
        </Text>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`${n} problème${n > 1 ? 's' : ''} d'horaires, voir la liste`} onPress={() => setOpen(true)}
          style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.warm, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <RNText style={{ fontSize: 18 }}>⚠️</RNText>
          <RNText style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 15, color: colors.warm }}>{n} activité{n > 1 ? 's' : ''} à vérifier</RNText>
          <RNText style={{ fontSize: 18, color: colors.text3 }}>›</RNText>
        </Pressable>
      )}
      {report.unknown > 0 ? <Text variant="muted">{report.unknown} activité{report.unknown > 1 ? 's' : ''} sans horaires connus : à vérifier avant d'y aller.</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Fermer la liste" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(3, 5, 6, 0.6)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%', width: '100%', maxWidth: 560, alignSelf: 'center' }}>
            <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.md }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, alignSelf: 'center' }} />
              <Text variant="title" accessibilityRole="header">Horaires à vérifier</Text>
              <Text variant="muted">Touche une activité pour aller la modifier dans le planning.</Text>
              {report.problems.map((p) => (
                <Pressable key={`${p.itemId}-${p.kind}`} accessibilityRole="button" accessibilityLabel={`${p.name}, jour ${p.dayNumber} : ${p.text}`}
                  onPress={() => { setOpen(false); onOpen(p.dayIndex, p.itemId); }}
                  style={{ minHeight: 56, padding: space.md, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface2, gap: 2 }}>
                  <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{p.name}</Text>
                  <Text variant="muted" style={{ color: colors.warm }}>{p.text}</Text>
                  <Text variant="muted">Jour {p.dayNumber} · {formatDay(data.days[p.dayIndex].day_date)}  ›</Text>
                </Pressable>
              ))}
              <Button label="Fermer" variant="ghost" onPress={() => setOpen(false)} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

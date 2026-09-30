import React, { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { longDate, monthGrid, monthTitle, todayIso } from '../../lib/dates.ts';

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Mini calendrier d'un mois : on touche une date pour la choisir ; les jours déjà dans le voyage sont grisés. */
export function MiniCalendar({ value, taken, onPick }: { value: string; taken: Set<string>; onPick: (iso: string) => void }) {
  const { colors } = useTheme();
  const start = value || todayIso();
  const [year, setYear] = useState(Number(start.slice(0, 4)));
  const [month0, setMonth0] = useState(Number(start.slice(5, 7)) - 1);
  const grid = monthGrid(year, month0);
  function shift(delta: number) {
    const m = month0 + delta;
    setYear(year + Math.floor(m / 12));
    setMonth0(((m % 12) + 12) % 12);
  }
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mois précédent" onPress={() => shift(-1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <RNText style={{ fontSize: 20, color: colors.accent }}>‹</RNText>
        </Pressable>
        <Text variant="label" style={{ textTransform: 'capitalize' }}>{monthTitle(year, month0)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Mois suivant" onPress={() => shift(1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <RNText style={{ fontSize: 20, color: colors.accent }}>›</RNText>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {WEEK.map((w, i) => <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}><RNText style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: colors.text3 }}>{w}</RNText></View>)}
        {Array.from({ length: grid.blanks }, (_, i) => <View key={`b${i}`} style={{ width: `${100 / 7}%` }} />)}
        {grid.days.map((iso) => {
          const isTaken = taken.has(iso);
          const picked = iso === value;
          return (
            <Pressable key={iso} disabled={isTaken} accessibilityRole="button" accessibilityLabel={longDate(iso)} accessibilityState={{ selected: picked, disabled: isTaken }} onPress={() => onPick(iso)}
              style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: picked ? colors.accent : isTaken ? colors.surface2 : 'transparent' }}>
                <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: picked ? colors.onAccent : isTaken ? colors.text3 : colors.text }}>{Number(iso.slice(8))}</RNText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { formatDay } from '../../lib/format';
import { todayIso } from '../../lib/dates';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';

const W = 56, GAP = 8;
const weekday = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
const month = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

interface Props {
  days: { id: string; day_date: string }[];
  selected: number;
  runs: { start: number; count: number; cityId: number | null }[];
  cityName: (cityId: number | null) => string;
  onPick: (index: number) => void;
}

/**
 * Frise des journées (onglet Jour) : la ville au-dessus de ses jours, puis une pastille par jour (jour de la semaine
 * et date, point sous aujourd'hui). La pastille choisie reste visible ; « ‹ » et « › » passent au jour voisin.
 */
export function DayStrip({ days, selected, runs, cityName, onPick }: Props) {
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const today = todayIso();
  useEffect(() => { scroll.current?.scrollTo({ x: Math.max(0, selected * (W + GAP) - 2 * (W + GAP)), animated: true }); }, [selected]);
  const day = days[selected];
  const city = cityName(runs.find((r) => selected >= r.start && selected < r.start + r.count)?.cityId ?? null);

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel="Jour précédent" disabled={selected <= 0} onPress={() => onPick(selected - 1)}
          style={[styles.arrow, { backgroundColor: colors.surface2, opacity: selected <= 0 ? 0.35 : 1 }]}>
          <Icon name="back" size={18} tone="text" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }} accessibilityLiveRegion="polite">
          <RNText style={[styles.title, { color: colors.text }]} numberOfLines={1}>Jour {selected + 1} sur {days.length}{city ? ` · ${city}` : ''}</RNText>
          {day ? <RNText style={[styles.sub, { color: colors.text3 }]}>{formatDay(day.day_date)}{day.day_date === today ? ' · aujourd\'hui' : ''}</RNText> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Jour suivant" disabled={selected >= days.length - 1} onPress={() => onPick(selected + 1)}
          style={[styles.arrow, { backgroundColor: colors.surface2, opacity: selected >= days.length - 1 ? 0.35 : 1 }]}>
          <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="back" size={18} tone="text" /></View>
        </Pressable>
      </View>

      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist">
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: GAP }}>
            {runs.map((r) => {
              const here = selected >= r.start && selected < r.start + r.count;
              return (
                <View key={r.start} style={{ width: r.count * W + (r.count - 1) * GAP, gap: 4 }}>
                  <RNText numberOfLines={1} style={[styles.run, { color: here ? colors.accent : colors.text3 }]}>{cityName(r.cityId) || 'Ville à choisir'}{r.count > 1 ? ` · ${r.count} j` : ''}</RNText>
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: here ? colors.accent : colors.surface2 }} />
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: GAP }}>
            {days.map((d, i) => {
              const on = i === selected, isToday = d.day_date === today;
              const showMonth = i === 0 || d.day_date.slice(8, 10) === '01';
              return (
                <Pressable key={d.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`Jour ${i + 1}, ${formatDay(d.day_date)}${isToday ? ", aujourd'hui" : ''}`} onPress={() => onPick(i)}
                  style={[styles.bubble, { backgroundColor: on ? colors.accent : colors.surface2, borderColor: isToday && !on ? colors.accent : 'transparent' }]}>
                  <RNText style={[styles.wd, { color: on ? colors.onAccent : colors.text3 }]}>{weekday(d.day_date)}</RNText>
                  <RNText style={[styles.num, { color: on ? colors.onAccent : colors.text }]}>{d.day_date.slice(8, 10).replace(/^0/, '')}</RNText>
                  <RNText style={[styles.mo, { color: on ? colors.onAccent : colors.text3, opacity: showMonth || on ? 1 : 0 }]}>{month(d.day_date)}</RNText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  arrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 26 },
  sub: { fontFamily: fonts.sans, fontSize: 13 },
  run: { fontFamily: fonts.sansBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  bubble: { width: W, height: 66, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  wd: { fontFamily: fonts.sansSemi, fontSize: 11, textTransform: 'capitalize' },
  num: { fontFamily: fonts.sansBold, fontSize: 18, lineHeight: 22 },
  mo: { fontFamily: fonts.sansSemi, fontSize: 10 },
});

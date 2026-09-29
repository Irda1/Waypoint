import React, { useMemo, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Chip, Text } from '../../ui';
import { dateRange, longDate, monthGrid, monthTitle, nextMonths, todayIso } from '../../lib/dates.ts';
import { FLEXIBLE_DURATIONS, MAX_TRIP_DAYS, QUICK_DURATIONS, dayCount, flexibleDates, nightCount, pickDate, pickDuration } from '../../domain/wizard.ts';
import type { WizardState } from '../../domain/wizard.ts';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { StepTitle } from './parts';
import type { StepProps } from './parts';

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function StepDates({ state, update }: StepProps<WizardState>) {
  const { colors } = useTheme();
  const today = useMemo(() => todayIso(), []);
  const months = useMemo(() => nextMonths(today, 13), [today]);
  const [flexible, setFlexible] = useState(state.indicative);
  const days = dayCount(state);
  const tooLong = days > MAX_TRIP_DAYS;

  function tap(iso: string) {
    if (iso < today) return;
    update(pickDate(state, iso));
  }

  const summary = !state.start ? 'Choisis ton jour d\'arrivée.' : !state.end ? 'Choisis ton jour de départ, ou une durée ci-dessous.'
    : `${state.indicative ? 'Dates indicatives : ' : ''}${dateRange(state.start, state.end)} · ${days} jour${days > 1 ? 's' : ''} · ${nightCount(state)} nuit${nightCount(state) > 1 ? 's' : ''}`;

  return (
    <View style={{ gap: space.md }}>
      <StepTitle title="Quand pars-tu ?" hint="Ouvre le calendrier, ou indique seulement une durée." />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Avec un calendrier" selected={!flexible} onPress={() => setFlexible(false)} />
        <Chip label="Pas encore de dates" selected={flexible} onPress={() => setFlexible(true)} />
      </View>

      <Text variant="body" accessibilityLiveRegion="polite" style={{ fontFamily: fonts.sansSemi, color: state.end ? colors.accent : colors.text2 }}>{summary}</Text>
      {tooLong ? <Text variant="muted" style={{ color: colors.warm }}>Un voyage dure au plus {MAX_TRIP_DAYS} jours ici. Raccourcis-le pour continuer.</Text> : null}

      {flexible ? (
        <>
          <Text variant="label">Combien de temps ?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {FLEXIBLE_DURATIONS.map(([n, label]) => (
              <Chip key={n} label={label} selected={state.indicative && days === n} onPress={() => update(flexibleDates(state, n, today))} />
            ))}
          </View>
          <Text variant="muted">Les dates seront indicatives (dans un mois environ). Tu pourras les préciser plus tard.</Text>
        </>
      ) : (
        <>
          {state.start && !state.end ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {QUICK_DURATIONS.map(([n, label]) => <Chip key={n} label={label} onPress={() => update(pickDuration(state, n))} />)}
            </View>
          ) : null}
          {months.map(({ year, month0 }) => {
            const grid = monthGrid(year, month0);
            return (
              <View key={`${year}-${month0}`} style={{ gap: space.xs }}>
                <Text variant="label" style={{ textTransform: 'capitalize' }}>{monthTitle(year, month0)}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {WEEK.map((w, i) => <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}><RNText style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: colors.text3 }}>{w}</RNText></View>)}
                  {Array.from({ length: grid.blanks }, (_, i) => <View key={`b${i}`} style={{ width: `${100 / 7}%` }} />)}
                  {grid.days.map((iso) => {
                    const past = iso < today;
                    const edge = iso === state.start || iso === state.end;
                    const inside = !!state.start && !!state.end && iso > state.start && iso < state.end;
                    return (
                      <Pressable key={iso} disabled={past} accessibilityRole="button" accessibilityLabel={longDate(iso)} accessibilityState={{ selected: edge, disabled: past }} onPress={() => tap(iso)}
                        style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: inside ? colors.surface2 : 'transparent' }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: edge ? colors.accent : 'transparent' }}>
                          <RNText style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: edge ? colors.onAccent : past ? colors.text3 : colors.text, opacity: past ? 0.45 : 1 }}>{Number(iso.slice(8))}</RNText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

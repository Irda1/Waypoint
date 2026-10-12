import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Screen, Text } from '../../src/ui';
import { loadSharedTrip } from '../../src/data/trips';
import type { SharedTrip } from '../../src/data/trips';
import { useCategories } from '../../src/data/categories';
import { Globe } from '../../src/features/globe/Globe';
import { ROUTE_BG, routeParam } from '../../src/domain/routeGlobe.ts';
import { formatDay } from '../../src/lib/format';
import { todayIso } from '../../src/lib/dates.ts';
import { iconFor } from '../../src/theme/categoryIcons';
import { Icon } from '../../src/ui/Icon';
import { categoryColors, fonts, palette, radius, space } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';

const SUN = palette('nuit', 'soleil');

/** Page publique en lecture seule : le programme d'un voyage partagé par lien, sans compte (planète, puis jour par jour). */
export default function SharedTripPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors, mode } = useTheme();
  const categories = useCategories();
  const [trip, setTrip] = useState<SharedTrip | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number> | null>(null);

  useEffect(() => {
    void loadSharedTrip(String(token)).then((r) => { setTrip(r.trip); setError(r.error); });
  }, [token]);

  if (trip === undefined) return <Screen><Text variant="muted">Chargement…</Text></Screen>;
  if (trip === null) return <Screen><Card><Text variant="body">{error ?? 'Ce lien n\'existe pas ou n\'est plus partagé.'}</Text></Card></Screen>;

  // Journées dépliées d'office : aujourd'hui et la suivante pendant le voyage, sinon les deux premières.
  const today = todayIso();
  const at = trip.days.findIndex((d) => d.date >= today);
  const first = at >= 0 && trip.starts_on && today >= trip.starts_on ? at : 0;
  const shown = open ?? new Set([first, first + 1]);
  const toggle = (i: number) => { const n = new Set(shown); if (n.has(i)) n.delete(i); else n.add(i); setOpen(n); };
  const steps = trip.days.reduce((n, d) => n + d.items.length, 0);
  const stops = trip.stops ?? [];
  const names = stops.length ? stops.map((s) => s.name) : trip.destinations;
  const dates = trip.starts_on ? `${formatDay(trip.starts_on)}${trip.ends_on ? ` → ${formatDay(trip.ends_on)}` : ''}` : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView>
        <View style={[styles.hero, { backgroundColor: ROUTE_BG.nuit }]}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Globe mode="route" color={SUN.accent.slice(1)} theme="nuit" route={stops.length ? routeParam(stops) : undefined} />
          </View>
          <SafeAreaView edges={['top']} style={styles.heroInner}>
            <RNText style={styles.brand}>Waypoint</RNText>
            <View style={{ gap: 4 }} pointerEvents="none">
              <RNText style={[styles.eyebrow, { color: SUN.accent }]}>Voyage partagé · {trip.days.length} jour{trip.days.length > 1 ? 's' : ''}</RNText>
              <RNText style={styles.poster} accessibilityRole="header">{trip.title}</RNText>
              {dates ? <RNText style={styles.lead}>{dates}</RNText> : null}
              {names.length ? <RNText style={styles.route} numberOfLines={2}>{names.join(' → ')}</RNText> : null}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {[`${trip.days.length} jour${trip.days.length > 1 ? 's' : ''}`, `${names.length} ville${names.length > 1 ? 's' : ''}`, `${steps} étape${steps > 1 ? 's' : ''}`].map((t) => (
                  <View key={t} style={styles.stat}><RNText style={styles.statText}>{t}</RNText></View>
                ))}
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="list" size={14} tone="muted" />
            <Text variant="muted" style={{ fontSize: 12.5 }}>Programme en lecture seule</Text>
          </View>
          {trip.days.map((d, i) => {
            const isOpen = shown.has(i);
            return (
              <View key={d.date} style={{ borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => toggle(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 }}>
                    <RNText style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.text }}>{i + 1}</RNText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text, textTransform: 'capitalize' }}>{formatDay(d.date)}</RNText>
                    <RNText style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.text2 }}>{[d.city, d.items.length ? `${d.items.length} étape${d.items.length > 1 ? 's' : ''}` : 'rien de prévu'].filter(Boolean).join(' · ')}</RNText>
                  </View>
                  <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={18} tone="muted" />
                </Pressable>
                {isOpen ? (
                  <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
                    {d.items.length === 0 ? <Text variant="muted">Rien de prévu ce jour-là.</Text> : d.items.map((it, k) => {
                      const root = it.category ? categories.rootOf(it.category) : '';
                      const dot = categoryColors[mode][root] ?? colors.text3;
                      return (
                        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40 }}>
                          <RNText style={{ width: 46, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text2, fontVariant: ['tabular-nums'] }}>{it.time ? it.time.slice(0, 5) : ''}</RNText>
                          <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${dot}33` }}>
                            <Icon name={root ? iconFor(root) : 'pin'} size={14} color={dot} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text }}>{it.name ?? 'Étape'}</RNText>
                            {it.note ? <RNText style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.text2 }}>{it.note}</RNText> : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
          <View style={{ borderRadius: radius.card, padding: space.lg, gap: space.sm, alignItems: 'center', backgroundColor: colors.surface2 }}>
            <RNText style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.text }}>Toi aussi, prépare ton voyage</RNText>
            <Text variant="muted" style={{ textAlign: 'center' }}>Programme jour par jour, carte et budget partagé.</Text>
            <Button label="Créer mon voyage avec Waypoint" onPress={() => router.push('/')} />
          </View>
          <Text variant="muted" style={{ fontSize: 12, textAlign: 'center' }}>Partagé avec Waypoint · Lieux © contributeurs d'OpenStreetMap</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 460, overflow: 'hidden' },
  heroInner: { flex: 1, minHeight: 460, justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl + 22, width: '100%', maxWidth: 720, alignSelf: 'center' },
  brand: { fontFamily: fonts.serif, fontSize: 17, color: '#F4EFE6' },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase' },
  poster: { fontFamily: fonts.serif, fontSize: 38, lineHeight: 42, color: '#F4EFE6' },
  lead: { fontFamily: fonts.sans, fontSize: 14, color: '#B3B9BB' },
  route: { fontFamily: fonts.sansSemi, fontSize: 14, color: '#F4EFE6' },
  stat: { borderWidth: 1, borderColor: 'rgba(245,245,242,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(7,9,11,0.4)' },
  statText: { fontFamily: fonts.sansSemi, fontSize: 12, color: '#F4EFE6' },
  sheet: { marginTop: -22, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.lg, paddingBottom: space.xl * 2, gap: space.md, width: '100%', maxWidth: 720, alignSelf: 'center' },
});

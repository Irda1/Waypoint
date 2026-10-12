import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Platform, Pressable, StyleSheet, Text as RNText, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Globe } from '../globe/Globe';
import { Icon } from '../../ui/Icon';
import { CountUp } from '../../ui/motion';
import { fonts, palette, radius, space } from '../../theme/tokens';
import { formatMoney } from '../../lib/format';
import { ROUTE_BG, routeParam } from '../../domain/routeGlobe.ts';
import { excerpt, recapDays, recapStats } from '../../domain/recap.ts';
import type { Journal, JournalPhoto } from '../../data/journal';
import type { Day, Destination, Member } from '../../data/useTrip';
import type { Expense, TripItem } from '../../domain/types';

const SUN = palette('nuit', 'soleil');
const TEXT = '#F4EFE6', SOFT = '#B3B9BB';
const native = Platform.OS !== 'web';

type Slide = { kind: 'globe' } | { kind: 'stats' } | { kind: 'day'; day: Day; index: number } | { kind: 'mosaic' } | { kind: 'end' };

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  dates: string;
  currency: string;
  days: Day[];
  destinations: Destination[];
  items: TripItem[];
  expenses: Expense[];
  journal: Journal;
  members: Member[];
  cityName: (day: Day) => string;
}

/** Photo plein écran qui avance doucement (coupé si le téléphone demande moins de mouvements). */
function Drift({ uri }: { uri: string }) {
  const k = useRef(new Animated.Value(1.08)).current;
  useEffect(() => { Animated.timing(k, { toValue: 1, duration: 6000, easing: Easing.out(Easing.quad), useNativeDriver: native }).start(); }, [k]);
  return <Animated.Image source={{ uri }} accessibilityIgnoresInvertColors resizeMode="cover" style={[StyleSheet.absoluteFill, { transform: [{ scale: k }] }]} />;
}

/** Récap animé du voyage, façon story : trajet, chiffres, jours du carnet, photos. Toucher à droite avance, à gauche revient, appui long = pause. */
export function Recap({ visible, onClose, title, dates, currency, days, destinations, items, expenses, journal, members, cityName }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const photosOf = (id: string) => journal.photos.filter((p) => p.day_id === id && p.url);
  const noteOf = (id: string) => journal.notes.get(id)?.note.trim() ?? '';
  const stats = recapStats({ days, destinations, items, expenses, photos: journal.photos, notes: [...journal.notes.values()] });
  const slides = useMemo<Slide[]>(() => {
    const picked = recapDays(days, (id) => photosOf(id).length > 0, (id) => !!noteOf(id));
    return [
      { kind: 'globe' }, { kind: 'stats' },
      ...picked.map((day) => ({ kind: 'day' as const, day, index: days.indexOf(day) })),
      ...(journal.photos.filter((p) => p.url).length >= 2 ? [{ kind: 'mosaic' as const }] : []),
      { kind: 'end' },
    ];
  }, [days, journal]); // eslint-disable-line react-hooks/exhaustive-deps

  const [i, setI] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const paused = useRef(0);
  const duration = (s: Slide | undefined) => (s?.kind === 'globe' ? 6500 : s?.kind === 'end' ? 0 : 5000);

  const run = (from: number) => {
    const d = duration(slides[i]);
    if (!d) return;
    progress.setValue(from);
    Animated.timing(progress, { toValue: 1, duration: d * (1 - from), easing: Easing.linear, useNativeDriver: false })
      .start(({ finished }) => { if (finished) setI((n) => Math.min(n + 1, slides.length - 1)); });
  };
  useEffect(() => { if (visible) setI(0); }, [visible]);
  useEffect(() => {
    if (!visible) return;
    run(0);
    return () => progress.stopAnimation();
  }, [i, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (n: number) => setI(Math.max(0, Math.min(slides.length - 1, n)));
  const slide = slides[i];
  const by = (id: string | null | undefined) => members.find((m) => m.user_id === id)?.profiles?.display_name;
  const allPhotos = journal.photos.filter((p): p is JournalPhoto & { url: string } => !!p.url);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: ROUTE_BG.nuit }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Écran suivant" accessibilityHint="Touche à gauche pour revenir, maintiens pour mettre en pause"
          style={StyleSheet.absoluteFill}
          onPress={(e) => { const x = e.nativeEvent.locationX; go(x < width / 3 ? i - 1 : i + 1); }}
          onLongPress={() => progress.stopAnimation((v) => { paused.current = v; })}
          onPressOut={() => { if (paused.current) { run(paused.current); paused.current = 0; } }}>
          {slide?.kind === 'globe' ? (
            <View style={[StyleSheet.absoluteFill, { bottom: '30%' }]} pointerEvents="none">
              <Globe mode="route" theme="nuit" color={SUN.accent.slice(1)} route={destinations.length ? routeParam(destinations) : undefined} />
            </View>
          ) : null}
          {slide?.kind === 'day' && photosOf(slide.day.id)[0]?.url ? <Drift key={slide.day.id} uri={photosOf(slide.day.id)[0].url!} /> : null}
          {slide?.kind === 'day' ? (
            // Fondu vers le noir en bas de la photo (paliers : pas de dépendance de dégradé), pour que le texte se lise.
            Array.from({ length: 10 }, (_, k) => 0.3 + k * 0.06).map((top) => <View key={top} pointerEvents="none" style={[StyleSheet.absoluteFill, { top: `${Math.round(top * 100)}%`, backgroundColor: 'rgba(0,0,0,0.09)' }]} />)
          ) : null}
          {slide?.kind === 'mosaic' ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 64, left: space.md, right: space.md, bottom: 190, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {allPhotos.slice(0, 6).map((p) => <Image key={p.id} source={{ uri: p.url }} accessibilityIgnoresInvertColors resizeMode="cover" style={{ width: '48.5%', height: '32%', borderRadius: 12 }} />)}
            </View>
          ) : null}

          <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', padding: space.xl, paddingBottom: insets.bottom + space.xl, gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
            {slide?.kind === 'globe' ? (
              <>
                <RNText style={st.k}>{dates}</RNText>
                <RNText style={st.big} accessibilityRole="header">{title}</RNText>
                {destinations.length ? <RNText style={st.soft}>{destinations.map((d) => d.name).join(' · ')}</RNText> : null}
              </>
            ) : slide?.kind === 'stats' ? (
              <>
                <RNText style={st.k}>Le voyage en chiffres</RNText>
                <RNText style={st.big}>{stats.days} jour{stats.days > 1 ? 's' : ''} ensemble</RNText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {([
                    [stats.cities, stats.cities > 1 ? 'villes' : 'ville', (n: number) => String(Math.round(n))],
                    [stats.km, 'km entre les villes', (n: number) => `${Math.round(n).toLocaleString('fr-FR')}`],
                    [stats.places, stats.places > 1 ? 'lieux au programme' : 'lieu au programme', (n: number) => String(Math.round(n))],
                    [stats.spent, 'dépensés', (n: number) => formatMoney(Math.round(n), currency)],
                  ] as const).map(([v, label, fmt]) => (
                    <View key={label} style={st.stat}>
                      <CountUp value={v} format={fmt} style={st.statN} />
                      <RNText style={st.statL}>{label}</RNText>
                    </View>
                  ))}
                </View>
                {stats.photos || stats.pages ? <RNText style={st.soft}>{stats.photos} photo{stats.photos > 1 ? 's' : ''} et {stats.pages} page{stats.pages > 1 ? 's' : ''} de carnet.</RNText> : null}
              </>
            ) : slide?.kind === 'day' ? (
              <>
                <RNText style={st.k}>Jour {slide.index + 1}{cityName(slide.day) ? ` · ${cityName(slide.day)}` : ''}</RNText>
                {noteOf(slide.day.id) ? (
                  <RNText style={[st.big, { fontSize: 26, lineHeight: 32 }]}>« {excerpt(noteOf(slide.day.id))} »</RNText>
                ) : <RNText style={st.big}>{photosOf(slide.day.id).length} photo{photosOf(slide.day.id).length > 1 ? 's' : ''}</RNText>}
                {by(journal.notes.get(slide.day.id)?.updated_by) ? <RNText style={st.soft}>— {by(journal.notes.get(slide.day.id)?.updated_by)}</RNText> : null}
              </>
            ) : slide?.kind === 'mosaic' ? (
              <>
                <RNText style={st.k}>Les photos</RNText>
                <RNText style={st.big}>Ce qu'on garde</RNText>
              </>
            ) : (
              <>
                <RNText style={st.k}>Fin du récap</RNText>
                <RNText style={st.big}>À la prochaine aventure</RNText>
                <RNText style={st.soft}>Le récap grandit chaque jour avec le carnet.</RNText>
                <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                  <Pressable accessibilityRole="button" onPress={() => go(0)} style={[st.btn, { backgroundColor: SUN.accent }]}><RNText style={[st.btnT, { color: SUN.onAccent }]}>Revoir</RNText></Pressable>
                  <Pressable accessibilityRole="button" onPress={onClose} style={[st.btn, { borderWidth: 1, borderColor: 'rgba(244,239,230,0.3)' }]}><RNText style={[st.btnT, { color: TEXT }]}>Fermer</RNText></Pressable>
                </View>
              </>
            )}
          </View>
        </Pressable>

        <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`Écran ${i + 1} sur ${slides.length}`}>
            {slides.map((_, k) => (
              <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(244,239,230,0.28)', overflow: 'hidden' }}>
                <Animated.View style={{ height: '100%', backgroundColor: TEXT, width: k < i ? '100%' : k > i ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <RNText style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 13, color: SOFT }}>Récap</RNText>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer le récap" onPress={onClose} hitSlop={8}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Icon name="close" size={20} color={TEXT} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  k: { fontFamily: fonts.sansBold, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase', color: SUN.accent },
  big: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, color: TEXT },
  soft: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: SOFT },
  stat: { width: '48%', flexGrow: 1, padding: space.md, borderRadius: radius.card - 6, backgroundColor: 'rgba(244,239,230,0.06)', borderWidth: 1, borderColor: 'rgba(244,239,230,0.12)', gap: 2 },
  statN: { fontFamily: fonts.serif, fontSize: 28, color: TEXT, fontVariant: ['tabular-nums'] },
  statL: { fontFamily: fonts.sans, fontSize: 12.5, color: SOFT },
  btn: { flex: 1, minHeight: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: fonts.sansBold, fontSize: 15 },
});

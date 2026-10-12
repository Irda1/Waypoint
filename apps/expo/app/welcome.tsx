import React, { useState } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Globe } from '../src/features/globe/Globe';
import { ROUTE_BG } from '../src/domain/routeGlobe.ts';
import { markWelcomed } from '../src/lib/welcome';
import { Icon } from '../src/ui/Icon';
import type { IconName } from '../src/ui/Icon';
import { FadeIn } from '../src/ui/FadeIn';
import { fonts, palette, radius, space } from '../src/theme/tokens';

const SUN = palette('nuit', 'soleil');
const TEXT = '#F4EFE6';
const SOFT = '#B3B9BB';

const SLIDES: { eyebrow: string; title: string; lead: string; art: 'globe' | 'plan' | 'friends' }[] = [
  { eyebrow: 'Bienvenue', title: 'Où part-on ?', lead: 'Choisis un pays sur la planète, tes dates et tes envies. Waypoint te propose un programme.', art: 'globe' },
  { eyebrow: 'Jour par jour', title: 'Ton voyage, organisé tout seul', lead: 'Les lieux à voir, les horaires, les trajets et la carte. Tu retires ce qui ne te plaît pas, tu ajoutes le reste.', art: 'plan' },
  { eyebrow: 'À plusieurs', title: 'Le voyage se prépare ensemble', lead: 'Invite tes proches : tout le monde modifie, le budget se partage, et tout reste lisible sans connexion.', art: 'friends' },
];

/** Premier lancement : trois écrans d'accueil sur fond de nuit, une seule fois, avant la connexion. */
export default function Welcome() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const done = (mode: 'in' | 'up') => {
    void markWelcomed();
    router.replace({ pathname: '/sign-in', params: { ...(next ? { next } : {}), mode } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: ROUTE_BG.nuit }}>
      {s.art === 'globe' ? <View style={StyleSheet.absoluteFill} pointerEvents="none"><Globe mode="route" color={SUN.accent.slice(1)} theme="nuit" /></View> : null}
      <SafeAreaView style={styles.inner}>
        <View style={styles.top}>
          <RNText style={styles.brand}>Waypoint</RNText>
          {last ? <View style={{ minHeight: 44 }} /> : (
            <Pressable accessibilityRole="button" onPress={() => setI(SLIDES.length - 1)} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
              <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: SOFT }}>Passer</RNText>
            </Pressable>
          )}
        </View>
        <View style={styles.art} pointerEvents="none">{s.art === 'plan' ? <PlanArt /> : s.art === 'friends' ? <FriendsArt /> : null}</View>
        <FadeIn key={i}>
          <View style={{ gap: space.sm }}>
            <RNText style={[styles.eyebrow, { color: SUN.accent }]}>{s.eyebrow}</RNText>
            <RNText style={styles.poster} accessibilityRole="header">{s.title}</RNText>
            <RNText style={styles.lead}>{s.lead}</RNText>
          </View>
        </FadeIn>
        <View style={{ flexDirection: 'row', gap: 6, marginVertical: space.lg }} accessibilityLabel={`Écran ${i + 1} sur ${SLIDES.length}`}>
          {SLIDES.map((_, k) => <View key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? SUN.accent : 'rgba(244,239,230,0.3)' }} />)}
        </View>
        {last ? (
          <View style={{ gap: space.sm }}>
            <Big label="Créer mon compte" onPress={() => done('up')} />
            <Big label="J'ai déjà un compte" ghost onPress={() => done('in')} />
          </View>
        ) : <Big label="Suivant" onPress={() => setI(i + 1)} />}
      </SafeAreaView>
    </View>
  );
}

function Big({ label, onPress, ghost }: { label: string; onPress: () => void; ghost?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1,
      backgroundColor: ghost ? 'transparent' : SUN.accent, borderWidth: ghost ? 1 : 0, borderColor: 'rgba(245,245,242,0.3)' })}>
      <RNText style={{ fontFamily: fonts.sansBold, fontSize: 16, color: ghost ? TEXT : SUN.onAccent }}>{label}</RNText>
    </Pressable>
  );
}

/** Une journée en quatre étapes (heure, pastille de couleur, ligne) reliées par des pointillés. */
function PlanArt() {
  const rows: [string, string, IconName][] = [['09:30', '#E8833A', 'culture'], ['12:30', '#D35400', 'gastronomie'], ['15:00', '#2E8B57', 'nature'], ['20:00', '#7E57C2', 'nocturne']];
  return (
    <View style={{ width: 240, padding: space.lg, gap: space.md, borderRadius: 22, backgroundColor: '#101315', borderWidth: 1, borderColor: '#2C3236' }}>
      {rows.map(([t, c, icon], k) => (
        <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <RNText style={{ width: 42, fontFamily: fonts.sansMedium, fontSize: 12, color: '#8A9092' }}>{t}</RNText>
          <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c }}><Icon name={icon} size={15} color="#fff" /></View>
          <View style={{ height: 10, borderRadius: 5, width: 100 - k * 14, backgroundColor: '#2C3236' }} />
        </View>
      ))}
    </View>
  );
}

/** Trois voyageurs et le budget partagé. */
function FriendsArt() {
  return (
    <View style={{ alignItems: 'center', gap: space.lg }}>
      <View style={{ flexDirection: 'row' }}>
        {([['A', '#E8833A'], ['C', '#2F8FD8'], ['L', '#3FA66B']] as const).map(([l, c], k) => (
          <View key={l} style={{ width: 64, height: 64, borderRadius: 32, marginLeft: k ? -14 : 0, alignItems: 'center', justifyContent: 'center', backgroundColor: c, borderWidth: 3, borderColor: ROUTE_BG.nuit }}>
            <RNText style={{ fontFamily: fonts.sansBold, fontSize: 24, color: '#fff' }}>{l}</RNText>
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: SUN.accent }}>
        <RNText style={{ fontFamily: fonts.sansBold, fontSize: 14, color: SUN.onAccent }}>≈ 420 € par personne</RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.xl, width: '100%', maxWidth: 520, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.sm },
  brand: { fontFamily: fonts.serif, fontSize: 18, color: TEXT },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase' },
  poster: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, color: TEXT },
  lead: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 23, color: SOFT },
});

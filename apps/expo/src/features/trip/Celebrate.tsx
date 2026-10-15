import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text as RNText, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tripHomeKey } from './FlightsCard';
import { fonts, space } from '../../theme/tokens';

// Couleurs de l'appli (les quatre accents du thème nuit, et le crème du texte).
const CONFETTI = ['#FFB95A', '#5FD3BC', '#FF8F66', '#B7A6FF', '#F4EFE6'];
const GOLD = '#FFB95A', CREAM = '#F4EFE6', SOFT = '#B3B9BB';
const PIECES = 48, STEPS = 16;

/** Point d'une courbe de Bézier à 3 points, et sa direction (pour pencher l'avion). */
function bezier(a: [number, number], c: [number, number], b: [number, number], k: number) {
  const u = 1 - k;
  return {
    x: u * u * a[0] + 2 * u * k * c[0] + k * k * b[0], y: u * u * a[1] + 2 * u * k * c[1] + k * k * b[1],
    dx: 2 * u * (c[0] - a[0]) + 2 * k * (b[0] - c[0]), dy: 2 * u * (c[1] - a[1]) + 2 * k * (b[1] - c[1]),
  };
}

/**
 * « Bon voyage ! » juste après la création d'un voyage : un avion vole de la ville de départ (si on la connaît) à la
 * première ville, des confettis retombent, puis le voyage apparaît. 2,5 s ; une touche pour passer ; sans mouvement
 * (le message seul, 1,8 s) si le téléphone demande de réduire les animations.
 */
export function Celebrate({ tripId, to, title, subtitle, onDone }: { tripId: string; to: string | null; title: string; subtitle: string; onDone: () => void }) {
  const { width: w, height: h } = useWindowDimensions();
  const [from, setFrom] = useState<string | null>(null);
  const bg = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const msg = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const finish = () => { if (finished.current) return; finished.current = true; anim.current?.stop(); onDone(); };

  const A: [number, number] = [w * 0.78, h * 0.13], B: [number, number] = [w * 0.24, h * 0.27], C: [number, number] = [w * 0.5, h * 0.02];
  const path = useMemo(() => Array.from({ length: STEPS + 1 }, (_, i) => bezier(A, C, B, i / STEPS)), [w, h]); // eslint-disable-line react-hooks/exhaustive-deps
  const range = path.map((_, i) => i / STEPS);
  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, i) => {
    const vx = (Math.random() - 0.5) * w * 0.9, vy = -h * (0.12 + Math.random() * 0.2), g = h * 0.75, size = 6 + Math.random() * 5;
    return { color: CONFETTI[i % CONFETTI.length], size, spin: (Math.random() - 0.5) * 900, x0: w * 0.5, y0: h * 0.46, vx, vy, g };
  }), [w, h]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [saved, reduce] = await Promise.all([
        AsyncStorage.getItem(tripHomeKey(tripId)).catch(() => null),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      ]);
      if (!alive) return;
      try { const name = saved ? (JSON.parse(saved) as { name?: unknown }).name : null; if (typeof name === 'string' && name) setFrom(name); } catch { /* départ inconnu : pas d'étiquette */ }
      if (reduce) { bg.setValue(1); fly.setValue(1); msg.setValue(1); setTimeout(() => { if (alive) finish(); }, 1800); return; }
      anim.current = Animated.sequence([
        Animated.parallel([Animated.timing(bg, { toValue: 1, duration: 200, useNativeDriver: true }), Animated.timing(fly, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
        Animated.parallel([
          Animated.timing(fall, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(msg, { toValue: 1, duration: 400, useNativeDriver: true }), Animated.delay(700),
            Animated.parallel([Animated.timing(bg, { toValue: 0, duration: 300, useNativeDriver: true }), Animated.timing(msg, { toValue: 0, duration: 300, useNativeDriver: true })]),
          ]),
        ]),
      ]);
      anim.current.start(({ finished: ok }) => { if (ok && alive) finish(); });
    })();
    return () => { alive = false; anim.current?.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dot = (p: [number, number], label: string | null, color: string) => (
    <>
      <View style={{ position: 'absolute', left: p[0] - 5, top: p[1] - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      {label ? <RNText numberOfLines={1} style={{ position: 'absolute', left: p[0] - 80, top: p[1] + 10, width: 160, textAlign: 'center', fontFamily: fonts.sansBold, fontSize: 12, color: CREAM }}>{label}</RNText> : null}
    </>
  );

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title} : voyage créé. Passer l'animation`} onPress={finish} style={[StyleSheet.absoluteFill, { zIndex: 50, elevation: 50 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.78)', opacity: bg }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: bg }]}>
        {path.map((p, i) => i === 0 || i === STEPS || i % 2 ? null : (
          <Animated.View key={i} style={{ position: 'absolute', left: p.x - 2, top: p.y - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD, opacity: fly.interpolate({ inputRange: [Math.max(0, i / STEPS - 0.02), i / STEPS], outputRange: [0, 1], extrapolate: 'clamp' }) }} />
        ))}
        {from ? dot(A, from, CREAM) : null}
        {dot(B, to, GOLD)}
        <Animated.View style={{ position: 'absolute', left: -14, top: -14, transform: [
          { translateX: fly.interpolate({ inputRange: range, outputRange: path.map((p) => p.x) }) },
          { translateY: fly.interpolate({ inputRange: range, outputRange: path.map((p) => p.y) }) },
          // Le dessin de l'avion pointe vers la droite : on le tourne dans le sens du vol.
          { rotate: fly.interpolate({ inputRange: range, outputRange: path.map((p) => `${(Math.atan2(p.dy, p.dx) * 180) / Math.PI}deg`) }) },
        ] }}>
          <Ionicons name="airplane" size={28} color={CREAM} />
        </Animated.View>
        {pieces.map((c, i) => {
          const at = (k: number) => ({ x: c.x0 + c.vx * k, y: c.y0 + c.vy * k + c.g * k * k });
          const ks = [0, 0.25, 0.5, 0.75, 1];
          return (
            <Animated.View key={i} style={{
              position: 'absolute', left: 0, top: 0, width: c.size, height: c.size * 0.5, backgroundColor: c.color,
              opacity: fall.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: fall.interpolate({ inputRange: ks, outputRange: ks.map((k) => at(k).x) }) },
                { translateY: fall.interpolate({ inputRange: ks, outputRange: ks.map((k) => at(k).y) }) },
                { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.spin}deg`] }) },
              ],
            }} />
          );
        })}
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: space.lg, right: space.lg, top: h * 0.5, alignItems: 'center', gap: 6, opacity: msg, transform: [{ translateY: msg.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <RNText accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 32, color: CREAM, textAlign: 'center' }}>Bon voyage !</RNText>
        <RNText style={{ fontFamily: fonts.sans, fontSize: 14, color: SOFT, textAlign: 'center' }}>{subtitle}</RNText>
      </Animated.View>
    </Pressable>
  );
}

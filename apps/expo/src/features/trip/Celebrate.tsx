import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text as RNText, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tripHomeKey } from './FlightsCard';
import { fonts, space } from '../../theme/tokens';
import { Globe } from '../globe/Globe';
import { ROUTE_BG, routeParam } from '../../domain/routeGlobe.ts';

// Couleurs de l'appli (les quatre accents du thème nuit, et le crème du texte).
const CONFETTI = ['#FFB95A', '#5FD3BC', '#FF8F66', '#B7A6FF', '#F4EFE6'];
const CREAM = '#F4EFE6', SOFT = '#B3B9BB';
const PIECES = 48;
// Le premier trajet de la planète dure 2,6 s (routeGlobe.ts) : le message arrive juste après.
const FLIGHT_MS = 2900;

export interface CelebrateCity { name: string; lat: number; lng: number }

/**
 * « Bon voyage ! » juste après la création d'un voyage : sur la planète de l'accueil, un point trace le chemin de la ville
 * de départ (si on la connaît) à la première ville, puis le message et les confettis ; environ 4,5 s, une touche pour passer.
 * Sans mouvement (le message sur la planète immobile, 1,8 s) si le téléphone demande de réduire les animations.
 */
export function Celebrate({ tripId, cities, subtitle, title, onDone }: { tripId: string; cities: CelebrateCity[]; title: string; subtitle: string; onDone: () => void }) {
  const { width: w, height: h } = useWindowDimensions();
  const [route, setRoute] = useState<string | null>(null);
  const bg = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const msg = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const finish = () => { if (finished.current) return; finished.current = true; anim.current?.stop(); onDone(); };

  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, i) => {
    const vx = (Math.random() - 0.5) * w * 0.9, vy = -h * (0.12 + Math.random() * 0.2), g = h * 0.75, size = 6 + Math.random() * 5;
    return { color: CONFETTI[i % CONFETTI.length], size, spin: (Math.random() - 0.5) * 900, x0: w * 0.5, y0: h * 0.62, vx, vy, g };
  }), [w, h]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [saved, reduce] = await Promise.all([
        AsyncStorage.getItem(tripHomeKey(tripId)).catch(() => null),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      ]);
      if (!alive) return;
      let home: CelebrateCity | null = null;
      try {
        const v = saved ? (JSON.parse(saved) as Partial<CelebrateCity>) : null;
        if (v && typeof v.name === 'string' && typeof v.lat === 'number' && typeof v.lng === 'number') home = { name: v.name, lat: v.lat, lng: v.lng };
      } catch { /* départ inconnu : seulement les villes du voyage */ }
      setRoute(routeParam(home ? [home, ...cities] : cities));
      if (reduce) { bg.setValue(1); msg.setValue(1); setTimeout(() => { if (alive) finish(); }, 1800); return; }
      anim.current = Animated.sequence([
        Animated.timing(bg, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(FLIGHT_MS),
        Animated.parallel([
          Animated.timing(fall, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(msg, { toValue: 1, duration: 400, useNativeDriver: true }), Animated.delay(800),
            Animated.parallel([Animated.timing(bg, { toValue: 0, duration: 300, useNativeDriver: true }), Animated.timing(msg, { toValue: 0, duration: 300, useNativeDriver: true })]),
          ]),
        ]),
      ]);
      anim.current.start(({ finished: ok }) => { if (ok && alive) finish(); });
    })();
    return () => { alive = false; anim.current?.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title} : voyage créé. Passer l'animation`} onPress={finish} style={[StyleSheet.absoluteFill, { zIndex: 50, elevation: 50 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ROUTE_BG.nuit, opacity: bg }]}>
        {route !== null ? <Globe mode="route" color="FFB95A" theme="nuit" route={route} /> : null}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: bg }]}>
        {pieces.map((c, i) => {
          const at = (k: number) => ({ x: c.x0 + c.vx * k, y: c.y0 + c.vy * k + c.g * k * k });
          const ks = [0, 0.25, 0.5, 0.75, 1];
          return (
            <Animated.View key={i} style={{
              position: 'absolute', left: 0, top: 0, width: c.size, height: c.size * 0.5, backgroundColor: c.color,
              opacity: fall.interpolate({ inputRange: [0, 0.01, 0.7, 1], outputRange: [0, 1, 1, 0] }),   // cachés pendant le vol
              transform: [
                { translateX: fall.interpolate({ inputRange: ks, outputRange: ks.map((k) => at(k).x) }) },
                { translateY: fall.interpolate({ inputRange: ks, outputRange: ks.map((k) => at(k).y) }) },
                { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.spin}deg`] }) },
              ],
            }} />
          );
        })}
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: space.lg, right: space.lg, top: h * 0.6, alignItems: 'center', gap: 6, opacity: msg, transform: [{ translateY: msg.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <RNText accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 32, color: CREAM, textAlign: 'center' }}>Bon voyage !</RNText>
        <RNText style={{ fontFamily: fonts.sans, fontSize: 14, color: SOFT, textAlign: 'center' }}>{subtitle}</RNText>
      </Animated.View>
    </Pressable>
  );
}

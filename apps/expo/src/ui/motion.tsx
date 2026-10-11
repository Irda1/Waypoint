import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Text as RNText, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/tokens';

// Petites animations de l'appli (étape « Pendant le voyage ») : toutes coupées si le téléphone demande moins de mouvements.
const native = Platform.OS !== 'web';

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((r) => { if (alive) setReduce(r); });
    return () => { alive = false; };
  }, []);
  return reduce;
}

/** Bloc gris qui « respire » à la place d'un contenu en cours de chargement. */
export function Skeleton({ height, width = '100%', round = radius.field, style }: { height: number; width?: number | `${number}%`; round?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      Animated.timing(t, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, t]);
  return <Animated.View accessible={false} style={[{ height, width, borderRadius: round, backgroundColor: colors.surface2, opacity: reduce ? 0.8 : t.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }, style]} />;
}

/** Forme d'un écran en chargement : un titre et quelques lignes. */
export function SkeletonPage({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Chargement" style={{ gap: 14 }}>
      <Skeleton height={14} width="35%" />
      <Skeleton height={34} width="70%" />
      <Skeleton height={110} round={radius.card} />
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton height={16} width={44} />
          <View style={{ flex: 1, gap: 6 }}><Skeleton height={16} width="75%" /><Skeleton height={12} width="45%" /></View>
        </View>
      ))}
    </View>
  );
}

/** Nombre qui compte jusqu'à sa valeur (à l'affichage et à chaque changement), en 0,8 s. */
export function CountUp({ value, format, style, accessibilityLabel }: { value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; accessibilityLabel?: string }) {
  const reduce = useReduceMotion();
  const from = useRef(0);
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); from.current = value; return; }
    const start = from.current, t0 = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / 800), e = 1 - Math.pow(1 - k, 3);
      setShown(start + (value - start) * e);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, reduce]);
  return <RNText style={style} accessibilityLabel={accessibilityLabel ?? format(value)}>{format(shown)}</RNText>;
}

/** Petite réaction : l'élément gonfle puis revient quand `on` passe à vrai (favori, payé, puce choisie). */
export function Pop({ on, children, style }: { on: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const s = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!on || reduce) return;
    s.setValue(0.85);
    Animated.spring(s, { toValue: 1, friction: 4, tension: 220, useNativeDriver: native }).start();
  }, [on, reduce, s]);
  return <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>;
}

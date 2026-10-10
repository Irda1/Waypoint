import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

/**
 * Entrée douce d'un contenu (changement d'onglet, de jour) : fondu et léger glissé (vers le haut par défaut, `dx` pour un glissé latéral), 220 ms.
 * Aucune animation si le téléphone demande de réduire les mouvements. Remonter le composant (nouvelle `key`) la rejoue.
 */
export function FadeIn({ children, dx = 0, dy = 10 }: { children: React.ReactNode; dx?: number; dy?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (!alive) return;
      if (reduce) { t.setValue(1); return; }
      Animated.timing(t, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    });
    return () => { alive = false; };
  }, [t]);
  return (
    <Animated.View style={{ opacity: t, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

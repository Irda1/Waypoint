import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Text as RNText, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';

export type PanelPos = 'bas' | 'milieu' | 'haut';
const NEXT: Record<PanelPos, PanelPos> = { bas: 'milieu', milieu: 'haut', haut: 'bas' };

interface Props {
  /** Hauteur de la zone de la carte : le panneau se cale en bas, à mi-hauteur ou presque en haut. */
  containerHeight: number;
  position: PanelPos;
  onPosition: (p: PanelPos) => void;
  title: string;
  /** Hauteur visible en position basse. */
  peek?: number;
  children: React.ReactNode;
}

/** Panneau glissant de la maquette Escale : on tire la poignée (ou on la touche) pour le faire passer de bas à milieu puis haut. */
export function SlidingPanel({ containerHeight, position, onPosition, title, peek = 72, children }: Props) {
  const { colors } = useTheme();
  const panelHeight = Math.max(260, Math.round(containerHeight * 0.8));
  const offsets = useMemo(() => ({
    bas: Math.max(0, panelHeight - peek),
    milieu: Math.max(0, panelHeight - Math.round(containerHeight * 0.42)),
    haut: 0,
  }), [panelHeight, containerHeight, peek]);
  const ty = useRef(new Animated.Value(offsets[position])).current;
  const current = useRef(offsets[position]);
  const latest = useRef({ offsets, position, onPosition });
  latest.current = { offsets, position, onPosition };

  useEffect(() => {
    current.current = offsets[position];
    Animated.spring(ty, { toValue: offsets[position], useNativeDriver: true, friction: 9, tension: 70 }).start();
  }, [position, offsets, ty]);

  const from = useRef(0);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { from.current = current.current; },
    onPanResponderMove: (_, g) => {
      const v = Math.max(0, Math.min(latest.current.offsets.bas, from.current + g.dy));
      current.current = v; ty.setValue(v);
    },
    onPanResponderRelease: (_, g) => {
      const { offsets: o, position: pos, onPosition: change } = latest.current;
      if (Math.abs(g.dy) < 6) { change(NEXT[pos]); return; }
      const projected = current.current + g.vy * 120;
      const best = (Object.keys(o) as PanelPos[]).reduce((a, b) => (Math.abs(o[b] - projected) < Math.abs(o[a] - projected) ? b : a));
      if (best === pos) { current.current = o[best]; Animated.spring(ty, { toValue: o[best], useNativeDriver: true }).start(); } else change(best);
    },
  }), [ty]);

  if (containerHeight <= 0) return null;
  return (
    <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: panelHeight, transform: [{ translateY: ty }], backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', maxWidth: 640, alignSelf: 'center', width: '100%' }}>
      <View {...pan.panHandlers} accessibilityRole="button" accessibilityLabel="Faire glisser le panneau des lieux" style={{ paddingTop: 10, paddingBottom: 10, alignItems: 'center', gap: 8, cursor: 'grab' } as object}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong }} />
        <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text, paddingHorizontal: space.md }}>{title}</RNText>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Animated.View>
  );
}

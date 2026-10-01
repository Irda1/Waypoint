import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Text as RNText, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

/**
 * Liste réordonnable par glisser-déposer, identique sur téléphone et sur le web.
 * On attrape la poignée « ⠿ » : la ligne suit le doigt, les autres lignes se décalent en douceur pour montrer
 * où elle va tomber (mode « insert » : les lignes entre les deux se décalent d'un cran ; mode « swap » : la ligne
 * visée prend la place de celle qu'on tient). Au lâcher, `onMove(from, to)` enregistre le nouvel ordre.
 * `orderKey` change quand l'ordre enregistré change : c'est le signal pour remettre les lignes à zéro.
 */
interface Props {
  count: number;
  mode: 'insert' | 'swap';
  orderKey: string;
  onMove: (from: number, to: number) => void;
  renderRow: (index: number, handle: React.ReactNode) => React.ReactNode;
}

type Box = { y: number; h: number };

export function DragList({ count, mode, orderKey, onMove, renderRow }: Props) {
  const boxes = useRef<Box[]>([]);
  const drag = useRef<{ from: number; target: number } | null>(null);
  const shifts = useRef<Animated.Value[]>([]);
  const dy = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState<number | null>(null);
  const latest = useRef({ mode, onMove, count });
  latest.current = { mode, onMove, count };
  while (shifts.current.length < count) shifts.current.push(new Animated.Value(0));

  const settle = (target: number, from: number) => {
    const b = boxes.current;
    const { mode: m } = latest.current;
    for (let r = 0; r < latest.current.count; r++) {
      if (r === from || !b[r] || !b[from]) continue;
      let to = 0;
      if (m === 'swap') { if (r === target) to = b[from].y - b[r].y; }
      else if (from < target && r > from && r <= target) to = -b[from].h;
      else if (from > target && r >= target && r < from) to = b[from].h;
      Animated.spring(shifts.current[r], { toValue: to, useNativeDriver: true, friction: 9, tension: 120 }).start();
    }
  };

  const targetFor = (from: number, dist: number): number => {
    const b = boxes.current;
    if (!b[from]) return from;
    const center = b[from].y + b[from].h / 2 + dist;
    let best = from;
    for (let r = 0; r < latest.current.count; r++) if (b[r] && center >= b[r].y && center < b[r].y + b[r].h) best = r;
    if (center < (b[0]?.y ?? 0)) best = 0;
    if (center >= (b[latest.current.count - 1] ? b[latest.current.count - 1].y + b[latest.current.count - 1].h : 0)) best = latest.current.count - 1;
    return best;
  };

  const reset = () => {
    shifts.current.forEach((v) => v.setValue(0));
    dy.setValue(0);
    drag.current = null;
    setActive(null);
  };
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (resetTimer.current) clearTimeout(resetTimer.current); reset(); }, [orderKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const end = (from: number) => {
    const d = drag.current;
    if (!d) return;
    const to = d.target;
    const b = boxes.current;
    if (to === from || !b[from] || !b[to]) { Animated.spring(dy, { toValue: 0, useNativeDriver: true, friction: 8 }).start(() => reset()); return; }
    // La ligne glisse jusqu'à sa nouvelle place ; on enregistre ensuite, et `orderKey` remet tout à zéro.
    const finalY = latest.current.mode === 'swap' ? b[to].y - b[from].y : to > from ? b[to].y + b[to].h - b[from].h - b[from].y : b[to].y - b[from].y;
    Animated.spring(dy, { toValue: finalY, useNativeDriver: true, friction: 9, tension: 120 }).start();
    latest.current.onMove(from, to);
    resetTimer.current = setTimeout(reset, 2500);
  };

  const handles = useMemo(() => Array.from({ length: count }, (_, i) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { drag.current = { from: i, target: i }; dy.setValue(0); setActive(i); },
    onPanResponderMove: (_, g) => {
      const d = drag.current;
      if (!d) return;
      dy.setValue(g.dy);
      const t = targetFor(i, g.dy);
      if (t !== d.target) { d.target = t; settle(t, i); }
    },
    onPanResponderRelease: () => end(i),
    onPanResponderTerminate: () => end(i),
  })), [count]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <Animated.View
          key={i}
          onLayout={(e) => { boxes.current[i] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height }; }}
          style={{
            zIndex: active === i ? 20 : 0,
            elevation: active === i ? 8 : 0,
            transform: active === i ? [{ translateY: dy }, { scale: 1.02 }] : [{ translateY: shifts.current[i] }],
            opacity: active === i ? 0.95 : 1,
            shadowColor: '#000', shadowOpacity: active === i ? 0.3 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
          }}
        >
          {renderRow(i, <Handle responder={handles[i]} label={`Glisser l'élément ${i + 1} pour changer l'ordre`} />)}
        </Animated.View>
      ))}
    </View>
  );
}

function Handle({ responder, label }: { responder: ReturnType<typeof PanResponder.create>; label: string }) {
  const { colors } = useTheme();
  // touchAction / cursor / userSelect : seulement utiles sur le web, ignorés ailleurs.
  const web = { touchAction: 'none', cursor: 'grab', userSelect: 'none' } as unknown as object;
  return (
    <View accessible accessibilityLabel={label} {...responder.panHandlers} style={[{ width: 30, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, web]}>
      <RNText style={{ fontSize: 22, color: colors.text3 }}>⠿</RNText>
    </View>
  );
}

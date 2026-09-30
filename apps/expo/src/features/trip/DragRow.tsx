import React, { useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

/**
 * Ligne déplaçable au doigt (téléphone) : appui long, puis on glisse la ligne sur une autre pour échanger leurs places.
 * Le nombre de lignes parcourues se déduit de la hauteur de la ligne ; le défilement est bloqué pendant le geste.
 */
export function DragRow({ index, onMove, children }: { index: number; onMove: (from: number, to: number) => void; children: React.ReactNode }) {
  const y = useRef(new Animated.Value(0)).current;
  const height = useRef(0);
  const armed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const latest = useRef({ index, onMove });
  latest.current = { index, onMove };
  const [lifted, setLifted] = useState(false);

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const drop = (dy: number) => {
    armed.current = false;
    setLifted(false);
    const steps = height.current > 0 ? Math.round(dy / height.current) : 0;
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    if (steps !== 0) latest.current.onMove(latest.current.index, latest.current.index + steps);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: () => armed.current,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => y.setValue(g.dy),
    onPanResponderRelease: (_, g) => drop(g.dy),
    onPanResponderTerminate: () => drop(0),
  })).current;

  return (
    <Animated.View
      {...pan.panHandlers}
      onLayout={(e) => { height.current = e.nativeEvent.layout.height; }}
      onTouchStart={(e) => {
        clear();
        start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        timer.current = setTimeout(() => { armed.current = true; setLifted(true); }, 380);
      }}
      onTouchMove={(e) => {
        if (!armed.current && Math.hypot(e.nativeEvent.pageX - start.current.x, e.nativeEvent.pageY - start.current.y) > 10) clear();
      }}
      onTouchEnd={() => { clear(); if (armed.current) { armed.current = false; setLifted(false); } }}
      style={{ transform: [{ translateY: y }, { scale: lifted ? 1.02 : 1 }], zIndex: lifted ? 10 : 0, opacity: lifted ? 0.92 : 1, elevation: lifted ? 6 : 0 }}
    >
      {children}
    </Animated.View>
  );
}

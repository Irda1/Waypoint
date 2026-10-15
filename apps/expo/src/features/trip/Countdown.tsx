import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Text as RNText, View } from 'react-native';
import { countdownView } from '../../domain/countdown.ts';
import type { TripStatus } from '../../lib/dates.ts';
import { fonts, space } from '../../theme/tokens';

const W = 38, H = 50, HALF = H / 2, FLIP_MS = 640;
type Look = { tile: string; onTile: string; text: string; soft: string; accent: string };

// Une moitié de tuile : le chiffre est dessiné en entier, on n'en montre que le haut ou le bas.
function Half({ digit, part, look, style }: { digit: string; part: 'top' | 'bottom'; look: Look; style?: object }) {
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: HALF, overflow: 'hidden', backgroundColor: look.tile, ...(part === 'top' ? { top: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8 } : { bottom: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }) }, style]}>
      <RNText style={{ height: H, lineHeight: H, textAlign: 'center', fontFamily: fonts.serif, fontSize: 34, color: look.onTile, marginTop: part === 'bottom' ? -HALF : 0, fontVariant: ['tabular-nums'] }}>{digit}</RNText>
    </Animated.View>
  );
}

// Tuile qui se retourne de `from` à `to` : le haut de l'ancien chiffre bascule, puis le bas du nouveau retombe.
function Tile({ from, to, t, look }: { from: string; to: string; t: Animated.Value; look: Look }) {
  const turn = (origin: 'top' | 'bottom', deg: [string, string], range: [number, number], easing: (x: number) => number) =>
    ({ transformOrigin: origin, transform: [{ perspective: 260 }, { rotateX: t.interpolate({ inputRange: range, outputRange: deg, extrapolate: 'clamp', easing }) }] });
  return (
    <View style={{ width: W, height: H }}>
      <Half digit={to} part="top" look={look} />
      <Half digit={from} part="bottom" look={look} />
      {from === to ? null : (
        <>
          <Half digit={from} part="top" look={look} style={{ ...turn('bottom', ['0deg', '-90deg'], [0, 0.5], Easing.in(Easing.quad)), opacity: t.interpolate({ inputRange: [0, 0.499, 0.5, 1], outputRange: [1, 1, 0, 0] }) }} />
          <Half digit={to} part="bottom" look={look} style={{ ...turn('top', ['90deg', '0deg'], [0.5, 1], Easing.out(Easing.quad)), opacity: t.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] }) }} />
        </>
      )}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: HALF, height: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
    </View>
  );
}

/**
 * Compte à rebours de la couverture d'un voyage à venir. À l'ouverture (`animate`), les chiffres se retournent d'un cran
 * (13 → 12) comme un panneau d'aéroport ; `waiting` retient le départ (animation de création en cours) ; `onPlayed` dit que c'est fait. Sans animation (ou si le téléphone demande moins
 * de mouvements), les chiffres sont simplement posés.
 */
export function Countdown({ status, startLabel, look, animate, waiting, onPlayed }: { status: TripStatus; startLabel: string; look: Look; animate: boolean; waiting: boolean; onPlayed: () => void }) {
  const view = countdownView(status);
  const days = view?.kind === 'days';
  const t = useRef(new Animated.Value(0)).current;
  const done = useRef(new Animated.Value(1)).current;   // tuiles déjà retournées
  useEffect(() => {
    if (!days || !animate || waiting) return;
    let alive = true;
    let anim: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
        if (!alive) return;
        if (reduce) { t.setValue(1); onPlayed(); return; }
        anim = Animated.timing(t, { toValue: 1, duration: FLIP_MS, easing: Easing.linear, useNativeDriver: true });
        anim.start(({ finished }) => { if (finished && alive) onPlayed(); });
      });
    }, 450);
    return () => { alive = false; clearTimeout(timer); anim?.stop(); };
  }, [days, animate, waiting, t, onPlayed]);
  if (!view) return null;

  // Avant le retournement : l'ancien chiffre (animate) ; sinon directement le nouveau.
  const settled = !animate;
  const label = view.kind === 'days' ? `Départ dans ${Number(view.to)} jours` : view.kind === 'tomorrow' ? 'Départ demain' : "C'est le grand jour";
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm }}>
      {view.kind === 'days' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {view.to.split('').map((d, i) => (
              <Tile key={i} from={settled ? d : view.from[i]} to={d} t={settled ? done : t} look={look} />
            ))}
          </View>
          <View style={{ gap: 1, flexShrink: 1 }}>
            <RNText style={{ fontFamily: fonts.sansBold, fontSize: 14, color: look.text }}>jours avant le départ</RNText>
            <RNText style={{ fontFamily: fonts.sans, fontSize: 12.5, color: look.soft }}>{startLabel}</RNText>
          </View>
        </>
      ) : (
        <View style={{ gap: 1 }}>
          <RNText style={{ fontFamily: fonts.serif, fontSize: 24, color: look.accent }}>{view.kind === 'tomorrow' ? 'Demain !' : "C'est le grand jour"}</RNText>
          {view.kind === 'tomorrow' ? <RNText style={{ fontFamily: fonts.sans, fontSize: 12.5, color: look.soft }}>{startLabel}</RNText> : null}
        </View>
      )}
    </View>
  );
}

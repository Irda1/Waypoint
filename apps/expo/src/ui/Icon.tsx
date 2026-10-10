import React from 'react';
import { Text as RNText } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppearance } from '../theme/store';
import { useTheme } from '../theme/useTheme';

// Icônes de l'appli, au choix dans Réglages : émojis (par défaut) ou icônes vectorielles (Ionicons, même trait arrondi
// partout, rendu identique sur Android, iOS et web). Les noms sont ceux de l'appli, pas ceux de la police.
const NAMES = {
  home: 'home', trip: 'briefcase', day: 'sunny', map: 'map', budget: 'wallet', friends: 'people', places: 'location',
  settings: 'settings', search: 'search', close: 'close', back: 'arrow-back', add: 'add', check: 'checkmark',
  heart: 'heart', external: 'open', warning: 'warning', tip: 'bulb', note: 'document-text', expense: 'cash',
  walk: 'walk', bike: 'bicycle', transit: 'subway', car: 'car', plane: 'airplane', train: 'train', bed: 'bed',
  ticket: 'ticket', pin: 'pin', globe: 'earth', list: 'list', undo: 'refresh', swap: 'swap-horizontal',
  calendar: 'calendar', time: 'time', drop: 'water', chevronDown: 'chevron-down', chevronRight: 'chevron-forward',
  signIn: 'log-in', share: 'share-social', trash: 'trash', navigate: 'navigate', mail: 'mail', lock: 'lock-closed',
  google: 'logo-google',
  // Catégories de lieux (codes de place_categories).
  culture: 'business', gastronomie: 'restaurant', nature: 'leaf', sorties: 'balloon', shopping: 'bag-handle',
  creatif: 'color-palette', sport: 'football', bienetre: 'flower', nocturne: 'moon', pratique: 'information-circle',
  // Météo.
  sunny: 'sunny', partlySunny: 'partly-sunny', cloudy: 'cloudy', fog: 'cloud', rainy: 'rainy', snow: 'snow',
  storm: 'thunderstorm', thermometer: 'thermometer',
} as const;

export type IconName = keyof typeof NAMES;

// Version émoji de chaque icône. Les symboles simples (flèches, croix, coche, cœur) prennent la couleur demandée.
const EMOJI: Record<IconName, string> = {
  home: '🏠', trip: '🧳', day: '☀️', map: '🗺️', budget: '💶', friends: '👥', places: '📍', settings: '⚙️', search: '🔍',
  close: '✕', back: '←', add: '＋', check: '✓', heart: '♡', external: '↗', warning: '⚠️', tip: '💡', note: '📝', expense: '💶',
  walk: '🚶', bike: '🚲', transit: '🚇', car: '🚗', plane: '✈️', train: '🚆', bed: '🛏️', ticket: '🎟️', pin: '📌', globe: '🌍',
  list: '☰', undo: '↺', swap: '⇄', calendar: '📅', time: '🕒', drop: '💧', chevronDown: '▾', chevronRight: '›',
  signIn: '→', share: '📤', trash: '🗑️', navigate: '🧭', mail: '✉️', lock: '🔒', google: 'G',
  culture: '🏛️', gastronomie: '🍽️', nature: '🌿', sorties: '🎡', shopping: '🛍️', creatif: '🎨', sport: '🚴', bienetre: '🧖', nocturne: '🌙', pratique: '🚉',
  sunny: '☀️', partlySunny: '⛅', cloudy: '☁️', fog: '🌫️', rainy: '🌧️', snow: '🌨️', storm: '⛈️', thermometer: '🌡️',
};
type Tone = 'text' | 'muted' | 'accent' | 'onAccent' | 'danger' | 'paid';

/**
 * Réglage « Style des icônes » : couleur = émojis (par défaut) ; trait = icône vectorielle en contour ;
 * plein = icône vectorielle pleine. Les teintes (accent, catégorie, texte) s'appliquent aux icônes vectorielles et aux symboles.
 */
export function Icon({ name, size = 20, tone = 'accent', color, filled }: { name: IconName; size?: number; tone?: Tone; color?: string; filled?: boolean }) {
  const { icons } = useAppearance();
  const { colors } = useTheme();
  const tones: Record<Tone, string> = { text: colors.text, muted: colors.text3, accent: colors.accent, onAccent: colors.onAccent, danger: colors.danger, paid: colors.paid };
  const tint = color ?? tones[tone];
  if (icons === 'couleur') {
    const glyph = name === 'heart' && filled ? '♥' : EMOJI[name];
    return <RNText style={{ fontSize: size * 0.92, lineHeight: size * 1.15, color: tint, fontWeight: name === 'google' ? '700' : undefined }} accessibilityElementsHidden importantForAccessibility="no">{glyph}</RNText>;
  }
  // `filled` force la forme : un interrupteur (favori, coché) doit se lire pareil quel que soit le réglage.
  const base = NAMES[name];
  // Les logos de marque n'existent qu'en version pleine.
  const glyph = base === 'logo-google' || (filled ?? icons === 'plein') ? base : (`${base}-outline` as const);
  return <Ionicons name={glyph} size={size} color={tint} accessibilityElementsHidden importantForAccessibility="no" />;
}

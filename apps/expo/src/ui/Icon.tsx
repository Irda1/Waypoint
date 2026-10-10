import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppearance } from '../theme/store';
import { useTheme } from '../theme/useTheme';

// Icônes vectorielles (Ionicons, même trait arrondi partout) à la place des émojis : rendu identique sur
// Android, iOS et web, couleur et taille maîtrisées. Les noms sont ceux de l'appli, pas ceux de la police.
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
type Tone = 'text' | 'muted' | 'accent' | 'onAccent' | 'danger' | 'paid';

/**
 * Réglage « Style des icônes » : couleur = contour, teinte du contexte (accent, catégorie) ;
 * trait = contour, couleur du texte ; plein = silhouette pleine, teinte du contexte.
 */
export function Icon({ name, size = 20, tone = 'accent', color, filled }: { name: IconName; size?: number; tone?: Tone; color?: string; filled?: boolean }) {
  const { icons } = useAppearance();
  const { colors } = useTheme();
  const tones: Record<Tone, string> = { text: colors.text, muted: colors.text3, accent: colors.accent, onAccent: colors.onAccent, danger: colors.danger, paid: colors.paid };
  const contextual = tone === 'onAccent' || tone === 'danger' || tone === 'paid' || tone === 'muted';
  const tint = color ?? (icons === 'trait' && !contextual ? colors.text : tones[tone]);
  // `filled` force la forme : un interrupteur (favori, coché) doit se lire pareil quel que soit le réglage.
  const base = NAMES[name];
  // Les logos de marque n'existent qu'en version pleine.
  const glyph = base === 'logo-google' || (filled ?? icons === 'plein') ? base : (`${base}-outline` as const);
  return <Ionicons name={glyph} size={size} color={tint} accessibilityElementsHidden importantForAccessibility="no" />;
}

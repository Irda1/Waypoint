// Identité « Crépuscule » (v0.9 de la maquette) : nuit par défaut, mode Jour crème.
// Fichier pur (aucune dépendance React Native) : testable avec Node.

export type Mode = 'nuit' | 'jour';
export type AccentName = 'soleil' | 'turquoise' | 'corail' | 'lavande';

export interface Palette {
  bg: string; surface: string; surface2: string; line: string; lineStrong: string;
  text: string; text2: string; text3: string;
  accent: string; accent2: string; onAccent: string;
  warm: string; paid: string; onPaid: string; danger: string;
}

const base: Record<Mode, Omit<Palette, 'accent' | 'accent2'>> = {
  nuit: {
    bg: '#07090B', surface: '#101315', surface2: '#171B1E', line: '#1E2326', lineStrong: '#2C3236',
    text: '#F4EFE6', text2: '#B3B9BB', text3: '#8A9092', onAccent: '#14100A',
    warm: '#F2704A', paid: '#4FD18B', onPaid: '#07200F', danger: '#FF8A7A',
  },
  jour: {
    bg: '#FFF6E9', surface: '#FFFDF8', surface2: '#F3E8D4', line: '#E8DCC4', lineStrong: '#D5C7A9',
    text: '#0E2A35', text2: '#4E6167', text3: '#5B6B70', onAccent: '#FFFFFF',
    warm: '#B8481F', paid: '#177A41', onPaid: '#FFFFFF', danger: '#B3261E',
  },
};

const accents: Record<Mode, Record<AccentName, { accent: string; accent2: string }>> = {
  nuit: {
    soleil: { accent: '#FFB95A', accent2: '#FFD08A' },
    turquoise: { accent: '#5FD3BC', accent2: '#9DE7DC' },
    corail: { accent: '#FF8F66', accent2: '#FFBDA3' },
    lavande: { accent: '#B7A6FF', accent2: '#D3CCF8' },
  },
  jour: {
    soleil: { accent: '#9A5200', accent2: '#B86A0A' },
    turquoise: { accent: '#0B6E62', accent2: '#0E8F80' },
    corail: { accent: '#B4452D', accent2: '#C8563D' },
    lavande: { accent: '#5B4BB8', accent2: '#6E5FCC' },
  },
};

export function palette(mode: Mode, accent: AccentName = 'soleil'): Palette {
  return { ...base[mode], ...accents[mode][accent] };
}

/** Couleurs de catégories (codes de la table place_categories). */
export const categoryColors: Record<Mode, Record<string, string>> = {
  nuit: { culture: '#7FA8E8', gastronomie: '#E9B872', nature: '#8CCB8A', sorties: '#D895DE', shopping: '#EE9AB4', creatif: '#F0D06A', sport: '#6FC3E0', bienetre: '#A9DCCB', nocturne: '#A3A3F2', pratique: '#8FC1D6' },
  jour: { culture: '#2F63B8', gastronomie: '#9A6410', nature: '#3C7F3A', sorties: '#9A3FA3', shopping: '#B03E66', creatif: '#8A6D00', sport: '#1F7A9A', bienetre: '#2F7F68', nocturne: '#5050B8', pratique: '#2A6F8C' },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { card: 22, pill: 999, field: 14 } as const;

// Polices : Fraunces (titres), Plus Jakarta Sans (texte), Geist Mono (chiffres).
// Tant qu'elles ne sont pas chargées (voir docs/BACKEND.md), retomber sur le système.
export const fonts = { serif: 'Fraunces', sans: 'PlusJakartaSans', mono: 'GeistMono' } as const;

// ---- Contraste (WCAG) : utilisé par les tests pour tenir la promesse d'accessibilité ----
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

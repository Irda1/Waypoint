import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

/** Les composants sont identiques partout ; seule leur mise en page suit la largeur de l'écran. */
export function breakpointFor(width: number): Breakpoint {
  if (width >= 1024) return 'desktop';
  if (width >= 600) return 'tablet';
  return 'phone';
}

export function useBreakpoint(): { breakpoint: Breakpoint; width: number; columns: 1 | 2 | 3 } {
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  return { breakpoint, width, columns: breakpoint === 'desktop' ? 3 : breakpoint === 'tablet' ? 2 : 1 };
}

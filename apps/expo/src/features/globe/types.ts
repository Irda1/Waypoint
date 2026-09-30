export interface GlobeProps {
  /** hero : fond de l'accueil (rotation lente, rien à toucher) ; pick : choix d'un pays. */
  mode: 'hero' | 'pick';
  /** Couleur des contours (hexadécimal sans #). */
  color?: string;
  /** Appelé au toucher d'un pays (code ISO à 2 lettres). */
  /** Pays à mettre en évidence : le globe pivote vers lui (code ISO à 2 lettres). */
  focus?: string | null;
  onPick?: (code: string, name: string) => void;
}
export const GLOBE_COLOR = '5FD3BC';

export interface GlobeProps {
  /** hero : planète réaliste en fond (rotation lente) ; route : fond de l'accueil, planète en points et tracé de voyage ; pick : choix d'un pays. */
  mode: 'hero' | 'pick' | 'route';
  /** Couleur des contours (hexadécimal sans #). */
  color?: string;
  /** Appelé au toucher d'un pays (code ISO à 2 lettres). */
  /** Pays à mettre en évidence : le globe pivote vers lui (code ISO à 2 lettres). */
  focus?: string | null;
  onPick?: (code: string, name: string) => void;
  /** Mode route : fond nuit (noir étoilé) ou jour (sable clair). */
  theme?: 'nuit' | 'jour';
  /** Mode route : itinéraire d'un voyage (voir routeParam) ; la caméra suit le point de ville en ville puis montre tout le trajet. */
  route?: string;
}
export const GLOBE_COLOR = '5FD3BC';

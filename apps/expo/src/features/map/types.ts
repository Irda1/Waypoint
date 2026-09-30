import type { MapPoint } from '../../domain/map.ts';

export interface MapCanvasProps {
  points: MapPoint[];
  selectedId: string | null;
  dark: boolean;
  start: { lat: number; lng: number; zoom: number };
  /** Quand cette valeur change, la carte recadre sur les points ; sinon elle garde sa position. */
  fitKey: string;
  /** Lieu sur lequel centrer la carte (recherche) ; le changement de valeur déclenche le centrage. */
  focusId?: string | null;
  onSelect: (id: string | null) => void;
}

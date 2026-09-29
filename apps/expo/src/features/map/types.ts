import type { MapPoint } from '../../domain/map.ts';

export interface MapCanvasProps {
  points: MapPoint[];
  selectedId: string | null;
  dark: boolean;
  start: { lat: number; lng: number; zoom: number };
  /** Quand cette valeur change, la carte recadre sur les points ; sinon elle garde sa position. */
  fitKey: string;
  onSelect: (id: string | null) => void;
}

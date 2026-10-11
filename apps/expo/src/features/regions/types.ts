import type { CityPoint } from '../../data/places';

export interface RegionMapProps {
  /** Pays (code ISO à 2 lettres). */
  country: string;
  cities: CityPoint[];
  /** Villes déjà choisies, dans l'ordre du parcours (le numéro est celui du parcours). */
  selected: { id: number; order: number }[];
  onToggle: (id: number) => void;
  /** Doigt posé sur la carte (true) ou levé (false) : la page parente bloque son défilement pendant ce temps. */
  onGrab?: (on: boolean) => void;
}
export const REGIONS_COLOR = '5FD3BC';
// Fichiers publics (régions, images de la Terre) sur GitHub : le mobile n'a pas d'adresse de site à laquelle les demander.
export const REGIONS_BASE_NATIVE = 'https://raw.githubusercontent.com/Irda1/Waypoint/main/apps/expo/public';

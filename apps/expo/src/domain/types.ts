// Types du domaine : reflètent les tables Supabase (supabase/migrations) telles que
// l'API REST les renvoie. Les montants `numeric` arrivent en nombres, les heures en « HH:MM:SS ».

export type Poste = 'hebergement' | 'transports' | 'repas' | 'activites' | 'shopping';

export const POSTES: readonly Poste[] = ['hebergement', 'transports', 'repas', 'activites', 'shopping'];

export interface Expense {
  id: string;
  poste: Poste;
  amount: number;
  paid_by: string | null;
  item_id: string | null;
  stay_id: string | null;
}

export interface Place {
  id: number;
  name: string;
  kind: 'activity' | 'service' | 'lodging' | 'transit';
  category_code: string;
  lat: number;
  lng: number;
  price_amount: number | null;
  visit_duration_min: number | null;
  closed_days: number[];
  opening_hours?: string | null;
}

export interface TripItem {
  id: string;
  day_id: string;
  plan: 'A' | 'B' | 'C';
  place_id: number | null;
  title: string | null;
  category_code: string | null;
  start_time: string | null;
  duration_min: number | null;
  position: number;
  done: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
}

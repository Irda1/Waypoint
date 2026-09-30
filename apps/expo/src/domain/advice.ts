// Recommandations textuelles d'une journée : règles simples et lisibles (météo, temps libre, rythme, budget).
// Ce sont des suggestions : l'utilisateur décide, rien n'est modifié automatiquement. Fonction pure, testable avec Node.
import { describeCode } from './weather.ts';
import type { DayWeather } from './weather.ts';
import { OUTDOOR_ROOTS } from './weather.ts';
import { formatDuration } from '../lib/search.ts';

export interface AdviceStop {
  name: string;
  /** Catégorie principale (culture, gastronomie, nature…). */
  root: string;
  startMin: number | null;
  endMin: number | null;
  /** Durée de l'étape en minutes (estimée si l'utilisateur n'en a pas donné). */
  durationMin: number;
  /** Trajet estimé depuis l'étape précédente (0 pour la première). */
  travelMin: number;
}

export interface AdviceInput {
  stops: AdviceStop[];
  weather: DayWeather | null;
  /** Coût estimé des lieux du jour (tous voyageurs). */
  dayCost: number;
  /** Budget « activités » divisé par le nombre de jours, si le voyage en a un. */
  dailyActivityBudget: number | null;
  formatMoney: (amount: number) => string;
}

export interface Tip { id: string; text: string }

export const BUSY_MINUTES = 10 * 60;
export const FREE_SLOT_MINUTES = 120;
export const HEAVY_TRAVEL_MINUTES = 90;
export const MAX_TIPS = 3;

/** Trois conseils au plus, les plus utiles d'abord. */
export function dayTips(input: AdviceInput): Tip[] {
  const { stops, weather } = input;
  const tips: Tip[] = [];
  if (stops.length === 0) {
    return [{ id: 'empty', text: 'Astuce : le programme automatique peut te proposer des lieux selon tes envies, ou ajoute-en un toi-même.' }];
  }

  const total = stops.reduce((s, x) => s + x.durationMin + x.travelMin, 0);
  if (total >= BUSY_MINUTES) {
    tips.push({ id: 'busy', text: `Journée chargée (environ ${formatDuration(total)} avec les trajets) : retire une étape ou déplace-la sur un autre jour pour garder du temps libre.` });
  }

  const travel = stops.reduce((s, x) => s + x.travelMin, 0);
  if (travel >= HEAVY_TRAVEL_MINUTES) {
    tips.push({ id: 'travel', text: `Environ ${formatDuration(travel)} de trajets dans la journée : regrouper les lieux d'un même quartier ferait gagner du temps.` });
  }

  if (stops.length >= 3 && !stops.some((s) => s.root === 'gastronomie')) {
    tips.push({ id: 'meal', text: 'Aucun repas prévu : pense à ajouter un déjeuner ou un dîner (une adresse de la catégorie Gastronomie).' });
  }

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const next = stops[i];
    if (prev.endMin != null && next.startMin != null) {
      const gap = next.startMin - prev.endMin - next.travelMin;
      if (gap >= FREE_SLOT_MINUTES) {
        tips.push({ id: 'free', text: `Créneau libre d'environ ${formatDuration(gap)} entre ${prev.name} et ${next.name} : une pause, un café ou une visite courte ?` });
        break;
      }
    }
  }

  if (weather && weather.rainFrom === null) {
    const d = weather.day;
    const sky = describeCode(d.code).sky;
    const outdoor = stops.some((s) => OUTDOOR_ROOTS.includes(s.root));
    if (sky === 'clair' && d.max != null && d.max >= 15 && d.max <= 30 && !outdoor) {
      tips.push({ id: 'sun', text: `Beau temps prévu (${Math.round(d.max)}°, pas de pluie attendue) : une balade ou un lieu en plein air serait un bon choix.` });
    }
  }

  if (input.dailyActivityBudget && input.dayCost > input.dailyActivityBudget * 1.5) {
    tips.push({ id: 'budget', text: `Ce jour coûte environ ${input.formatMoney(input.dayCost)}, au-dessus de ta moyenne prévue pour les activités (environ ${input.formatMoney(input.dailyActivityBudget)} par jour).` });
  }

  return tips.slice(0, MAX_TIPS);
}

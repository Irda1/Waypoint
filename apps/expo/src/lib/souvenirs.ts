// Pastille « Récap prêt » de l'accueil : voyages terminés depuis moins de 30 jours dont on n'a encore ouvert
// ni le récap ni le bilan. Ce qui a été vu est gardé sur l'appareil.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { diffDays } from './dates';

const KEY = 'waypoint.souvenirsSeen';
const DAYS = 30;

export async function seenSouvenirs(): Promise<Set<string>> {
  try { return new Set(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as string[]); } catch { return new Set(); }
}

export async function markSouvenirsSeen(tripId: string): Promise<void> {
  const seen = await seenSouvenirs();
  if (seen.has(tripId)) return;
  seen.add(tripId);
  try { await AsyncStorage.setItem(KEY, JSON.stringify([...seen].slice(-200))); } catch { /* stockage indisponible : la pastille reviendra, sans gravité */ }
}

/** Terminé (dernière date passée) depuis moins de 30 jours, et pas encore vu. */
export function souvenirsReady(t: { id: string; ends_on: string | null }, today: string, seen: Set<string>): boolean {
  return !!t.ends_on && t.ends_on < today && diffDays(t.ends_on, today) <= DAYS && !seen.has(t.id);
}

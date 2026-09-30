// Copies locales pour consulter ses voyages sans réseau (AsyncStorage). Tout est facultatif : une erreur de stockage est ignorée.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeSnapshot, encodeSnapshot } from '../domain/offlineSnapshot.ts';
import type { Snapshot } from '../domain/offlineSnapshot.ts';

const PREFIX = 'waypoint.offline.';

export async function saveOffline<T>(key: string, data: T): Promise<void> {
  try { await AsyncStorage.setItem(PREFIX + key, encodeSnapshot(data)); } catch { /* stockage plein ou indisponible */ }
}

export async function loadOffline<T>(key: string): Promise<Snapshot<T> | null> {
  try { return decodeSnapshot<T>(await AsyncStorage.getItem(PREFIX + key)); } catch { return null; }
}

/** À la déconnexion : les copies d'un compte ne doivent pas rester pour le suivant. */
export async function clearOffline(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
  } catch { /* rien à faire */ }
}

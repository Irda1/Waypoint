import AsyncStorage from '@react-native-async-storage/async-storage';

// Premier lancement : les trois écrans d'accueil ne s'affichent qu'une fois par appareil.
const KEY = 'waypoint.welcomed';

export async function wasWelcomed(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) === '1'; } catch { return true; }
}

export async function markWelcomed(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, '1'); } catch { /* stockage indisponible : on les reverra, sans gravité */ }
}

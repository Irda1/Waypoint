// Rappels locaux sur téléphone (expo-notifications). Rien ne passe par un serveur : les rappels sont programmés sur l'appareil.
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DEFAULT_PREFS } from '../domain/reminders.ts';
import type { NotifPrefs, Reminder } from '../domain/reminders.ts';

const PREF = 'waypoint.reminders';
const PREFS = 'waypoint.reminders.prefs';

export const remindersSupported = true;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function remindersEnabled(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(PREF)) === 'on'; } catch { return false; }
}

/** Active ou coupe les rappels ; à l'activation, demande l'autorisation. Renvoie l'état final. */
export async function setRemindersEnabled(on: boolean): Promise<{ enabled: boolean; denied: boolean }> {
  if (on) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Rappels de voyage', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return { enabled: false, denied: true };
  } else {
    await clearAllReminders();
  }
  try { await AsyncStorage.setItem(PREF, on ? 'on' : 'off'); } catch { /* préférence non gardée */ }
  return { enabled: on, denied: false };
}

/** Remplace les rappels de ce voyage (ceux des autres voyages restent). */
export async function syncTripReminders(tripId: string, reminders: Reminder[]): Promise<void> {
  if (!(await remindersEnabled())) return;
  const perms = await Notifications.getPermissionsAsync();
  if (!perms.granted) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((n) => n.identifier.startsWith(`${tripId}:`)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  for (const r of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${tripId}:${r.key}`,
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
    });
  }
}

export async function clearAllReminders(): Promise<void> {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* rien à annuler */ }
}

export async function loadNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

/** Garde les choix de notifications et efface les rappels déjà programmés : ils sont recalculés à la prochaine ouverture d'un voyage. */
export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  try { await AsyncStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* choix non gardé */ }
  await clearAllReminders();
}

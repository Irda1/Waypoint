// Sur le web, pas de rappels programmés : les fonctions ne font rien (l'écran Paramètres masque l'option).
import { DEFAULT_PREFS } from '../domain/reminders.ts';
import type { NotifPrefs, Reminder } from '../domain/reminders.ts';

export const remindersSupported = false;
export async function remindersEnabled(): Promise<boolean> { return false; }
export async function setRemindersEnabled(_on: boolean): Promise<{ enabled: boolean; denied: boolean }> { return { enabled: false, denied: false }; }
export async function syncTripReminders(_tripId: string, _reminders: Reminder[]): Promise<void> { /* rien */ }
export async function clearAllReminders(): Promise<void> { /* rien */ }
export async function loadNotifPrefs(): Promise<NotifPrefs> { return DEFAULT_PREFS; }
export async function saveNotifPrefs(_prefs: NotifPrefs): Promise<void> { /* rien */ }

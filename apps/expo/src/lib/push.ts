// Notifications entre amis (migration 2900) : inscription de ce téléphone Android auprès du serveur, et ouverture du
// voyage quand on touche une notification. L'envoi est fait par la fonction Edge `notify-friends`.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

export const pushSupported = Platform.OS === 'android';
export type PushResult = 'ok' | 'denied' | 'missing' | 'error';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Inscrit ce téléphone pour le compte connecté ; demande l'autorisation si `ask` et si Android le permet encore. */
export async function registerPush(ask: boolean): Promise<PushResult> {
  if (!pushSupported) return 'error';
  try {
    await Notifications.setNotificationChannelAsync('amis', { name: 'Activité des amis', importance: Notifications.AndroidImportance.DEFAULT });
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (ask && current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return 'denied';
    const { data } = await Notifications.getDevicePushTokenAsync();
    const { error } = await supabase.rpc('register_push_device', { p_token: String(data), p_platform: 'android' });
    if (error) return error.code === 'PGRST202' ? 'missing' : 'error';
    return 'ok';
  } catch {
    return 'error';   // appli construite sans Firebase (google-services.json absent)
  }
}

/** Toucher une notification d'un ami ouvre son voyage (appli fermée ou ouverte). */
export function useOpenFromNotification(open: (tripId: string) => void) {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const tripId = last?.notification.request.content.data?.tripId;
    if (typeof tripId === 'string') open(tripId);
  }, [last]); // eslint-disable-line react-hooks/exhaustive-deps
}

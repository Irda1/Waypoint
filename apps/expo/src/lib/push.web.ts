// Sur le web, pas de notifications des amis : l'écran Paramètres masque la partie, rien n'est inscrit.
export const pushSupported = false;
export type PushResult = 'ok' | 'denied' | 'missing' | 'error';
export async function registerPush(_ask: boolean): Promise<PushResult> { return 'error'; }
export function useOpenFromNotification(_open: (tripId: string) => void) { /* rien */ }

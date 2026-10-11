import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { BUILD_ID } from '../lib/env';

// Remontée des erreurs (migration 2000) : un court rapport dans la table client_errors, lue dans Supabase.
// Sans la migration ou sans connexion, l'envoi échoue sans bruit. Chaque message une fois, 10 par session au plus.
let screen = '';
const sent = new Set<string>();

/** Écran affiché (route), joint aux rapports. */
export function setErrorScreen(path: string): void { screen = path; }

export function reportError(e: unknown, fatal = false): Promise<void> {
  const err = e instanceof Error ? e : new Error(String(e));
  const message = err.message || err.name || 'Erreur';
  if (sent.has(message) || sent.size >= 10) return Promise.resolve();
  sent.add(message);
  return Promise.resolve(supabase.rpc('log_client_error', {
    p_message: message, p_stack: err.stack ?? null, p_screen: screen || null, p_platform: Platform.OS, p_build: BUILD_ID, p_fatal: fatal,
  })).then(() => undefined, () => undefined);
}

type Handler = (e: unknown, fatal?: boolean) => void;

/** Erreurs non rattrapées : plantage sur téléphone ; erreurs et promesses rejetées sur le web. */
export function installErrorReporting(): void {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (ev) => { void reportError(ev.error ?? ev.message); });
    window.addEventListener('unhandledrejection', (ev) => { void reportError(ev.reason); });
    return;
  }
  const eu = (globalThis as { ErrorUtils?: { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void } }).ErrorUtils;
  if (!eu) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    if (!fatal) { void reportError(e); prev(e, fatal); return; }
    // Plantage : le rapport a 1,5 s pour partir avant que l'appli se ferme.
    void Promise.race([reportError(e, true), new Promise((r) => setTimeout(r, 1500))]).then(() => prev(e, fatal));
  });
}

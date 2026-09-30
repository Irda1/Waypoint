import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Termine proprement la fenêtre de connexion Google sur le web.
WebBrowser.maybeCompleteAuthSession();

interface AuthValue {
  session: Session | null;
  loading: boolean;
  /** Renvoie un message d'erreur lisible, ou null si tout va bien. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Renvoie { error } ou { needsConfirmation: true } quand un email de confirmation est envoyé. */
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Envoie un lien de réinitialisation du mot de passe. */
  resetPassword: (email: string) => Promise<string | null>;
  /** Change le mot de passe de la personne connectée. */
  changePassword: (password: string) => Promise<string | null>;
  /** Supprime le compte et ses données (migration 1200). */
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthValue | null>(null);

const friendly = (message: string): string => {
  if (/invalid login credentials/i.test(message)) return 'Email ou mot de passe incorrect.';
  if (/email not confirmed/i.test(message)) return 'Confirme ton adresse email (lien reçu par mail), puis reconnecte-toi.';
  if (/already registered|already been registered/i.test(message)) return 'Un compte existe déjà avec cet email.';
  if (/password should be at least/i.test(message)) return 'Le mot de passe est trop court (6 caractères minimum).';
  return message;
};

/** Récupère la session depuis l'adresse de retour de Google (jetons ou code PKCE). */
async function sessionFromUrl(url: string): Promise<string | null> {
  const fragment = url.includes('#') ? url.split('#')[1] : (url.split('?')[1] ?? '');
  const params = new URLSearchParams(fragment);
  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? friendly(error.message) : null;
  }
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return error ? friendly(error.message) : null;
  }
  return params.get('error_description') ?? 'Connexion Google annulée.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? friendly(error.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password, options: { data: { full_name: displayName.trim() } },
    });
    if (error) return { error: friendly(error.message) };
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      return error ? friendly(error.message) : null;
    }
    const redirectTo = Linking.createURL('auth-callback');
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data?.url) return friendly(error?.message ?? 'Connexion Google impossible.');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return null;   // fenêtre fermée par l'utilisateur
    return sessionFromUrl(result.url);
  }, []);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = Platform.OS === 'web' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : undefined);
    return error ? friendly(error.message) : null;
  }, []);

  const changePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? friendly(error.message) : null;
  }, []);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      return /delete_my_account|schema cache|does not exist/i.test(error.message)
        ? 'La suppression n\'est pas encore activée sur le serveur (migration 1200 à installer).'
        : friendly(error.message);
    }
    await supabase.auth.signOut();
    return null;
  }, []);

  const value = useMemo(() => ({ session, loading, signIn, signUp, signInWithGoogle, signOut, resetPassword, changePassword, deleteAccount }), [session, loading, signIn, signUp, signInWithGoogle, signOut, resetPassword, changePassword, deleteAccount]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}

import React, { useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';
import { Button, Card, ErrorNote, Field, Screen, Text } from '../src/ui';
import { isConfigured } from '../src/lib/env';
import { space } from '../src/theme/tokens';

// N'accepte que des chemins internes : évite une redirection vers un site extérieur.
const safeNext = (next: string | string[] | undefined): string => {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
};

export default function SignIn() {
  const { session, signIn, signUp, signInWithGoogle } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href={safeNext(next) as never} />;

  async function submit() {
    setError(null); setInfo(null);
    if (!email.includes('@')) { setError('Adresse email invalide.'); return; }
    if (password.length < 6) { setError('Mot de passe : 6 caractères minimum.'); return; }
    setBusy(true);
    if (mode === 'in') {
      setError(await signIn(email, password));
    } else {
      const res = await signUp(email, password, name || email.split('@')[0]);
      if (res.error) setError(res.error);
      else if (res.needsConfirmation) setInfo('Compte créé. Ouvre le lien reçu par email pour le confirmer, puis connecte-toi.');
    }
    setBusy(false);
  }

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <Text variant="title">Waypoint</Text>
        <Text variant="muted">Ton compagnon de voyage, à plusieurs et en direct.</Text>
      </View>

      {!isConfigured ? (
        <Card>
          <Text variant="heading">Configuration manquante</Text>
          <Text variant="muted">Copie .env.example en .env.local et renseigne EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY (voir docs/BACKEND.md), puis relance l'appli.</Text>
        </Card>
      ) : null}

      <Card>
        <Text variant="heading">{mode === 'in' ? 'Connexion' : 'Créer un compte'}</Text>
        {mode === 'up' ? <Field label="Prénom ou pseudo" value={name} onChangeText={setName} autoCapitalize="words" /> : null}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        <ErrorNote message={error} />
        {info ? <Text variant="muted">{info}</Text> : null}
        <Button label={mode === 'in' ? 'Se connecter' : 'Créer mon compte'} onPress={submit} loading={busy} />
        <Button label="Continuer avec Google" variant="ghost" onPress={async () => { setError(await signInWithGoogle()); }} />
        <Button label={mode === 'in' ? 'Pas encore de compte ? Créer un compte' : 'J\'ai déjà un compte'} variant="ghost" onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); setInfo(null); }} />
      </Card>
    </Screen>
  );
}
